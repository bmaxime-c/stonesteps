-- StoneSteps : amities et partage
--
-- Deux corrections de fond et une fonction de duplication.

-- ---------------------------------------------------------------------------
-- Correction 1 : un demandeur ne doit pas pouvoir accepter sa propre demande
--
-- La policy friendships_update_involved autorise les deux parties a modifier
-- la ligne, et WITH CHECK ne voit que la nouvelle valeur : rien n'empechait le
-- demandeur de passer sa propre demande a 'accepted' et de s'octroyer l'acces
-- aux seances de quelqu'un qui n'a jamais repondu.
--
-- La RLS seule ne sait pas comparer l'ancienne et la nouvelle valeur. Un
-- declencheur, si.
-- ---------------------------------------------------------------------------

create or replace function public.guard_friendship_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Seul le destinataire accepte.
  if new.status = 'accepted' and old.status <> 'accepted' then
    if (select auth.uid()) <> new.addressee_id then
      raise exception 'Seul le destinataire peut accepter une demande';
    end if;
  end if;

  -- Les identites ne changent jamais : sans cela, on pourrait reaffecter une
  -- amitie acceptee a un tiers.
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Les parties d''une amitie ne peuvent pas etre modifiees';
  end if;

  return new;
end;
$$;

create trigger friendships_guard_transition
  before update on public.friendships
  for each row execute function public.guard_friendship_transition();

-- ---------------------------------------------------------------------------
-- Correction 2 : voir une grille, c'est voir le nom de ses exercices
--
-- exercises_select ne laissait lire que le catalogue integre et ses propres
-- exercices. Consulter la grille d'un ami affichait donc « Exercice supprime »
-- partout ou celui-ci avait cree un exercice personnel.
-- ---------------------------------------------------------------------------

drop policy if exists exercises_select on public.exercises;

create policy exercises_select on public.exercises
  for select to authenticated
  using (
    is_builtin
    or owner_id = (select auth.uid())
    or exists (
      select 1
      from public.level_exercises le
      join public.levels l on l.id = le.level_id
      where le.exercise_id = exercises.id
        and public.can_read_grid(l.grid_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Duplication d'une grille entiere
--
-- Copie une grille lisible — la sienne, une publique, une partagee, ou celle
-- d'un ami — vers le compte de l'appelant.
--
-- Les exercices personnels de l'auteur sont recopies dans le catalogue de
-- celui qui duplique, plutot que referencés tels quels. Sans cela, la grille
-- copiee dependrait d'une ligne appartenant a quelqu'un d'autre, que la
-- contrainte ON DELETE RESTRICT empecherait alors de supprimer.
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_grid(p_grid_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_name text;
  v_description text;
  v_new_grid uuid;
  v_level record;
  v_new_level uuid;
begin
  if v_me is null then
    raise exception 'Authentification requise';
  end if;

  -- Lecture soumise a la RLS : on ne duplique que ce qu'on a le droit de voir.
  select name, description into v_name, v_description
  from public.grids
  where id = p_grid_id;

  if v_name is null then
    raise exception 'Grille introuvable ou non autorisee';
  end if;

  insert into public.grids (owner_id, name, description)
  values (v_me, left(v_name || ' (copie)', 100), v_description)
  returning id into v_new_grid;

  -- Table de correspondance des exercices etrangers vers leur copie locale.
  create temporary table if not exists tmp_exercise_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;
  delete from tmp_exercise_map;

  insert into tmp_exercise_map (source_id, target_id)
  select source.id, copy.id
  from (
    select distinct e.id, e.name, e.category
    from public.level_exercises le
    join public.levels l on l.id = le.level_id
    join public.exercises e on e.id = le.exercise_id
    where l.grid_id = p_grid_id
      and not e.is_builtin
      and e.owner_id is distinct from v_me
  ) as source
  cross join lateral (
    insert into public.exercises (owner_id, name, category, is_builtin)
    values (v_me, source.name, source.category, false)
    returning id
  ) as copy;

  for v_level in
    select id, position, name
    from public.levels
    where grid_id = p_grid_id
    order by position
  loop
    insert into public.levels (grid_id, position, name)
    values (v_new_grid, v_level.position, v_level.name)
    returning id into v_new_level;

    insert into public.level_exercises (
      level_id, exercise_id, position, sets, reps, timer_mode, timer_seconds, notes
    )
    select
      v_new_level,
      coalesce(m.target_id, le.exercise_id),
      le.position,
      le.sets,
      le.reps,
      le.timer_mode,
      le.timer_seconds,
      le.notes
    from public.level_exercises le
    left join tmp_exercise_map m on m.source_id = le.exercise_id
    where le.level_id = v_level.id;
  end loop;

  return v_new_grid;
end;
$$;
