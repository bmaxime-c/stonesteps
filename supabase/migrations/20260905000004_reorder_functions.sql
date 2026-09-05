-- StoneSteps : reordonnancement atomique
--
-- Les contraintes d'unicite (grid_id, position) et (level_id, position) sont
-- DEFERRABLE INITIALLY DEFERRED : elles ne sont verifiees qu'a la fin de la
-- transaction. C'est indispensable pour reordonner, puisque des positions
-- transitent forcement par des valeurs en doublon.
--
-- Or chaque appel a l'API REST est sa propre transaction : deplacer plusieurs
-- lignes en autant de requetes echouerait des la premiere. Ces fonctions
-- regroupent le reordonnancement complet dans une transaction unique.
--
-- Elles s'executent avec les droits de l'appelant (SECURITY INVOKER, le
-- defaut), donc la RLS s'applique : un membre ne peut reordonner que ce qu'il
-- possede.

create or replace function public.reorder_levels(
  p_grid_id uuid,
  p_level_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_expected int;
  v_given int := coalesce(array_length(p_level_ids, 1), 0);
  v_updated int;
begin
  -- Le tableau doit decrire la totalite des niveaux de la grille : un sous
  -- ensemble laisserait des positions en doublon ou des trous.
  select count(*) into v_expected
  from public.levels
  where grid_id = p_grid_id;

  if v_expected <> v_given then
    raise exception
      'reorder_levels attend les % niveaux de la grille, % recus',
      v_expected, v_given;
  end if;

  if v_given = 0 then
    return;
  end if;

  update public.levels as l
  set position = ordered.position
  from unnest(p_level_ids) with ordinality as ordered(id, position)
  where l.id = ordered.id
    and l.grid_id = p_grid_id;

  get diagnostics v_updated = row_count;

  -- Moins de lignes mises a jour que demande : un identifiant etranger a la
  -- grille, ou filtre par la RLS. On annule plutot que de laisser un ordre
  -- partiel.
  if v_updated <> v_given then
    raise exception
      'reorder_levels : % niveaux reordonnes sur % attendus', v_updated, v_given;
  end if;
end;
$$;

create or replace function public.reorder_level_exercises(
  p_level_id uuid,
  p_row_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_expected int;
  v_given int := coalesce(array_length(p_row_ids, 1), 0);
  v_updated int;
begin
  select count(*) into v_expected
  from public.level_exercises
  where level_id = p_level_id;

  if v_expected <> v_given then
    raise exception
      'reorder_level_exercises attend les % exercices du niveau, % recus',
      v_expected, v_given;
  end if;

  if v_given = 0 then
    return;
  end if;

  update public.level_exercises as le
  set position = ordered.position
  from unnest(p_row_ids) with ordinality as ordered(id, position)
  where le.id = ordered.id
    and le.level_id = p_level_id;

  get diagnostics v_updated = row_count;

  if v_updated <> v_given then
    raise exception
      'reorder_level_exercises : % exercices reordonnes sur % attendus',
      v_updated, v_given;
  end if;
end;
$$;

-- Supprime un niveau et resserre les positions restantes, sans trou.
create or replace function public.delete_level(p_level_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_grid_id uuid;
  v_position int;
begin
  select grid_id, position into v_grid_id, v_position
  from public.levels
  where id = p_level_id;

  if v_grid_id is null then
    raise exception 'Niveau introuvable ou non autorise';
  end if;

  delete from public.levels where id = p_level_id;

  update public.levels
  set position = position - 1
  where grid_id = v_grid_id
    and position > v_position;
end;
$$;

-- Meme principe pour un exercice au sein d'un niveau.
create or replace function public.delete_level_exercise(p_row_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_level_id uuid;
  v_position int;
begin
  select level_id, position into v_level_id, v_position
  from public.level_exercises
  where id = p_row_id;

  if v_level_id is null then
    raise exception 'Exercice introuvable ou non autorise';
  end if;

  delete from public.level_exercises where id = p_row_id;

  update public.level_exercises
  set position = position - 1
  where level_id = v_level_id
    and position > v_position;
end;
$$;

-- Rend une grille active et desactive les autres, en une seule transaction.
-- L'index unique partiel grids_one_active_per_owner interdit de faire
-- autrement en deux requetes.
create or replace function public.set_active_grid(p_grid_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
  from public.grids
  where id = p_grid_id;

  if v_owner_id is null then
    raise exception 'Grille introuvable ou non autorisee';
  end if;

  update public.grids
  set is_active = false
  where owner_id = v_owner_id
    and is_active
    and id <> p_grid_id;

  update public.grids
  set is_active = true
  where id = p_grid_id;
end;
$$;
