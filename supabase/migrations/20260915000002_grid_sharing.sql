-- StoneSteps : partage des grilles
--
-- Une grille peut passer en public. Elle devient alors visible de tous, et
-- d'autres utilisateurs peuvent la suivre : elle apparait chez eux, ils y
-- jouent leurs propres seances, et recoivent les versions que son createur
-- publie ensuite.
--
-- Seul le createur voit ses brouillons, edite et publie. Un suiveur ne lit que
-- les versions publiees.
--
-- Retrait : passer une grille en prive, ou la supprimer, ne retire rien a ceux
-- qui la suivent deja. Leur suivi est fige sur la derniere version publiee au
-- moment du retrait, et ils gardent une grille jouable et un historique
-- lisible. Le createur cesse de leur pousser des versions, il ne leur reprend
-- pas ce qu'ils ont commence.

-- ---------------------------------------------------------------------------
-- Visibilite et retrait
-- ---------------------------------------------------------------------------

alter table public.grids
  add column is_public boolean not null default false,
  -- Suppression douce : une grille suivie ne peut pas disparaitre sous les
  -- pieds de ses suiveurs. Sans suiveur, l'application supprime pour de bon.
  add column deleted_at timestamptz;

create index grids_public_idx on public.grids (is_public) where is_public;

-- ---------------------------------------------------------------------------
-- Suivis
-- ---------------------------------------------------------------------------

create table public.grid_followers (
  grid_id    uuid not null references public.grids (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Null : le suiveur recoit chaque nouvelle version publiee.
  -- Renseigne : le partage a ete retire, le suivi reste fige sur ce numero.
  frozen_at_version integer check (frozen_at_version is null or frozen_at_version >= 1),
  created_at timestamptz not null default now(),
  primary key (grid_id, user_id)
);

create index grid_followers_user_idx on public.grid_followers (user_id);

-- ---------------------------------------------------------------------------
-- Prefixe inchange plutot que report
-- ---------------------------------------------------------------------------

-- carried_levels melangeait deux choses : ce qui n'a pas change d'une version
-- a l'autre, qui vaut pour tout le monde, et jusqu'ou l'utilisateur etait
-- monte, qui ne vaut que pour lui. Des qu'une grille est suivie par
-- quelqu'un d'autre, la seconde moitie devient fausse pour lui — elle lui
-- offrirait des niveaux qu'il n'a jamais faits.
--
-- On ne garde donc en base que le fait universel, le prefixe de niveaux
-- identiques a la version precedente. Le report se calcule ensuite pour chaque
-- utilisateur, a la lecture, en le bornant par ce que ses propres seances ont
-- valide.
alter table public.grid_versions
  add column unchanged_prefix integer not null default 0 check (unchanged_prefix >= 0);

-- Les versions existantes portent un report calcule sur le seul createur, qui
-- en etait aussi le seul utilisateur : les deux valeurs coincident.
update public.grid_versions set unchanged_prefix = carried_levels;

alter table public.grid_versions drop column carried_levels;

-- ---------------------------------------------------------------------------
-- Helpers de lecture
-- ---------------------------------------------------------------------------

-- Une grille est lisible si on la possede, si elle est publique, ou si on la
-- suit — ce dernier cas couvre les grilles repassees en prive.
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
         or exists (
              select 1 from public.grid_followers f
              where f.grid_id = gr.id and f.user_id = (select auth.uid())
            ) )
  );
$$;

-- Une version est lisible si elle est publiee et sa grille lisible, ou si on
-- possede la grille. Un brouillon ne sort jamais de chez son auteur.
create or replace function public.can_read_grid_version(v uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.grid_versions gv
    where gv.id = v
      and ( public.owns_grid(gv.grid_id)
         or (gv.status = 'published' and public.can_read_grid(gv.grid_id)) )
  );
$$;

create or replace function public.can_read_level(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_grid_version(
    (select lv.grid_version_id from public.levels lv where lv.id = l)
  );
$$;

create or replace function public.can_read_level_exercise(le uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_read_level(
    (select x.level_id from public.level_exercises x where x.id = le)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS : lecture elargie, ecriture inchangee
-- ---------------------------------------------------------------------------

-- La lecture s'ouvre aux grilles publiques et suivies ; l'ecriture reste au
-- seul proprietaire, policies inchangees.
drop policy if exists grids_select_own on public.grids;
create policy grids_select_readable on public.grids
  for select to authenticated
  using (public.can_read_grid(id));

drop policy if exists grid_versions_select_own on public.grid_versions;
create policy grid_versions_select_readable on public.grid_versions
  for select to authenticated
  using (public.can_read_grid_version(id));

drop policy if exists levels_select_own on public.levels;
create policy levels_select_readable on public.levels
  for select to authenticated
  using (public.can_read_grid_version(grid_version_id));

drop policy if exists level_exercises_select_own on public.level_exercises;
create policy level_exercises_select_readable on public.level_exercises
  for select to authenticated
  using (public.can_read_level(level_id));

drop policy if exists level_sets_select_own on public.level_sets;
create policy level_sets_select_readable on public.level_sets
  for select to authenticated
  using (public.can_read_level_exercise(level_exercise_id));

-- Suivis : chacun ne voit et ne gere que les siens.
alter table public.grid_followers enable row level security;

create policy grid_followers_select_own on public.grid_followers
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Le createur voit les suivis de ses propres grilles : il lui faut savoir si
-- quelqu'un le suit avant de retirer le partage ou de supprimer.
create policy grid_followers_select_owner on public.grid_followers
  for select to authenticated
  using (public.owns_grid(grid_id));

-- On ne suit que ce qu'on peut lire, et jamais sa propre grille : la posseder
-- suffit a l'avoir chez soi.
create policy grid_followers_insert_own on public.grid_followers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_read_grid(grid_id)
    and not public.owns_grid(grid_id)
  );

create policy grid_followers_delete_own on public.grid_followers
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Le gel d'un suivi est pose par le createur au moment du retrait : il ecrit
-- donc sur des lignes qui ne sont pas les siennes, mais seulement sur les
-- suivis de ses propres grilles.
create policy grid_followers_update_owner on public.grid_followers
  for update to authenticated
  using (public.owns_grid(grid_id))
  with check (public.owns_grid(grid_id));

-- ---------------------------------------------------------------------------
-- Nom du createur
-- ---------------------------------------------------------------------------

-- Le nom du createur doit apparaitre sur la grille. Il faut donc pouvoir lire
-- le profil de quelqu'un d'autre — uniquement celui d'un createur dont on peut
-- lire une grille, et profiles ne porte que le nom affiche : ni adresse, ni
-- rien d'autre.
create or replace function public.shares_a_grid_with_me(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.grids gr
    where gr.owner_id = p
      and ( gr.is_public
         or exists (
              select 1 from public.grid_followers f
              where f.grid_id = gr.id and f.user_id = (select auth.uid())
            ) )
  );
$$;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_readable on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_a_grid_with_me(id));
