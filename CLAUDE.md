# StoneSteps — consignes projet

Application de suivi de progression en callisthénie par niveaux.
Voir `README.md` pour le fonctionnement et l'installation.

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

## Découpage

Le travail avance par phases, chacune démo-able de bout en bout :
socle (fait) → éditeur → séance → historique → social.
Ne pas anticiper une phase ultérieure sans que ce soit demandé — le schéma
prévoit déjà les tables sociales, c'est suffisant.
