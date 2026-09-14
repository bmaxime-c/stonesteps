-- StoneSteps : versionnement des grilles
--
-- Une grille ne se modifie plus en place. Elle devient une identite qui porte
-- des versions : un brouillon au plus, et une suite de versions publiees. La
-- seance joue toujours la derniere version publiee ; le brouillon n'existe que
-- dans le constructeur, jusqu'a sa publication.
--
-- Le nom, la couleur et le repos descendent sur la version, avec les niveaux.
-- Sans cela, renommer une grille prendrait effet immediatement et la promesse
-- « jamais de sauvegarde directe » ne tiendrait qu'a moitie.
--
-- L'historique y gagne : une seance reste rattachee au niveau de la version
-- reellement jouee, et porte en plus le numero de version en snapshot.

create type public.grid_version_status as enum ('draft', 'published');

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------

create table public.grid_versions (
  id           uuid primary key default gen_random_uuid(),
  grid_id      uuid not null references public.grids (id) on delete cascade,
  version      integer not null check (version >= 1),
  status       public.grid_version_status not null default 'draft',

  name         text not null check (length(btrim(name)) between 1 and 60),
  accent_color text not null default '#00FF87'
                 check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  rest_seconds integer not null default 15
                 check (rest_seconds between 0 and 300),

  -- Nombre de niveaux acquis d'office a la publication : les positions 1 a
  -- carried_levels sont considerees validees sans avoir a etre rejouees.
  --
  -- C'est un fait de l'evenement de publication, fige une fois pour toutes, et
  -- non une progression stockee : la progression, elle, continue de se deriver
  -- des seances jouees sur cette version. Le calcul se fait cote applicatif au
  -- moment de publier — le plus petit du prefixe de niveaux inchanges et du
  -- niveau deja atteint.
  carried_levels integer not null default 0 check (carried_levels >= 0),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,

  constraint grid_versions_grid_version_key unique (grid_id, version),
  -- Une version publiee porte sa date, un brouillon n'en a pas.
  constraint grid_versions_published_at_coherence check (
    (status = 'published') = (published_at is not null)
  )
);

-- Au plus un brouillon par grille : « le » brouillon, pas « un » brouillon.
create unique index grid_versions_one_draft_per_grid
  on public.grid_versions (grid_id)
  where status = 'draft';

create index grid_versions_grid_idx on public.grid_versions (grid_id, version desc);

create trigger grid_versions_set_updated_at
  before update on public.grid_versions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reprise de l'existant
-- ---------------------------------------------------------------------------

-- Chaque grille existante devient une version 1 deja publiee : son contenu
-- etait jouable, il doit le rester.
insert into public.grid_versions (
  grid_id, version, status, name, accent_color, rest_seconds,
  carried_levels, created_at, updated_at, published_at
)
select g.id, 1, 'published', g.name, g.accent_color, g.rest_seconds,
       0, g.created_at, g.updated_at, g.updated_at
from public.grids g;

-- ---------------------------------------------------------------------------
-- Les niveaux appartiennent desormais a une version
-- ---------------------------------------------------------------------------

alter table public.levels add column grid_version_id uuid;

update public.levels lv
set grid_version_id = gv.id
from public.grid_versions gv
where gv.grid_id = lv.grid_id and gv.version = 1;

alter table public.levels
  alter column grid_version_id set not null,
  add constraint levels_grid_version_id_fkey
    foreign key (grid_version_id) references public.grid_versions (id) on delete cascade;

-- L'unicite de position vaut maintenant par version, pas par grille.
alter table public.levels drop constraint levels_grid_position_key;
alter table public.levels
  add constraint levels_version_position_key unique (grid_version_id, position)
  deferrable initially deferred;

drop index if exists public.levels_grid_idx;
create index levels_version_idx on public.levels (grid_version_id, position);

alter table public.levels drop column grid_id;

-- ---------------------------------------------------------------------------
-- Les seances retiennent la version jouee
-- ---------------------------------------------------------------------------

-- Snapshot, comme grid_name et level_number : il survit a la suppression de la
-- version, et situe la seance dans l'histoire de la grille.
alter table public.sessions
  add column grid_version integer not null default 1 check (grid_version >= 1);

-- ---------------------------------------------------------------------------
-- La grille n'est plus qu'une identite
-- ---------------------------------------------------------------------------

alter table public.grids
  drop column name,
  drop column accent_color,
  drop column rest_seconds;

-- ---------------------------------------------------------------------------
-- Helpers de propriete et RLS
-- ---------------------------------------------------------------------------

create or replace function public.owns_grid_version(v uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_grid((select gv.grid_id from public.grid_versions gv where gv.id = v));
$$;

-- owns_level remonte desormais par la version.
create or replace function public.owns_level(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_grid_version(
    (select lv.grid_version_id from public.levels lv where lv.id = l)
  );
$$;

-- current_level disparait : le niveau en cours depend maintenant du report de
-- publication, et sa regle vit cote applicatif, testee. En garder une seconde
-- ecriture ici reviendrait a maintenir deux verites.
drop function if exists public.current_level(uuid);

alter table public.grid_versions enable row level security;

create policy grid_versions_select_own on public.grid_versions
  for select to authenticated
  using (public.owns_grid(grid_id));

create policy grid_versions_insert_own on public.grid_versions
  for insert to authenticated
  with check (public.owns_grid(grid_id));

create policy grid_versions_update_own on public.grid_versions
  for update to authenticated
  using (public.owns_grid(grid_id))
  with check (public.owns_grid(grid_id));

create policy grid_versions_delete_own on public.grid_versions
  for delete to authenticated
  using (public.owns_grid(grid_id));

-- Les policies de levels passaient par owns_grid(grid_id), colonne disparue.
drop policy if exists levels_select_own on public.levels;
drop policy if exists levels_insert_own on public.levels;
drop policy if exists levels_update_own on public.levels;
drop policy if exists levels_delete_own on public.levels;

create policy levels_select_own on public.levels
  for select to authenticated
  using (public.owns_grid_version(grid_version_id));

create policy levels_insert_own on public.levels
  for insert to authenticated
  with check (public.owns_grid_version(grid_version_id));

create policy levels_update_own on public.levels
  for update to authenticated
  using (public.owns_grid_version(grid_version_id))
  with check (public.owns_grid_version(grid_version_id));

create policy levels_delete_own on public.levels
  for delete to authenticated
  using (public.owns_grid_version(grid_version_id));
