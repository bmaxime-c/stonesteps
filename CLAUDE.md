# StoneSteps — consignes projet

Application de suivi de progression en callisthénie par niveaux.
Voir `README.md` pour le fonctionnement et l'installation.

## Sources de vérité

L'application est reconstruite à partir de deux documents importés de Claude
Design, à consulter avant toute décision d'interface ou de modèle :

- `handoff.md` — le prompt d'implémentation phasé : stack, conventions,
  schéma cible, charte graphique, critères d'acceptation.
- `design/Callisthenics App.dc.html` — la maquette interactive de référence.
  C'est elle qui tranche sur l'apparence et les micro-comportements.
- `design/Handoff Callisthenie.dc.html` — la spécification détaillée qui
  accompagne la maquette.

Le design system Septeo référencé par la maquette (`_ds/…`) est **délibérément
ignoré** : la charte graphique vient du handoff, pas de lui.

## Suivi du travail

Le reste à faire vit dans le projet GitHub **Stonesteps**
(<https://github.com/users/bmaxime-c/projects/1>), plus dans un fichier du
dépôt.

- Le tableau est **priorisé**. Prendre les cartes de la colonne **Ready** dans
  l'ordre où elles s'y présentent, sans aller en choisir une plus loin parce
  qu'elle paraît plus simple. Si une carte semble mal placée, le dire plutôt que
  de la contourner.
- Passer la carte en **In progress** au moment où le travail commence, pas
  après coup.
- La passer en **In review** dès que le travail est terminé et la PR ouverte.
- **Done** est atteint automatiquement au merge vers `main` : ne jamais y
  déplacer une carte à la main.
- Renseigner sur la carte le lien vers la **branche de travail** et vers la
  **PR**. Une carte brouillon doit d'abord être convertie en issue
  (« Convert to issue »), sinon rien ne peut lui être rattaché et l'automatisme
  du merge ne la verra pas.

## Règle métier centrale

Un niveau n'est validé que si **toutes** les séries de **tous** ses exercices
sont réussies. Une seule série manquée invalide le niveau entier, et la séance
suivante repart de ce même niveau. Toute évolution qui assouplit cette règle
doit être discutée, pas décidée en passant.

Un niveau validé débloque le suivant : on ne saute jamais un niveau. Le niveau
en cours d'une grille se **dérive** de l'historique — c'est le premier niveau
sans séance validée. Ne pas le stocker en colonne.

Le chrono a deux modes, à ne pas confondre :

- `minimal` — il faut **tenir au moins** `timer_seconds` (gainage, descente lente) ;
- `strict` — il faut **finir en au plus** `timer_seconds` (séries explosives).

## Conventions

- Commandes via `just` (`just check` avant de proposer un changement), avec repli
  npm si `just` n'est pas installé.
- Pas de backend séparé : Server Actions + client Supabase. Ne pas réintroduire
  d'API Express.
- Toute table est protégée par RLS. Une nouvelle table sans policy est un bug.
- Les helpers RLS sont en `security definer` pour éviter les récursions entre
  policies ; `auth.uid()` est toujours enveloppé dans un sous-select.
- Le schéma est relationnel. Ne pas stocker les niveaux dans un blob JSONB.
- Commentaires et messages d'interface en français, code et identifiants en
  anglais. Le SQL est en ASCII (pas d'accents dans les migrations).
- Migrations : jamais modifier une migration déjà poussée, en ajouter une.
- Les règles métier vivent dans `src/lib/**`, pures et testées. Un composant ne
  calcule pas de statut.
- Aucune librairie de charts : les visualisations sont du SVG écrit à la main.

## Charte graphique

Thème **unique sombre** — pas de `next-themes`, pas de bascule clair/sombre. La
classe `dark` est posée en dur sur `<html>` uniquement pour activer les
variantes `dark:` des primitives shadcn.

Les couleurs sont déclarées une seule fois en `@theme inline` dans
`src/app/globals.css`. Ne pas les répéter en dur dans les composants.

| Rôle                                     | Valeur                            |
| ---------------------------------------- | --------------------------------- |
| Fond de page                             | `#06120C`                         |
| Surface de carte                         | `#0E1F16`                         |
| Ligne de série / fond interne            | `#081710`                         |
| Chip inactif                             | `#152B1F`                         |
| Accent + statut réussi                   | `#00FF87`                         |
| Statut dépassé                           | `#D4FF3F`                         |
| Statut échoué                            | `#FF2D6F`                         |
| En cours / catégorie secondaire          | `#22E1FF`                         |
| Texte principal / secondaire / tertiaire | `#E8FFF2` / `#9CC4AE` / `#6E9682` |
| Bordures carte / contrôle                | `#1D3A2A` / `#2A5340`             |
| Encre sur néon                           | `#05170E` · `#1A0009` sur rose    |

Deux règles à ne pas enfreindre : les néons sont clairs, donc tout texte posé
dessus est une **encre sombre**, jamais du blanc ; et aucun néon ne sert au
texte courant — il est réservé aux chiffres, aux statuts et aux accents.

Typographie : DM Sans via `next/font/google`, famille unique. Pas de dégradé,
pas d'image : les seuls effets sont des halos `box-shadow`.

## Découpage

Le travail avance par phases, chacune démo-able de bout en bout, une issue et
une PR par phase :

1. **Socle** — charte néon, DM Sans, suppression du hors-périmètre
2. **Schéma Supabase** — reset, grilles et niveaux, RLS, seed
3. **Couche métier** — statuts, chrono, validation de niveau, agrégations
4. **Écran de séance** et résumé
5. **Grilles, niveaux, constructeur et bibliothèque**
6. **Statistiques**
7. **PWA et recette finale**

Ne pas anticiper une phase ultérieure sans que ce soit demandé.

## Hors périmètre

Profil et réglages utilisateur, repos paramétrable par exercice, séance libre
hors progression, allègement automatique après un niveau raté, partage de
grilles, social et liste d'amis, export de données, écriture hors ligne. Ne pas
les anticiper — mais ne pas bloquer la clé naturelle de `session_sets`, qui les
prépare.
