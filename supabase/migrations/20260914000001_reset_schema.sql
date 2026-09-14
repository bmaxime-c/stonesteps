-- StoneSteps : remise a plat du schema applicatif
--
-- L'application est reconstruite sur la maquette Claude Design et le handoff.
-- Le modele precedent (social, historique, grille active) n'a plus de
-- correspondance dans le nouveau, et une migration incrementale reviendrait a
-- reecrire chaque table : on repart du schema vide.
--
-- Les six migrations precedentes ne sont ni modifiees ni supprimees, comme le
-- veut la regle. Elles restent l'histoire de ce qui a ete pousse ; c'est cette
-- migration-ci qui defait leur effet.
--
-- Ce qui disparait : profiles, exercises, grids, levels, level_exercises,
-- sessions, set_results, friendships, grid_shares, les enums timer_mode et
-- friendship_status, et toutes les fonctions et policies associees.
--
-- Ce qui survit : auth.users. Les comptes existants restent valides, leurs
-- donnees applicatives non. Le trigger d'inscription est pose sur auth.users,
-- donc hors du schema public : il est retire explicitement avant le drop.

drop trigger if exists on_auth_user_created on auth.users;

-- Drop total plutot qu'une liste d'objets a tenir a jour : une enumeration
-- oubliee laisserait une fonction orpheline derriere elle.
drop schema public cascade;
create schema public;

alter schema public owner to postgres;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
