-- StoneSteps : Row Level Security
--
-- Regle generale : on lit ses propres donnees, celles de ses amis acceptes,
-- et les grilles publiques ou explicitement partagees. On n'ecrit que chez soi.
--
-- Les helpers sont en SECURITY DEFINER : ils contournent la RLS des tables
-- qu'ils interrogent, ce qui evite les recursions entre policies.
-- auth.uid() est enveloppe dans un sous-select : le planificateur l'evalue
-- alors une seule fois par requete au lieu d'une fois par ligne.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_read_grid(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.grids gr
    where gr.id = g
      and ( gr.owner_id = (select auth.uid())
         or gr.is_public
         or public.are_friends((select auth.uid()), gr.owner_id)
         or exists (
              select 1
              from public.grid_shares s
              where s.grid_id = gr.id
                and s.shared_with = (select auth.uid())
            ) )
  );
$$;

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

create or replace function public.can_read_level(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_grid((select lv.grid_id from public.levels lv where lv.id = l));
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

create or replace function public.owns_session(s uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions se
    where se.id = s and se.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_read_session(s uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions se
    where se.id = s
      and ( se.user_id = (select auth.uid())
         or public.are_friends((select auth.uid()), se.user_id) )
  );
$$;

-- ---------------------------------------------------------------------------
-- Activation
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.friendships     enable row level security;
alter table public.exercises       enable row level security;
alter table public.grids           enable row level security;
alter table public.levels          enable row level security;
alter table public.level_exercises enable row level security;
alter table public.sessions        enable row level security;
alter table public.set_results     enable row level security;
alter table public.grid_shares     enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Les profils sont annuaire : il faut pouvoir chercher un ami par pseudo.
-- Aucune donnee sensible n'y figure (pas d'email, pas de date de naissance).
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create policy friendships_select_involved on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create policy friendships_insert_as_requester on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()));

-- Le destinataire accepte ou bloque ; le demandeur peut bloquer de son cote.
create policy friendships_update_involved on public.friendships
  for update to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create policy friendships_delete_involved on public.friendships
  for delete to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------

create policy exercises_select on public.exercises
  for select to authenticated
  using (is_builtin or owner_id = (select auth.uid()));

create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_builtin);

create policy exercises_update_own on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_builtin);

create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- grids
-- ---------------------------------------------------------------------------

create policy grids_select_readable on public.grids
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or is_public
    or public.are_friends((select auth.uid()), owner_id)
    or exists (
         select 1 from public.grid_shares s
         where s.grid_id = id and s.shared_with = (select auth.uid())
       )
  );

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

create policy levels_select_readable on public.levels
  for select to authenticated
  using (public.can_read_grid(grid_id));

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

create policy level_exercises_select_readable on public.level_exercises
  for select to authenticated
  using (public.can_read_level(level_id));

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
-- sessions
-- ---------------------------------------------------------------------------

create policy sessions_select_own_or_friend on public.sessions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.are_friends((select auth.uid()), user_id)
  );

create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy sessions_update_own on public.sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- set_results
-- ---------------------------------------------------------------------------

create policy set_results_select_readable on public.set_results
  for select to authenticated
  using (public.can_read_session(session_id));

create policy set_results_insert_own on public.set_results
  for insert to authenticated
  with check (public.owns_session(session_id));

create policy set_results_update_own on public.set_results
  for update to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

create policy set_results_delete_own on public.set_results
  for delete to authenticated
  using (public.owns_session(session_id));

-- ---------------------------------------------------------------------------
-- grid_shares
-- ---------------------------------------------------------------------------

create policy grid_shares_select_involved on public.grid_shares
  for select to authenticated
  using (shared_with = (select auth.uid()) or public.owns_grid(grid_id));

create policy grid_shares_insert_owner on public.grid_shares
  for insert to authenticated
  with check (public.owns_grid(grid_id));

create policy grid_shares_delete_involved on public.grid_shares
  for delete to authenticated
  using (shared_with = (select auth.uid()) or public.owns_grid(grid_id));
