-- StoneSteps : rendre les policies de lecture compatibles avec RETURNING
--
-- Postgres applique la policy SELECT aux lignes rendues par un INSERT ...
-- RETURNING. Or les helpers de lecture introduits par le partage sont
-- `stable` et vont relire la table ou la ligne vient d'etre inseree : ils
-- travaillent sur l'instantane pris avant l'insertion, ou cette ligne n'existe
-- pas encore. La policy repond faux et l'insertion echoue en 42501, alors que
-- le droit d'ecrire est bien la.
--
-- Avant le partage, la policy comparait une colonne — `owner_id = auth.uid()`
-- — et n'avait donc rien a relire. On remet ce cas en tete : le proprietaire
-- est reconnu sans relecture de table, donc sur la ligne en cours
-- d'insertion, et les autres cas continuent de passer par la fonction.
--
-- Les tables filles n'ont pas le probleme : leurs policies remontent par la
-- cle etrangere vers une ligne deja committee, jamais vers celle qui s'insere.

-- Le proprietaire d'abord, en comparaison directe.
drop policy if exists grids_select_readable on public.grids;
create policy grids_select_readable on public.grids
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.can_read_grid(id));

-- Meme principe : `owns_grid(grid_id)` remonte vers `grids`, dont la ligne
-- existe deja quand une version s'insere.
drop policy if exists grid_versions_select_readable on public.grid_versions;
create policy grid_versions_select_readable on public.grid_versions
  for select to authenticated
  using (public.owns_grid(grid_id) or public.can_read_grid_version(id));
