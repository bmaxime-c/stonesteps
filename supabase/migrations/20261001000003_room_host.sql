-- StoneSteps : seance a plusieurs, battement et passation d'hote
--
-- L'hote fait avancer le groupe : s'il disparait, la seance s'arrete. Il se
-- manifeste donc a intervalle regulier (heartbeat_room), et un membre qui ne
-- le voit plus depuis assez longtemps prend la main (claim_room_host).
--
-- La base ne sait pas qui est present : la presence vit sur le canal Realtime
-- du salon. Le choix du candidat -- le present entre le plus tot -- est donc
-- fait par l'application (src/lib/session/group/host.ts) ; la base garantit
-- seulement qu'un hote encore vivant ne se fait pas deposseder, et qu'il n'y
-- a jamais deux hotes a la fois.
--
-- Avant le lancement, pas d'attente : un hote qui quitte un salon ouvert
-- passe la main tout de suite au membre restant le plus ancien, et un salon
-- que tout le monde a quitte disparait.
--
-- Reprises de revue : start_room exige que l'hote soit membre, et create_room
-- ouvre salon et inscription de l'hote en une seule transaction.
--
-- Codes leves (P0001), traduits par l'application : not_room_host,
-- not_room_member, room_finished, host_alive, host_taken, host_not_in_room,
-- grid_not_playable.

-- ---------------------------------------------------------------------------
-- Battement
-- ---------------------------------------------------------------------------

-- L'hote seul, et sans verrou : une ecriture d'une colonne, qui ne decide
-- rien. Un ancien hote depossede pendant une coupure recoit not_room_host, et
-- sait par la qu'il ne l'est plus.
--
-- Chaque battement touche le salon, donc part en evenement Realtime vers les
-- membres : c'est ainsi qu'ils voient l'hote vivant, sans autre canal.
create or replace function public.heartbeat_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.session_rooms
  set host_seen_at = now()
  where id = p_room
    and host_id = (select auth.uid())
    and status in ('open', 'running');

  if not found then
    raise exception 'not_room_host' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prise de main
-- ---------------------------------------------------------------------------

-- Un membre prend la place d'un hote silencieux. Deux candidats simultanes
-- -- deux onglets, deux membres qui se croient chacun le plus ancien -- se
-- serialisent sur le verrou du salon : le premier passe et rafraichit
-- host_seen_at, le second relit alors un hote vivant et recoit host_alive.
-- La condition repetee dans le where de l'update tient la meme garantie si
-- le verrou venait a manquer : host_taken.
--
-- L'hote qui reclame sa propre place n'y perd rien : l'appel vaut battement.
create or replace function public.claim_room_host(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Silence au-dela duquel l'hote est tenu pour parti. Trois battements
  -- manques : une coupure breve ne fait pas changer d'hote. Miroir de
  -- HOST_STALE_MS (src/lib/session/group/host.ts).
  c_host_stale constant interval := interval '15 seconds';
  v_room public.session_rooms%rowtype;
begin
  select * into v_room
  from public.session_rooms sr
  where sr.id = p_room
  for update;

  if v_room.id is null or not public.is_room_member(p_room) then
    raise exception 'not_room_member' using errcode = 'P0001';
  end if;

  if v_room.status not in ('open', 'running') then
    raise exception 'room_finished' using errcode = 'P0001';
  end if;

  if v_room.host_id = (select auth.uid()) then
    update public.session_rooms
    set host_seen_at = now()
    where id = p_room;
    return;
  end if;

  if v_room.host_seen_at >= now() - c_host_stale then
    raise exception 'host_alive' using errcode = 'P0001';
  end if;

  update public.session_rooms
  set host_id = (select auth.uid()),
      host_seen_at = now()
  where id = p_room
    and host_id = v_room.host_id
    and host_seen_at < now() - c_host_stale;

  if not found then
    raise exception 'host_taken' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lancement : l'hote doit etre du salon
-- ---------------------------------------------------------------------------

-- Repris de 20261001000001_session_rooms.sql, avec un controle de plus : un
-- hote qui n'est pas membre lancerait une seance qu'il ne joue pas, sur un
-- plafond qui ne compte pas le sien.
create or replace function public.start_room(p_room uuid, p_level uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.session_rooms%rowtype;
  v_position integer;
  v_ceiling integer;
begin
  select * into v_room
  from public.session_rooms sr
  where sr.id = p_room
  for update;

  -- is distinct from plutot que <> : sans session, auth.uid() est null et la
  -- comparaison ne serait ni vraie ni fausse.
  if v_room.id is null or v_room.host_id is distinct from (select auth.uid()) then
    raise exception 'not_room_host' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room) then
    raise exception 'host_not_in_room' using errcode = 'P0001';
  end if;

  if v_room.status <> 'open' then
    raise exception 'room_started' using errcode = 'P0001';
  end if;

  select lv.position into v_position
  from public.levels lv
  where lv.id = p_level and lv.grid_version_id = v_room.grid_version_id;

  if v_position is null then
    raise exception 'level_not_in_room' using errcode = 'P0001';
  end if;

  select min(m.level_ceiling) into v_ceiling
  from public.session_room_members m
  where m.room_id = p_room;

  if v_ceiling is null or v_position > v_ceiling then
    raise exception 'level_above_ceiling' using errcode = 'P0001';
  end if;

  update public.session_rooms
  set status = 'running',
      level_id = p_level,
      cursor = 0,
      stage = 'set',
      rest_started_at = null,
      host_seen_at = now()
  where id = p_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ouverture atomique
-- ---------------------------------------------------------------------------

-- Ouvrir un salon puis s'y inscrire en deux appels laissait, sur un echec du
-- second, un salon sans membre dont l'hote ne pouvait rien faire. Ici, les
-- deux lignes naissent ensemble ou pas du tout. Memes controles que la policy
-- d'insert du salon ; le plafond vient de la Server Action, qui seule sait le
-- calculer, comme a l'entree d'un membre.
create or replace function public.create_room(
  p_grid uuid,
  p_version uuid,
  p_ceiling integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
begin
  if (select auth.uid()) is null
     or not public.can_read_grid(p_grid)
     or not public.is_published_version_of(p_version, p_grid) then
    raise exception 'grid_not_playable' using errcode = 'P0001';
  end if;

  insert into public.session_rooms (grid_id, grid_version_id, host_id)
  values (p_grid, p_version, (select auth.uid()))
  returning id into v_room;

  insert into public.session_room_members (room_id, user_id, level_ceiling)
  values (v_room, (select auth.uid()), p_ceiling);

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Depart de l'hote
-- ---------------------------------------------------------------------------

-- L'hote qui quitte la liste passe la main au membre restant entre le plus
-- tot ; s'il n'en reste aucun, le salon disparait. Sans attendre le seuil de
-- claim_room_host : son depart est certain, pas suppose.
--
-- La policy de sortie ne laisse partir que d'un salon ouvert ; le salon lance
-- est couvert quand meme, au cas ou une ligne disparaitrait autrement.
--
-- Le verrou sur le salon serialise ce depart avec les entrees, qui prennent
-- le meme : un membre qui entre au meme instant est vu, ou pas, mais jamais a
-- moitie. Quand le salon lui-meme est supprime, ses membres partent en
-- cascade apres lui : le select ne le trouve plus, et il n'y a rien a faire.
create or replace function public.hand_over_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.session_rooms%rowtype;
  v_next uuid;
begin
  select * into v_room
  from public.session_rooms sr
  where sr.id = old.room_id
  for update;

  if v_room.id is null
     or v_room.host_id is distinct from old.user_id
     or v_room.status not in ('open', 'running') then
    return null;
  end if;

  select m.user_id into v_next
  from public.session_room_members m
  where m.room_id = old.room_id
  order by m.joined_at, m.user_id
  limit 1;

  if v_next is null then
    delete from public.session_rooms where id = old.room_id;
  else
    update public.session_rooms
    set host_id = v_next,
        host_seen_at = now()
    where id = old.room_id;
  end if;

  return null;
end;
$$;

-- Nomme pour passer avant session_room_members_touch_room (ordre
-- alphabetique) : le salon supprime ici, le toucher ensuite ne fait rien.
create trigger session_room_members_hand_over
  after delete on public.session_room_members
  for each row execute function public.hand_over_room();
