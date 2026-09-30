-- StoneSteps : salon de seance a plusieurs
--
-- Un hote ouvre un salon sur une grille qu'il peut jouer, partage le lien, et
-- jusqu'a six personnes, lui compris, y entrent. Il choisit ensuite un niveau
-- et lance : tout le monde part sur la meme serie.
--
-- Le salon fige la version publiee au moment de son ouverture. Chacun y joue
-- la meme suite de series ; un participant dont la version jouable differe est
-- refuse a l'entree par l'application, qui seule sait calculer la version
-- jouable d'un utilisateur (suivi fige ou non).
--
-- Le niveau choisi est borne par le plafond, le niveau en cours du participant
-- le moins avance. Ce plafond se calcule cote serveur a l'entree, depuis
-- l'historique de chacun, et se range sur la ligne du membre : la base ne sait
-- pas deriver un niveau en cours, sa regle vit dans src/lib, testee.
--
-- Le salon ne s'ecrit jamais directement : ses transitions passent par des
-- fonctions SECURITY DEFINER qui verifient qui appelle et dans quel etat il
-- est. Seule la ligne de membre de chacun lui appartient.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

create type public.room_status as enum ('open', 'running', 'finished');
-- open     : on entre et on sort librement, l'hote n'a pas encore lance
-- running  : la seance est lancee, plus aucune nouvelle entree
-- finished : la seance est terminee pour tout le monde

create type public.room_stage as enum ('set', 'rest', 'finished');
-- Etape de la serie courante (cursor) une fois le salon lance : la phase de
-- synchronisation s'en sert, ce schema se contente de la poser.

-- ---------------------------------------------------------------------------
-- Salons
-- ---------------------------------------------------------------------------

create table public.session_rooms (
  id               uuid primary key default gen_random_uuid(),
  grid_id          uuid not null references public.grids (id) on delete cascade,
  -- Version figee a l'ouverture : une publication en cours de salon ne doit
  -- pas changer les series sous les pieds des participants.
  grid_version_id  uuid not null references public.grid_versions (id) on delete cascade,
  host_id          uuid not null references public.profiles (id) on delete cascade,
  -- Pose au lancement, pas avant : tant que le salon est ouvert, le plafond
  -- bouge a chaque entree et le choix de l'hote avec lui.
  level_id         uuid references public.levels (id) on delete set null,
  status           public.room_status not null default 'open',
  -- Indice de la serie courante dans le niveau, a plat, tous exercices
  -- confondus.
  cursor           integer not null default 0 check (cursor >= 0),
  stage            public.room_stage not null default 'set',
  rest_started_at  timestamptz,
  -- Derniere manifestation de l'hote : permet de reperer un salon abandonne.
  host_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index session_rooms_grid_idx on public.session_rooms (grid_id);
create index session_rooms_host_idx on public.session_rooms (host_id);

-- ---------------------------------------------------------------------------
-- Membres
-- ---------------------------------------------------------------------------

-- La cle (room_id, user_id) fait d'un compte un seul participant, quel que
-- soit le nombre d'onglets ouverts.
create table public.session_room_members (
  room_id          uuid not null references public.session_rooms (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  -- Position du niveau en cours du membre a son entree, ou le nombre de
  -- niveaux s'il a termine la grille : tout lui est alors rejouable.
  level_ceiling    integer not null check (level_ceiling >= 1),
  -- Derniere serie declaree par le membre ; -1 tant qu'il n'en a declare
  -- aucune.
  declared_cursor  integer not null default -1 check (declared_cursor >= -1),
  last_status      public.set_status,
  joined_at        timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- La cle primaire commence par room_id ; il faut encore retrouver les salons
-- d'un utilisateur.
create index session_room_members_user_idx on public.session_room_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Meme raison que pour les grilles : les policies des deux tables se
-- referencent l'une l'autre, et sans SECURITY DEFINER Postgres refuserait la
-- recursion.
create or replace function public.is_room_member(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_room_members m
    where m.room_id = r and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_room_host(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_rooms sr
    where sr.id = r and sr.host_id = (select auth.uid())
  );
$$;

-- Un salon est lisible par qui peut lire sa grille, par son hote, et par ses
-- membres : un membre dont le suivi a disparu entre-temps ne doit pas perdre
-- de vue la seance qu'il est en train de faire.
create or replace function public.can_read_room(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_rooms sr
    where sr.id = r
      and ( sr.host_id = (select auth.uid())
         or public.can_read_grid(sr.grid_id)
         or public.is_room_member(sr.id) )
  );
$$;

create or replace function public.is_room_open(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_rooms sr
    where sr.id = r and sr.status = 'open'
  );
$$;

-- On n'ouvre un salon que sur une version publiee de la grille annoncee : un
-- brouillon ne sort jamais de chez son auteur, et une version d'une autre
-- grille rendrait grid_id mensonger.
create or replace function public.is_published_version_of(v uuid, g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.grid_versions gv
    where gv.id = v and gv.grid_id = g and gv.status = 'published'
  );
$$;

-- Les noms des participants s'affichent dans le salon : il faut lire le
-- profil d'un autre, mais seulement celui de quelqu'un avec qui l'on partage
-- un salon.
create or replace function public.shares_a_room_with_me(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_room_members mine
    join public.session_room_members theirs on theirs.room_id = mine.room_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p
  );
$$;

-- ---------------------------------------------------------------------------
-- Entree dans un salon
-- ---------------------------------------------------------------------------

-- Six places et un salon ouvert : deux regles qu'une policy ne peut pas tenir,
-- parce que deux entrees simultanees verraient chacune cinq membres. Le
-- verrou FOR UPDATE sur le salon serialise les entrees, et aussi le
-- lancement, qui prend le meme verrou : on ne peut pas entrer dans un salon
-- pendant qu'il se lance.
--
-- SECURITY DEFINER parce que FOR UPDATE demande le droit de modifier le salon,
-- que seul l'hote a, et encore, par start_room.
--
-- Les messages sont des codes, pas des phrases : l'application les traduit.
create or replace function public.check_room_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.room_status;
  v_count integer;
begin
  select sr.status into v_status
  from public.session_rooms sr
  where sr.id = new.room_id
  for update;

  if v_status is null then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if v_status <> 'open' then
    raise exception 'room_started' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.session_room_members m
  where m.room_id = new.room_id;

  if v_count >= 6 then
    raise exception 'room_full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger session_room_members_check_entry
  before insert on public.session_room_members
  for each row execute function public.check_room_entry();

-- ---------------------------------------------------------------------------
-- Lancement
-- ---------------------------------------------------------------------------

-- L'hote lance sur un niveau de la version figee, au plus au plafond du
-- salon. Le plafond se relit ici, sous verrou, et non depuis ce que
-- l'interface affichait : un participant a pu entrer entre-temps.
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
-- RLS : salons
-- ---------------------------------------------------------------------------

alter table public.session_rooms enable row level security;

-- L'hote d'abord, en comparaison directe : a l'INSERT ... RETURNING, les
-- helpers relisent un instantane ou le salon n'existe pas encore.
create policy session_rooms_select_readable on public.session_rooms
  for select to authenticated
  using (host_id = (select auth.uid()) or public.can_read_room(id));

-- Un salon nait ouvert, sans niveau, sur une grille qu'on peut lire. Le reste
-- de son etat ne s'ecrit que par start_room.
create policy session_rooms_insert_host on public.session_rooms
  for insert to authenticated
  with check (
    host_id = (select auth.uid())
    and public.can_read_grid(grid_id)
    and public.is_published_version_of(grid_version_id, grid_id)
    and status = 'open'
    and level_id is null
  );

-- Pas de policy de modification ni de suppression : un UPDATE direct
-- laisserait l'hote lancer au-dela du plafond, ou rouvrir un salon lance.

-- ---------------------------------------------------------------------------
-- RLS : membres
-- ---------------------------------------------------------------------------

alter table public.session_room_members enable row level security;

-- Sa propre ligne d'abord, en comparaison directe, pour la meme raison que
-- plus haut. Les autres membres se lisent entre membres ; l'hote les voit
-- aussi, meme s'il a quitte la liste.
create policy session_room_members_select_readable on public.session_room_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_room_member(room_id)
    or public.is_room_host(room_id)
  );

-- On n'inscrit que soi, dans un salon qu'on peut lire. Places et statut sont
-- tenus par le trigger d'entree ; le plafond, par la Server Action, qui seule
-- sait le calculer.
create policy session_room_members_insert_own on public.session_room_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_read_room(room_id)
  );

-- On sort d'un salon tant qu'il est ouvert. Une fois lance, la ligne reste :
-- c'est elle qui autorise le retour d'un membre deja inscrit.
create policy session_room_members_delete_own on public.session_room_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_room_open(room_id)
  );

-- ---------------------------------------------------------------------------
-- Profils des participants
-- ---------------------------------------------------------------------------

-- S'ajoute a profiles_select_readable : les policies permissives se cumulent.
create policy profiles_select_room_mate on public.profiles
  for select to authenticated
  using (public.shares_a_room_with_me(id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Chaque participant suit le salon et la liste des membres en direct. Les
-- evenements passent par la RLS : on ne recoit que ce qu'on peut lire. La cle
-- primaire des membres porte room_id, si bien qu'une suppression arrive avec
-- le salon concerne sans replica identity full.
alter publication supabase_realtime
  add table public.session_rooms, public.session_room_members;
