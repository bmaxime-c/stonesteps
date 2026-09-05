-- StoneSteps : duplication de niveau et d'exercice
--
-- Meme motif que les fonctions de reordonnancement : inserer la copie suppose
-- de decaler les positions suivantes, ce qui fait transiter l'unicite par des
-- doublons. Seule une transaction unique le permet, la contrainte etant
-- differee.
--
-- La copie se place juste apres l'original : c'est ce qu'on attend quand on
-- duplique un niveau pour en faire une variante un peu plus dure.

create or replace function public.duplicate_level(p_level_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_grid_id uuid;
  v_position int;
  v_name text;
  v_new_id uuid;
begin
  select grid_id, position, name
  into v_grid_id, v_position, v_name
  from public.levels
  where id = p_level_id;

  if v_grid_id is null then
    raise exception 'Niveau introuvable ou non autorise';
  end if;

  update public.levels
  set position = position + 1
  where grid_id = v_grid_id
    and position > v_position;

  insert into public.levels (grid_id, position, name)
  values (
    v_grid_id,
    v_position + 1,
    case when v_name is null then null else left(v_name || ' (copie)', 200) end
  )
  returning id into v_new_id;

  insert into public.level_exercises (
    level_id, exercise_id, position, sets, reps, timer_mode, timer_seconds, notes
  )
  select v_new_id, exercise_id, position, sets, reps, timer_mode, timer_seconds, notes
  from public.level_exercises
  where level_id = p_level_id;

  return v_new_id;
end;
$$;

create or replace function public.duplicate_level_exercise(p_row_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_level_id uuid;
  v_position int;
  v_count int;
  v_new_id uuid;
begin
  select level_id, position
  into v_level_id, v_position
  from public.level_exercises
  where id = p_row_id;

  if v_level_id is null then
    raise exception 'Exercice introuvable ou non autorise';
  end if;

  select count(*) into v_count
  from public.level_exercises
  where level_id = v_level_id;

  -- La contrainte CHECK sur position refuserait la copie, mais avec un message
  -- illisible. Autant expliquer.
  if v_count >= 10 then
    raise exception 'Un niveau ne peut pas depasser 10 exercices';
  end if;

  update public.level_exercises
  set position = position + 1
  where level_id = v_level_id
    and position > v_position;

  insert into public.level_exercises (
    level_id, exercise_id, position, sets, reps, timer_mode, timer_seconds, notes
  )
  select v_level_id, exercise_id, v_position + 1, sets, reps, timer_mode, timer_seconds, notes
  from public.level_exercises
  where id = p_row_id
  returning id into v_new_id;

  return v_new_id;
end;
$$;
