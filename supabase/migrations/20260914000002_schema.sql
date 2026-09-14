-- StoneSteps : schema des grilles de progression
--
-- Une grille est une suite ordonnee de niveaux ; un niveau porte ses exercices
-- ordonnes ; un exercice porte ses series ordonnees. On ne s'entraine jamais
-- "sur une grille" en general, toujours sur un niveau precis.
--
-- Le schema est relationnel de bout en bout : ni les niveaux ni les series ne
-- sont stockes en JSONB. Ce qui se lit sans jointure, c'est l'historique, qui
-- recopie en snapshot le nom de la grille et de l'exercice pour qu'une seance
-- passee survive a la modification ou la suppression de sa grille.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

create type public.timer_mode as enum ('none', 'minimal', 'strict');
-- none    : pas de chrono, on compte des repetitions
-- minimal : il faut TENIR au moins timer_seconds (gainage, descente lente)
-- strict  : il faut FINIR en au plus timer_seconds (series explosives)

create type public.set_status as enum ('success', 'surpass', 'fail');

create type public.muscle_group as enum ('push', 'pull', 'legs', 'core');

-- ---------------------------------------------------------------------------
-- Helper de mise a jour
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Le profil est cree a l'inscription, pas par l'application : un compte sans
-- profil casserait toutes les cles etrangeres qui en dependent.
-- SECURITY DEFINER parce que le trigger s'execute dans le contexte de
-- l'utilisateur qui s'inscrit, lequel n'a pas encore de droit d'ecriture.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(new.email, '@', 1)
      ),
      ''
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalogue d'exercices
-- ---------------------------------------------------------------------------

-- La colonne s'appelle muscle_group et non group : GROUP est un mot reserve
-- SQL, qui obligerait a citer la colonne dans chaque requete et chaque appel
-- PostgREST. Le type, lui, garde le nom du handoff.
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 80),
  muscle_group public.muscle_group not null,
  -- null = exercice integre au catalogue, visible de tous.
  owner_id     uuid references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index exercises_owner_idx on public.exercises (owner_id);

-- Un nom ne peut sortir deux fois du catalogue integre. Index partiel : la
-- contrainte ne vaut pas pour les exercices personnels, deux utilisateurs
-- pouvant nommer le leur pareil.
create unique index exercises_builtin_name_key
  on public.exercises (lower(name))
  where owner_id is null;

-- ---------------------------------------------------------------------------
-- Grilles, niveaux, exercices de niveau, series
-- ---------------------------------------------------------------------------

create table public.grids (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 60),
  accent_color text not null default '#00FF87'
                 check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Repos entre les series, par pas de 15 s cote interface. 0 = desactive.
  rest_seconds integer not null default 15
                 check (rest_seconds between 0 and 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index grids_owner_idx on public.grids (owner_id);

create trigger grids_set_updated_at
  before update on public.grids
  for each row execute function public.set_updated_at();

-- Les contraintes d'ordre sont deferrables : le constructeur reecrit un
-- niveau entier en une transaction, et les positions se croisent forcement au
-- milieu du remplacement.
create table public.levels (
  id       uuid primary key default gen_random_uuid(),
  grid_id  uuid not null references public.grids (id) on delete cascade,
  position integer not null check (position >= 1),
  constraint levels_grid_position_key unique (grid_id, position)
    deferrable initially deferred
);

create index levels_grid_idx on public.levels (grid_id, position);

create table public.level_exercises (
  id          uuid primary key default gen_random_uuid(),
  level_id    uuid not null references public.levels (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position    integer not null check (position >= 1),
  constraint level_exercises_level_position_key unique (level_id, position)
    deferrable initially deferred
);

create index level_exercises_level_idx on public.level_exercises (level_id, position);

create table public.level_sets (
  id                uuid primary key default gen_random_uuid(),
  level_exercise_id uuid not null
                      references public.level_exercises (id) on delete cascade,
  position          integer not null check (position >= 1),
  target_reps       integer not null default 10 check (target_reps >= 0),
  timer_mode        public.timer_mode not null default 'none',
  timer_seconds     integer check (timer_seconds is null or timer_seconds >= 5),
  -- Un mode sans chrono n'a pas de duree, un mode chronometre en a toujours
  -- une : sans ce check, les deux colonnes derivent l'une de l'autre.
  constraint level_sets_timer_coherence check (
    (timer_mode = 'none' and timer_seconds is null)
    or (timer_mode <> 'none' and timer_seconds is not null)
  ),
  constraint level_sets_exercise_position_key unique (level_exercise_id, position)
    deferrable initially deferred
);

create index level_sets_exercise_idx
  on public.level_sets (level_exercise_id, position);

-- ---------------------------------------------------------------------------
-- Historique
-- ---------------------------------------------------------------------------

-- grid_name et level_number sont des snapshots : modifier ou supprimer une
-- grille ne doit pas reecrire ce qui a deja ete fait. D'ou aussi les
-- on delete set null sur grid_id et level_id.
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  grid_id      uuid references public.grids (id) on delete set null,
  level_id     uuid references public.levels (id) on delete set null,
  grid_name    text not null,
  level_number integer not null check (level_number >= 1),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  -- Verdict tout-ou-rien du niveau : vrai seulement si aucune serie n'a
  -- echoue. C'est lui qui debloque le niveau suivant.
  validated    boolean not null default false
);

create index sessions_owner_started_idx
  on public.sessions (owner_id, started_at desc);
create index sessions_grid_level_idx on public.sessions (grid_id, level_id);

create table public.session_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  level_set_id  uuid references public.level_sets (id) on delete set null,
  set_index     integer not null check (set_index >= 0),
  exercise_name text not null,
  set_label     text not null,
  unit          text not null check (unit in ('reps', 's')),
  target_value  integer not null,
  actual_value  integer not null,
  status        public.set_status not null,
  -- Cle naturelle : c'est elle qui rendrait idempotente une eventuelle
  -- synchronisation hors ligne. set_index desambigue les series d'une meme
  -- definition, level_set_id peut etre null si la grille a ete modifiee.
  constraint session_sets_natural_key unique (session_id, level_set_id, set_index)
);

create index session_sets_session_idx on public.session_sets (session_id);

-- ---------------------------------------------------------------------------
-- Niveau en cours
-- ---------------------------------------------------------------------------

-- Le niveau en cours se derive, il ne se stocke pas : une colonne
-- current_level qu'il faudrait tenir a jour finirait par diverger de
-- l'historique. C'est le premier niveau sans seance validee.
--
-- SECURITY INVOKER (le defaut) : la fonction lit des tables protegees par RLS,
-- et doit rester soumise a ces policies. Renvoie null quand tous les niveaux
-- ont ete valides : la grille est alors terminee.
create or replace function public.current_level(p_grid_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select lv.id
  from public.levels lv
  where lv.grid_id = p_grid_id
    and not exists (
      select 1
      from public.sessions s
      where s.level_id = lv.id
        and s.validated
    )
  order by lv.position
  limit 1;
$$;
