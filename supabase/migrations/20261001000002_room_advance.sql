-- StoneSteps : seance a plusieurs, declaration et avance du groupe
--
-- Une fois le salon lance, tout le monde joue la meme serie, celle du curseur
-- du salon. Chacun declare le statut de sa serie -- le statut seul, jamais la
-- valeur : les autres voient qui a reussi, pas combien il a fait. Quand tous
-- les presents ont declare, l'hote fait avancer le groupe ; il peut aussi
-- forcer, et les series non declarees seront comptees echouees par leur
-- auteur.
--
-- La presence (qui est la, en ce moment) n'est pas en base : elle vient du
-- canal Realtime du salon, que seul l'hote sait lire au moment d'avancer. La
-- liste des presents est donc passee par l'hote ; la base verifie seulement
-- que chacun d'eux a declare. Un hote qui mentirait sur la liste ne ferait
-- qu'un passage force deguise, ce qu'il a deja le droit de faire.
--
-- Le canal lui-meme devient prive : seuls les membres du salon y entrent.
--
-- Codes leves (P0001), traduits par l'application : not_room_member,
-- not_room_host, room_not_running, stale_cursor, room_moved, room_waiting.

-- ---------------------------------------------------------------------------
-- Declaration
-- ---------------------------------------------------------------------------

-- Chacun ne touche que sa propre ligne, et seulement ces deux colonnes : une
-- policy d'update laisserait aussi reecrire level_ceiling, donc s'ouvrir des
-- niveaux jamais atteints. D'ou une fonction plutot qu'une policy.
--
-- On ne declare que la serie du curseur du salon. Elle reste celle du curseur
-- pendant le repos qui la suit : le repos ne fait pas avancer le curseur, si
-- bien qu'une correction du chrono pendant le repos redeclare la meme serie.
-- Une fois le groupe passe a la suivante, la precedente est close : une
-- declaration en retard, apres un passage force, est refusee, et le client la
-- compte echouee de lui-meme.
--
-- Le verrou sur le salon serialise declarations et avance : l'hote ne peut
-- pas lire un « pas encore declare » pendant qu'un membre declare.
create or replace function public.declare_set(
  p_room uuid,
  p_cursor integer,
  p_status public.set_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.session_rooms%rowtype;
begin
  select * into v_room
  from public.session_rooms sr
  where sr.id = p_room
  for update;

  if v_room.id is null or not public.is_room_member(p_room) then
    raise exception 'not_room_member' using errcode = 'P0001';
  end if;

  if v_room.status <> 'running' then
    raise exception 'room_not_running' using errcode = 'P0001';
  end if;

  if p_cursor is distinct from v_room.cursor then
    raise exception 'stale_cursor' using errcode = 'P0001';
  end if;

  update public.session_room_members
  set declared_cursor = p_cursor,
      last_status = p_status
  where room_id = p_room and user_id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Avance du groupe
-- ---------------------------------------------------------------------------

-- L'hote fait passer le groupe a l'etape suivante. Concurrence optimiste :
-- il annonce l'etape qu'il croit courante, et si le salon a deja bouge -- un
-- second onglet, un double tap -- l'appel est refuse plutot que de sauter une
-- serie.
--
-- Sans p_force, chaque present doit avoir declare la serie du curseur. Avec,
-- on passe quand meme ; les retardataires le voient au curseur et comptent
-- eux-memes leur serie echouee.
--
-- Transitions, lues sur la version figee du salon (son repos, les series de
-- son niveau) et non sur la version jouable du moment :
--   set  -> finished           si c'etait la derniere serie du niveau ;
--   set  -> rest               sinon, si le repos de la version est non nul ;
--   set  -> set (cursor + 1)   sinon, repos nul ;
--   rest -> set (cursor + 1).
-- La regle est miroir de nextRoomStep (src/lib/session/group/flow.ts).
create or replace function public.advance_room(
  p_room uuid,
  p_expected_cursor integer,
  p_expected_stage public.room_stage,
  p_present uuid[],
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.session_rooms%rowtype;
  v_total integer;
  v_rest integer;
begin
  select * into v_room
  from public.session_rooms sr
  where sr.id = p_room
  for update;

  if v_room.id is null or v_room.host_id is distinct from (select auth.uid()) then
    raise exception 'not_room_host' using errcode = 'P0001';
  end if;

  if v_room.status <> 'running' then
    raise exception 'room_not_running' using errcode = 'P0001';
  end if;

  if v_room.cursor is distinct from p_expected_cursor
     or v_room.stage is distinct from p_expected_stage then
    raise exception 'room_moved' using errcode = 'P0001';
  end if;

  -- Le repos ne demande rien : tout le monde a declare, ou a ete force, avant
  -- d'y entrer. Seule la fin d'une serie attend les presents.
  if v_room.stage = 'set' and not coalesce(p_force, false) and exists (
    select 1 from public.session_room_members m
    where m.room_id = p_room
      and m.user_id = any (coalesce(p_present, '{}'))
      and m.declared_cursor < v_room.cursor
  ) then
    raise exception 'room_waiting' using errcode = 'P0001';
  end if;

  if v_room.stage = 'rest' then
    update public.session_rooms
    set cursor = cursor + 1,
        stage = 'set',
        rest_started_at = null,
        host_seen_at = now()
    where id = p_room;
    return;
  end if;

  select count(*) into v_total
  from public.level_sets ls
  join public.level_exercises le on le.id = ls.level_exercise_id
  where le.level_id = v_room.level_id;

  select gv.rest_seconds into v_rest
  from public.grid_versions gv
  where gv.id = v_room.grid_version_id;

  if v_room.cursor >= v_total - 1 then
    update public.session_rooms
    set status = 'finished',
        stage = 'finished',
        rest_started_at = null,
        host_seen_at = now()
    where id = p_room;
  elsif coalesce(v_rest, 0) > 0 then
    update public.session_rooms
    set stage = 'rest',
        rest_started_at = now(),
        host_seen_at = now()
    where id = p_room;
  else
    update public.session_rooms
    set cursor = cursor + 1,
        stage = 'set',
        rest_started_at = null,
        host_seen_at = now()
    where id = p_room;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Presence privee
-- ---------------------------------------------------------------------------

-- Le canal d'un salon s'appelle room:<uuid du salon> et s'ouvre en prive
-- (`private: true` cote client) : Realtime consulte alors les policies de
-- realtime.messages avant d'y laisser entrer, lire (select) ou s'annoncer
-- (insert).
--
-- Hypothese de syntaxe, d'apres la documentation Supabase « Realtime
-- Authorization » : realtime.topic() rend le nom du canal tel que le client
-- l'a ouvert, sans prefixe ; la colonne extension vaut 'presence' pour la
-- presence et 'broadcast' pour la diffusion. Seule la presence est ouverte :
-- le salon ne diffuse rien d'autre par ce canal.
--
-- Le nom du canal vient du client : il faut le valider avant d'en tirer un
-- uuid, sans quoi un nom mal forme ferait lever la policy au lieu de refuser.
-- Le case garantit l'ordre d'evaluation, ce qu'un simple and ne promet pas.
create or replace function public.is_room_topic_member(t text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when t ~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then public.is_room_member(substr(t, 6)::uuid)
    else false
  end;
$$;

create policy room_presence_select_member on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and public.is_room_topic_member((select realtime.topic()))
  );

create policy room_presence_insert_member on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.is_room_topic_member((select realtime.topic()))
  );
