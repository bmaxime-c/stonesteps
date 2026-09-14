-- StoneSteps : Row Level Security
--
-- Regle generale : on ne lit et on n'ecrit que chez soi. Il n'y a plus de
-- partage ni de social ; la seule lecture ouverte est le catalogue integre
-- d'exercices, ceux dont owner_id est null.
--
-- Les policies des tables enfants remontent au proprietaire par un helper
-- SECURITY DEFINER plutot qu'en referencant directement une autre table
-- protegee : sans cela, la policy de level_sets interrogerait
-- level_exercises, dont la policy interrogerait levels, dont la policy
-- interrogerait grids, et Postgres refuserait la recursion.
--
-- auth.uid() est toujours enveloppe dans un sous-select : le planificateur
-- l'evalue alors une fois par requete au lieu d'une fois par ligne.

-- ---------------------------------------------------------------------------
-- Helpers de propriete
-- ---------------------------------------------------------------------------

create or replace function public.owns_grid(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.grids gr
    where gr.id = g and gr.owner_id = (select auth.uid())
  );
$$;

create or replace function public.owns_level(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_grid((select lv.grid_id from public.levels lv where lv.id = l));
$$;

create or replace function public.owns_level_exercise(le uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_level(
    (select x.level_id from public.level_exercises x where x.id = le)
  );
$$;

create or replace function public.owns_session(s uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions se
    where se.id = s and se.owner_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Pas de policy d'insertion : le profil est cree par le trigger
-- handle_new_user, en SECURITY DEFINER, qui n'est pas soumis a la RLS.
-- Pas de policy de suppression non plus : un profil part avec son compte.

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;

create policy exercises_select on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy exercises_update_own on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- grids
-- ---------------------------------------------------------------------------

alter table public.grids enable row level security;

create policy grids_select_own on public.grids
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy grids_insert_own on public.grids
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy grids_update_own on public.grids
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy grids_delete_own on public.grids
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- levels
-- ---------------------------------------------------------------------------

alter table public.levels enable row level security;

create policy levels_select_own on public.levels
  for select to authenticated
  using (public.owns_grid(grid_id));

create policy levels_insert_own on public.levels
  for insert to authenticated
  with check (public.owns_grid(grid_id));

create policy levels_update_own on public.levels
  for update to authenticated
  using (public.owns_grid(grid_id))
  with check (public.owns_grid(grid_id));

create policy levels_delete_own on public.levels
  for delete to authenticated
  using (public.owns_grid(grid_id));

-- ---------------------------------------------------------------------------
-- level_exercises
-- ---------------------------------------------------------------------------

alter table public.level_exercises enable row level security;

create policy level_exercises_select_own on public.level_exercises
  for select to authenticated
  using (public.owns_level(level_id));

create policy level_exercises_insert_own on public.level_exercises
  for insert to authenticated
  with check (public.owns_level(level_id));

create policy level_exercises_update_own on public.level_exercises
  for update to authenticated
  using (public.owns_level(level_id))
  with check (public.owns_level(level_id));

create policy level_exercises_delete_own on public.level_exercises
  for delete to authenticated
  using (public.owns_level(level_id));

-- ---------------------------------------------------------------------------
-- level_sets
-- ---------------------------------------------------------------------------

alter table public.level_sets enable row level security;

create policy level_sets_select_own on public.level_sets
  for select to authenticated
  using (public.owns_level_exercise(level_exercise_id));

create policy level_sets_insert_own on public.level_sets
  for insert to authenticated
  with check (public.owns_level_exercise(level_exercise_id));

create policy level_sets_update_own on public.level_sets
  for update to authenticated
  using (public.owns_level_exercise(level_exercise_id))
  with check (public.owns_level_exercise(level_exercise_id));

create policy level_sets_delete_own on public.level_sets
  for delete to authenticated
  using (public.owns_level_exercise(level_exercise_id));

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

alter table public.sessions enable row level security;

create policy sessions_select_own on public.sessions
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy sessions_update_own on public.sessions
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- session_sets
-- ---------------------------------------------------------------------------

alter table public.session_sets enable row level security;

create policy session_sets_select_own on public.session_sets
  for select to authenticated
  using (public.owns_session(session_id));

create policy session_sets_insert_own on public.session_sets
  for insert to authenticated
  with check (public.owns_session(session_id));

create policy session_sets_update_own on public.session_sets
  for update to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

create policy session_sets_delete_own on public.session_sets
  for delete to authenticated
  using (public.owns_session(session_id));
