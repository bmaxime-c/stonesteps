-- StoneSteps : schema initial
-- Progression en callisthenie par niveaux valides integralement.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- none    : pas de chrono
-- minimal : il faut TENIR au moins timer_seconds (gainage, descente lente)
-- strict  : il faut FINIR en au plus timer_seconds (series explosives)
create type public.timer_mode as enum ('none', 'minimal', 'strict');

create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
                 check (username ~ '^[a-z0-9_-]{3,30}$'),
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cree le profil des l'inscription, a partir des metadonnees d'auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      -- repli : partie locale de l'email, assainie et suffixee pour l'unicite
      regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_-]', '', 'g')
        || '-' || substr(new.id::text, 1, 6)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Amities  (declarees des maintenant : les policies de lecture s'y adossent)
-- ---------------------------------------------------------------------------

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and ( (f.requester_id = a and f.addressee_id = b)
         or (f.requester_id = b and f.addressee_id = a) )
  );
$$;

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------

create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references public.profiles (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  category   text,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  -- un exercice est soit du catalogue integre, soit la propriete d'un membre
  constraint exercises_builtin_xor_owned check (is_builtin = (owner_id is null))
);

create index exercises_owner_idx on public.exercises (owner_id);

create unique index exercises_builtin_name_key
  on public.exercises (lower(name)) where is_builtin;

-- ---------------------------------------------------------------------------
-- grids / levels / level_exercises
-- ---------------------------------------------------------------------------

create table public.grids (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 100),
  description text,
  is_public   boolean not null default false,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index grids_owner_idx on public.grids (owner_id);

-- Une seule grille active par membre.
create unique index grids_one_active_per_owner
  on public.grids (owner_id) where is_active;

create trigger grids_set_updated_at
  before update on public.grids
  for each row execute function public.set_updated_at();

create table public.levels (
  id       uuid primary key default gen_random_uuid(),
  grid_id  uuid not null references public.grids (id) on delete cascade,
  position int  not null check (position > 0),
  name     text,
  -- differable : un reordonnancement passe par des positions temporairement en doublon
  constraint levels_grid_position_key unique (grid_id, position)
    deferrable initially deferred
);

create index levels_grid_idx on public.levels (grid_id, position);

create table public.level_exercises (
  id            uuid primary key default gen_random_uuid(),
  level_id      uuid not null references public.levels (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  -- 1 a 10 exercices par niveau : la borne haute est portee par la position
  position      int  not null check (position between 1 and 10),
  sets          int  not null check (sets between 1 and 20),
  reps          int  check (reps > 0),
  timer_mode    public.timer_mode not null default 'none',
  timer_seconds int  check (timer_seconds > 0),
  notes         text,
  constraint level_exercises_position_key unique (level_id, position)
    deferrable initially deferred,
  -- un chrono suppose une duree, et reciproquement
  constraint level_exercises_timer_coherent check (
    (timer_mode = 'none' and timer_seconds is null)
    or (timer_mode <> 'none' and timer_seconds is not null)
  ),
  -- un exercice se mesure en repetitions, en duree, ou les deux
  constraint level_exercises_measurable check (
    reps is not null or timer_mode <> 'none'
  )
);

create index level_exercises_level_idx on public.level_exercises (level_id, position);

-- ---------------------------------------------------------------------------
-- sessions / set_results
-- ---------------------------------------------------------------------------

create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  grid_id    uuid not null references public.grids (id) on delete cascade,
  level_id   uuid not null references public.levels (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  -- vrai seulement si TOUTES les series de TOUS les exercices sont reussies
  validated  boolean not null default false,
  constraint sessions_ends_after_start check (ended_at is null or ended_at >= started_at)
);

create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_grid_idx on public.sessions (grid_id);

create table public.set_results (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.sessions (id) on delete cascade,
  level_exercise_id uuid not null references public.level_exercises (id) on delete cascade,
  set_index         int  not null check (set_index > 0),
  success           boolean not null,
  reps_done         int check (reps_done >= 0),
  duration_seconds  numeric(6, 2) check (duration_seconds >= 0),
  recorded_at       timestamptz not null default now(),
  -- cle naturelle : rend la synchronisation hors ligne idempotente
  constraint set_results_natural_key unique (session_id, level_exercise_id, set_index)
);

create index set_results_session_idx on public.set_results (session_id);

-- ---------------------------------------------------------------------------
-- Partage explicite de grilles
-- ---------------------------------------------------------------------------

create table public.grid_shares (
  grid_id     uuid not null references public.grids (id) on delete cascade,
  shared_with uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (grid_id, shared_with)
);

create index grid_shares_shared_with_idx on public.grid_shares (shared_with);
