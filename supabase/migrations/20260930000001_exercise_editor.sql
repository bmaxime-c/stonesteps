-- StoneSteps : editeur du catalogue d'exercices
--
-- Le catalogue integre (owner_id null) cesse d'etre fige par le seed : des
-- editeurs peuvent y ajouter, modifier et supprimer des exercices, chacun avec
-- une categorie et une image.
--
-- Trois changements :
--   1. les categories deviennent une table, parce qu'un editeur doit pouvoir
--      en creer une depuis le formulaire d'exercice — un enum ne s'etend que
--      par migration ;
--   2. le droit d'edition vit dans sa propre table, attribue a la main en
--      base, sans interface pour l'administrer ;
--   3. les images vont dans un bucket Storage public en lecture.
--
-- Un exercice utilise par un niveau, de quelque grille que ce soit, ne se
-- supprime pas : la cle etrangere level_exercises.exercise_id est deja en
-- on delete restrict, et c'est elle qui tranche. L'application se contente de
-- le dire avant.

-- ---------------------------------------------------------------------------
-- Droit d'edition
-- ---------------------------------------------------------------------------

-- Une table a part plutot qu'une colonne de profiles : profiles_update_self
-- laisse chacun reecrire son profil, et une colonne is_editor s'y
-- auto-attribuerait. Ici, aucune policy d'ecriture : seul le SQL Editor (ou la
-- cle de service) ajoute un editeur.
--
--   insert into public.exercise_editors (user_id) values ('<uuid du compte>');
create table public.exercise_editors (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.exercise_editors enable row level security;

-- Chacun sait s'il est editeur, et rien de plus.
create policy exercise_editors_select_self on public.exercise_editors
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_exercise_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.exercise_editors ed
    where ed.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table public.exercise_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 40),
  -- Ordre d'affichage dans la bibliotheque. Les categories creees ensuite se
  -- rangent a la suite.
  position   integer not null check (position >= 1),
  created_at timestamptz not null default now()
);

create unique index exercise_categories_name_key
  on public.exercise_categories (lower(btrim(name)));

-- Les quatre groupes de la maquette, dans son ordre.
insert into public.exercise_categories (name, position)
values
  ('Poussée',          1),
  ('Tirage',           2),
  ('Jambes',           3),
  ('Gainage & skills', 4);

alter table public.exercise_categories enable row level security;

create policy exercise_categories_select on public.exercise_categories
  for select to authenticated
  using (true);

create policy exercise_categories_insert_editor on public.exercise_categories
  for insert to authenticated
  with check (public.is_exercise_editor());

-- Pas de policy de modification ni de suppression : la demande ne porte que
-- sur le choix ou la creation d'une categorie.

-- ---------------------------------------------------------------------------
-- Exercices : categorie et image
-- ---------------------------------------------------------------------------

alter table public.exercises
  add column category_id uuid references public.exercise_categories (id) on delete restrict,
  -- Chemin de l'objet dans le bucket exercise-images, pas une URL : l'URL
  -- publique se reconstruit, et changerait avec le domaine du projet.
  add column image_path text check (image_path is null or length(image_path) between 1 and 200);

update public.exercises ex
set category_id = cat.id
from public.exercise_categories cat
where cat.position = case ex.muscle_group
  when 'push' then 1
  when 'pull' then 2
  when 'legs' then 3
  when 'core' then 4
end;

alter table public.exercises
  alter column category_id set not null,
  drop column muscle_group;

drop type public.muscle_group;

create index exercises_category_idx on public.exercises (category_id);

-- ---------------------------------------------------------------------------
-- Exercices : ecriture du catalogue integre par les editeurs
-- ---------------------------------------------------------------------------

-- Les policies _own existantes restent : elles couvrent les exercices
-- personnels. Celles-ci ne valent que pour owner_id null.
create policy exercises_insert_builtin_editor on public.exercises
  for insert to authenticated
  with check (owner_id is null and public.is_exercise_editor());

create policy exercises_update_builtin_editor on public.exercises
  for update to authenticated
  using (owner_id is null and public.is_exercise_editor())
  with check (owner_id is null and public.is_exercise_editor());

create policy exercises_delete_builtin_editor on public.exercises
  for delete to authenticated
  using (owner_id is null and public.is_exercise_editor());

-- ---------------------------------------------------------------------------
-- Exercices utilises
-- ---------------------------------------------------------------------------

-- Un exercice est utilise des qu'un niveau le reference, brouillon ou publie,
-- dans n'importe quelle grille. La RLS ne laisse voir que ses propres niveaux :
-- sans SECURITY DEFINER, l'editeur croirait libre un exercice que la grille
-- d'un autre emploie, et la suppression buterait sur la cle etrangere.
--
-- Ne rend que des identifiants d'exercices, et seulement a un editeur : rien
-- des grilles elles-memes ne sort.
create or replace function public.used_exercise_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct le.exercise_id
  from public.level_exercises le
  where public.is_exercise_editor();
$$;

-- ---------------------------------------------------------------------------
-- Images
-- ---------------------------------------------------------------------------

-- Public en lecture : les images s'affichent en seance par URL directe, sans
-- signature a renouveler. Elles ne portent rien de personnel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-images',
  'exercise-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- L'ecriture est aux editeurs. La lecture par l'API (et non par l'URL
-- publique) leur est aussi ouverte : la suppression d'un objet la demande.
create policy exercise_images_select_editor on storage.objects
  for select to authenticated
  using (bucket_id = 'exercise-images' and public.is_exercise_editor());

create policy exercise_images_insert_editor on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exercise-images' and public.is_exercise_editor());

create policy exercise_images_update_editor on storage.objects
  for update to authenticated
  using (bucket_id = 'exercise-images' and public.is_exercise_editor())
  with check (bucket_id = 'exercise-images' and public.is_exercise_editor());

create policy exercise_images_delete_editor on storage.objects
  for delete to authenticated
  using (bucket_id = 'exercise-images' and public.is_exercise_editor());
