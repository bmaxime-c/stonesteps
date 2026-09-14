# Prompt d'implémentation — app de suivi callisthénie (départ de zéro)

> À copier dans votre agent de développement, dans un dossier **vide**.
> Cible : projet neuf déployé sur **Vercel**, base et auth sur **Supabase**.
> Produit : des **grilles de progression** — une grille est une suite ordonnée de niveaux, on valide un niveau en réussissant toutes ses séries.
> Spécification visuelle et fonctionnelle détaillée : `Handoff Callisthenie.dc.html`.
> Maquette interactive de référence : `Callisthenics App.dc.html`.
> Les conventions ci-dessous sont reprises du dépôt **stonesteps** pour qu'un développeur
> passant d'un projet à l'autre ne change pas d'habitudes.

---

## Rôle

Tu démarres un projet **from scratch**. Rien n'existe : pas de code, pas de schéma, pas de projet Supabase configuré. Tu construis le socle, puis l'application, en t'arrêtant à la fin de chaque phase pour me montrer un résultat démo-able de bout en bout. Ne jamais anticiper une phase ultérieure sans que ce soit demandé.

## Stack

| Couche            | Choix                                                                               | Raison                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | **Next.js 16** (App Router, TypeScript strict, Turbopack), React 19                 | Déploiement Vercel sans configuration ; Server Actions pour écrire en base sans backend séparé ; routing par URL nécessaire à l'écran de séance |
| Styles            | **Tailwind CSS 4**, thème déclaré en `@theme inline` dans `src/app/globals.css`     | Le thème tient en une quinzaine de couleurs : des variables CSS suffisent                                                                       |
| Composants        | **shadcn/ui** (style `base-nova`, base Base UI) pour les primitives uniquement      | Séance et statistiques sont du sur-mesure ; ne pas chercher à les composer avec une librairie                                                   |
| Icônes            | **lucide-react**                                                                    | Stroke 2 px, cohérent avec la maquette                                                                                                          |
| Notifications     | **sonner**                                                                          | Retours d'action (plan enregistré, séance consolidée)                                                                                           |
| Données + auth    | **Supabase** — Postgres, Auth, RLS — via `@supabase/supabase-js` et `@supabase/ssr` | Déjà en place côté infra                                                                                                                        |
| Accès aux données | **Server Components** en lecture, **Server Actions** en écriture                    | Pas de backend séparé, pas d'API relais, pas de state manager global                                                                            |
| Tests             | **Vitest** + Testing Library, sur la couche métier (`src/lib`)                      | Les règles de statut et les agrégations sont la partie à prouver                                                                                |
| Graphiques        | **SVG écrit à la main**                                                             | Trois visualisations simples ; aucune librairie de charts                                                                                       |
| Hébergement       | **Vercel**                                                                          | Donné                                                                                                                                           |

Interdits sans validation : state manager global, librairie de charts, ORM par-dessus Supabase, API route qui ne fait que relayer une requête, backend Express. Toute autre dépendance doit m'être demandée avant installation.

Thème unique sombre : pas de `next-themes`, pas de bascule clair/sombre.

## Conventions

- Interface et commentaires en **français**, code et identifiants en **anglais**. Les fichiers `.ts`/`.tsx` et le SQL restent en **ASCII** (pas d'accents dans les commentaires ni les migrations) ; les accents ne vivent que dans les chaînes affichées.
- Prettier : `{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 90, "plugins": ["prettier-plugin-tailwindcss"] }`. ESLint via `eslint-config-next`.
- Alias d'import `@/*` → `./src/*`. Fichiers en kebab-case.
- Schéma **relationnel** : pas de grille ni de niveau stocké en blob JSONB.
- **Règle métier centrale :** un niveau n'est validé que si **toutes** les séries de **tous** ses exercices sont réussies. Une seule série manquée invalide le niveau entier, et la séance suivante repart du même niveau. Toute évolution qui assouplit cette règle se discute, elle ne se décide pas en passant.
- **Toute table est protégée par RLS.** Une table sans policy est un bug. `auth.uid()` est toujours enveloppé dans un sous-select ; les helpers de policy sont en `security definer` pour éviter les récursions entre policies.
- Migrations versionnées `supabase/migrations/<YYYYMMDDHHMMSS>_<nom>.sql`. On n'édite ni ne supprime **jamais** une migration déjà poussée : on en ajoute une.
- Types Supabase générés dans `src/lib/database.types.ts`, jamais écrits à la main.
- Les règles métier vivent dans `src/lib/**`, pures et testées ; les composants ne calculent pas de statut.
- `just check` (format + lint + typecheck + test + build) doit passer avant de me proposer une phase terminée.

---

# Phase 1 — Socle

1. Initialise Next.js 16 (App Router, TypeScript, Tailwind 4, ESLint, Turbopack), Prettier avec `prettier-plugin-tailwindcss`, Vitest + Testing Library + jsdom (`vitest.config.mts`, `vitest.setup.ts`), et `shadcn/ui` (`components.json` : `style: "base-nova"`, `rsc: true`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"`, alias `@/components`, `@/lib`, `@/components/ui`, `@/lib/utils`).

2. Scripts `package.json` :

```
dev · build · start · lint · lint:fix · format · format:check
typecheck      next typegen && tsc --noEmit
test · test:watch
migration:sql  node scripts/migration-sql.mjs
db:status      npx supabase migration list --linked
db:push        npx supabase db push
```

Et un `justfile` où chaque recette appelle le script npm équivalent (`just` n'est pas installé partout), avec `check: format-check lint typecheck test build`, plus `just types` (régénération de `database.types.ts`) et `just sql` (copie une migration dans le presse-papier).

3. Arborescence cible :

```
src/app/                      routes (voir phases 4-6)
src/app/globals.css           thème Tailwind
src/proxy.ts                  remplace middleware.ts (convention Next 16)
src/components/ui/            primitives shadcn
src/lib/env.ts                variables d'environnement validees au chargement
src/lib/utils.ts              cn()
src/lib/database.types.ts     genere
src/lib/supabase/             client.ts (navigateur) · server.ts (RSC/actions) · proxy.ts (session)
src/lib/grids/                queries.ts · validation.ts (+ .test.ts)
src/lib/session/              status.ts · level.ts · timer.ts · queries.ts · local-store.ts · use-wake-lock.ts
src/lib/stats/                aggregate.ts (+ .test.ts)
supabase/migrations/          migrations SQL
scripts/migration-sql.mjs     repli SQL Editor
public/                       manifest.webmanifest · sw.js · icons/
```

4. Variables d'environnement — `.env.example` committé, `.env.local` ignoré :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Validées au chargement dans `src/lib/env.ts`, avec `process.env.X` écrit **en toutes lettres** (un accès dynamique ne serait pas substitué par Next et vaudrait `undefined` côté client) et un message d'erreur explicite renvoyant vers `.env.example`. La clé secrète (`sb_secret_…`) n'est pas nécessaire au fonctionnement, contourne la RLS, et n'apparaît nulle part dans le code applicatif. Les deux mêmes variables sont à saisir sur Vercel dans _Settings → Environment Variables_ pour les trois environnements.

5. Clients Supabase : `client.ts` (navigateur), `server.ts` (recréé à chaque requête, jamais mis en cache dans une variable de module, l'écriture de cookie depuis un Server Component est avalée en `try/catch` car le rafraîchissement est assuré par le proxy), `proxy.ts` (`updateSession`). `src/proxy.ts` appelle `updateSession` et exclut du matcher les fichiers statiques, `sw.js`, `manifest.webmanifest`, `icons/` et les images.

6. Auth : routes `(auth)/login` et `(auth)/signup` (e-mail + mot de passe), `auth/callback`, actions dans `(auth)/actions.ts`, état de formulaire typé dans `(auth)/auth-state.ts`. Toute route applicative sans session redirige vers `/login`. À configurer une fois côté Supabase : _Authentication → URL Configuration_, ajouter `http://localhost:3000/auth/callback` et l'URL Vercel équivalente aux _Redirect URLs_.

7. Base de données en CI : workflow `.github/workflows/migrations.yml` qui joue `supabase db push` **au merge sur `main`**, avec pour seul secret de dépôt `SUPABASE_DB_URL` (chaîne de connexion URI, variante **session pooler**, compatible IPv4 comme les runners GitHub). Sur une pull request, le workflow ne pousse rien : il liste l'écart (`supabase migration list`), fait une poussée à blanc, et échoue si la PR modifie ou supprime une migration déjà sur `main`. Ne pas connecter l'intégration GitHub de Supabase (son application au merge suppose le Branching, payant).

8. `README.md` : stack, démarrage (`npm install`, `cp .env.example .env.local`, `npm run dev`), tableau des variables d'environnement et où les trouver, liaison Supabase (`npx supabase login` puis `npx supabase link --project-ref <project_id>`), `npm run db:status` / `npm run db:push`, repli SQL Editor via `npm run migration:sql -- --clip`, tableau des migrations, tableau `just` ↔ npm. Écris aussi un `CLAUDE.md` court : règles métier centrales, conventions, découpage en phases.

9. Premier déploiement Vercel en production affichant l'écran de connexion.

**Livrable :** je crée un compte et je me connecte, en local et sur l'URL Vercel ; `just check` passe.

# Phase 2 — Schéma Supabase

Trois migrations : schéma, policies RLS, seed du catalogue.

```sql
create type public.timer_mode as enum ('none', 'minimal', 'strict');
-- none    : pas de chrono
-- minimal : il faut TENIR au moins timer_seconds (gainage, descente lente)
-- strict  : il faut FINIR en au plus timer_seconds (series explosives)

create type public.set_status as enum ('success', 'surpass', 'fail');
create type public.muscle_group as enum ('push', 'pull', 'legs', 'core');
```

Tables :

- `profiles` — `id` (FK `auth.users`, cascade), `display_name`, `created_at`, `updated_at`. Créée à l'inscription par un trigger `on_auth_user_created` en `security definer` (`set search_path = public`).
- `exercises` — catalogue. `id`, `name`, `group` (`muscle_group`), `owner_id` nullable (`null` = exercice intégré, visible de tous), `created_at`.
- `grids` — `id`, `owner_id` not null, `name`, `accent_color` (text, hex), `rest_seconds` (int not null default 15, `check between 0 and 300`), `created_at`, `updated_at`.
- `levels` — `id`, `grid_id` (cascade), `position` int not null, unique `(grid_id, position)` en contrainte déférable.
- `level_exercises` — `id`, `level_id` (cascade), `exercise_id`, `position` int not null, unique `(level_id, position)` déférable.
- `level_sets` — `id`, `level_exercise_id` (cascade), `position` int not null, `target_reps` (int not null default 10, `check >= 0`), `timer_mode` not null default `none`, `timer_seconds` int null (`check timer_seconds is null or timer_seconds >= 5`), plus le check de cohérence : `timer_mode = 'none'` ⇒ `timer_seconds is null`, sinon `timer_seconds not null`.
- `sessions` — `id`, `owner_id`, `grid_id` (`on delete set null`), `level_id` (`on delete set null`), `grid_name` et `level_number` (snapshots), `started_at`, `completed_at` nullable, `validated` boolean not null default false — le verdict tout-ou-rien du niveau.
- `session_sets` — `id`, `session_id` (cascade), `level_set_id` (`on delete set null`), `set_index` int not null, `exercise_name` (snapshot), `set_label`, `unit` (text `check in ('reps','s')`), `target_value` int, `actual_value` int, `status` (`set_status`). **Clé naturelle** `unique (session_id, level_set_id, set_index)` : c'est elle qui rendra une éventuelle synchronisation hors ligne idempotente.

Un helper `public.set_updated_at()` alimente les triggers `updated_at`.

**Niveau en cours d'une grille :** il se _dérive_, il ne se stocke pas. C'est le premier niveau sans séance validée — expose-le par une vue ou une fonction `public.current_level(grid_id uuid)`, pas par une colonne `current_level` qu'il faudrait tenir à jour.

Index : `grids(owner_id)`, `levels(grid_id, position)`, `level_exercises(level_id, position)`, `level_sets(level_exercise_id, position)`, `sessions(owner_id, started_at desc)`, `sessions(grid_id, level_id)`, `session_sets(session_id)`.

RLS : propriétaire seul en lecture/écriture sur `grids`, `sessions` et tous leurs descendants ; les policies des tables enfants remontent au propriétaire par un helper `security definer` (`public.owns_grid(uuid)`, `public.owns_level(uuid)`, `public.owns_session(uuid)`) plutôt qu'en référençant directement une autre table protégée. `exercises` : lecture si `owner_id is null or owner_id = (select auth.uid())`, écriture limitée à ses propres exercices.

Seed : les exercices de la bibliothèque de la maquette, groupés en `push` / `pull` / `legs` / `core` (reprends la liste de `Callisthenics App.dc.html`).

**Livrable :** migrations poussées, `database.types.ts` régénéré, et la preuve qu'un utilisateur A ne lit pas les grilles d'un utilisateur B.

# Phase 3 — Métier et tests

Avant toute interface, écris et teste dans `src/lib` :

- `session/status.ts` — statut d'une série :

| Type de série | Grandeur comparée           | success                 | surpass                        | fail                            |
| ------------- | --------------------------- | ----------------------- | ------------------------------ | ------------------------------- |
| `none`        | reps effectuées vs objectif | égal                    | supérieur                      | inférieur                       |
| `minimal`     | secondes tenues vs objectif | égal                    | supérieur                      | inférieur                       |
| `strict`      | secondes écoulées vs limite | terminé avant la limite | terminé sous 50 % de la limite | limite atteinte sans validation |

- `session/timer.ts` — chrono et repos pilotés par un temps injecté (testable sans horloge réelle) : croissant en `minimal`, décroissant en `strict` avec clôture automatique en `fail` à zéro, compte à rebours de repos.
- `session/level.ts` — **validation du niveau, tout ou rien** : `validated = results.every(r => r.status !== 'fail')`. Une seule série échouée invalide le niveau entier. Et `currentLevel(grid, sessions)` = premier niveau sans séance validée ; un niveau validé débloque le suivant, on ne saute jamais un niveau.
- `grids/validation.ts` — une grille valide a un nom non vide, au moins un niveau, au moins un exercice par niveau, au moins une série par exercice, et la cohérence `timer_mode` / `timer_seconds`.
- `stats/aggregate.ts` — KPI (séances, niveaux validés, reps cumulées, taux de réussite), niveau atteint au fil des séances par grille, tentatives et date de validation par niveau, progression par exercice, répartition des statuts, régularité sur 35 jours. Taux de réussite = `(success + surpass) / total` : les dépassements comptent comme réussites **dans ce KPI uniquement**.

Une série échouée est enregistrée telle quelle — aucune reprise immédiate, et la séance continue jusqu'au bout : c'est le verdict de fin de séance qui statue sur le niveau. Après un niveau non validé, la séance suivante rejoue le **même** niveau, à l'identique — aucun allègement automatique.

**Livrable :** suite Vitest verte couvrant les trois types de série, la clôture automatique d'une série `strict`, la règle tout-ou-rien (y compris le cas « tout réussi sauf une série »), le calcul du niveau en cours, et chaque agrégation.

# Phase 4 — Écran de séance

Cœur du produit, à traiter avant les écrans de gestion. Route dédiée `/seance/[gridId]` — la séance porte sur le **niveau en cours** de la grille, et un rafraîchissement ne doit pas en perdre le contexte. Mode plein écran sans navigation globale, pensé pour être lu à bout de bras : gros chiffres, gros boutons, contraste élevé. Découpage : `page.tsx` (Server Component, charge la grille et son niveau en cours) → `session-runner.tsx` (orchestration client) → `set-runner.tsx` (contrôle d'une série) → `actions.ts` (consolidation).

- En-tête : badge « Niveau 4/12 » suivi de « Exercice i/n · Série j/m », croix de sortie avec confirmation explicite (progression abandonnée, le niveau reste à repasser), barre de progression sur le total de séries **du niveau**.
- Rien n'annonce la perte du niveau en pleine séance : une série manquée affiche son statut, l'utilisateur termine ses séries, le verdict tombe au résumé.
- **Série sans chrono** : compteur initialisé **à l'objectif** (hypothèse « réussi », l'utilisateur corrige à la marge), encadré de deux boutons ronds de 64 px (−/+, plancher 0, pas de plafond), chiffre en ~88 px coloré selon le statut calculé en direct, pastille de statut sous le compteur, bouton pleine largeur « Valider la série ».
- **Séries chronométrées** : anneau de progression SVG (rayon 96, trait 14), valeur au centre en HTML superposé, jamais en `<text>` SVG. `minimal` : chrono croissant, statut qui évolue en direct (échoué → réussi → dépassé). `strict` : compte à rebours, statut neutre « En cours » pendant l'effort, statut définitif calculé à la validation. Un seul bouton : « Démarrer le chrono » puis « Terminé ».
- Ne jamais afficher simultanément le compteur de reps et l'anneau.
- **Repos** : après chaque validation, si `rest_seconds > 0` et que ce n'était pas la dernière série de la séance, écran de repos plein écran — compte à rebours géant en cyan, rappel de la prochaine série, bouton « Passer le repos », retour automatique à expiration.
- Centralise l'arrêt des timers dans un helper unique appelé à la sortie de séance, au retour à l'accueil et au démontage : aucun intervalle ne survit à la fin de la séance.
- `use-wake-lock.ts` pour `Screen Wake Lock`, et retour haptique en fin de chrono.

La séance se déroule **côté client** ; `session/local-store.ts` conserve l'état en cours dans `sessionStorage` pour survivre à un rafraîchissement. Une seule écriture en base à la fin, via une Server Action qui insère `sessions` + `session_sets` en une transaction (fonction Postgres si nécessaire). Une séance interrompue n'est pas sauvegardée.

Puis le **résumé**, ouvert par le **verdict de niveau** : bandeau pleine largeur « Niveau 4 validé » sur vert néon ou « Niveau 4 non validé » sur rose, encre sombre, avec un sous-titre factuel (« Prochaine séance : niveau 5 », ou « 2 séries manquées — la prochaine séance repart du niveau 4 »). Puis trois compteurs (réussies / dépassées / échouées), la liste des séries avec exercice, libellé, `effectué / objectif` et pastille colorée, et le retour à l'accueil.

**Livrable :** une séance complète jouable de bout en bout sur une grille créée en SQL, consolidée en base, avec le bon verdict dans les deux cas (toutes séries réussies, et une série manquée).

# Phase 5 — Grilles et niveaux

Routes `/` (accueil), `/grilles/[id]`, `/grilles/[id]/modifier`, `/grilles/nouvelle` ; queries dans `src/lib/grids/queries.ts`, écritures dans `src/app/grilles/actions.ts` avec un état d'action typé (`action-state.ts`).

- **Accueil** : grilles en cartes — badge d'initiales coloré (« Push Day » → PD), nom, « n exercices · m séries à ce niveau » avec accord correct, chevron, puis une barre de progression fine et l'étiquette « Niveau 4/12 ».
- **Détail grille** : sous-titre « Niveau 4 sur 12 · repos 60s », puis une **frise des niveaux** en pastilles carrées de 38 px — validé (fond accent, encre sombre), en cours (contour accent, fond transparent), verrouillé (fond `#081710`, texte tertiaire) ; la pastille sélectionnée porte un contour clair. Taper une pastille montre le contenu de ce niveau. Sous la frise : les exercices du niveau sélectionné avec leur résumé de séries (`3 séries · 15/15/12 reps`, `2 séries · tenir 30s min`, `1 série · 10 reps en 30s max`). Le CTA « Commencer le niveau 4 » n'apparaît que sur le niveau en cours ; un niveau validé affiche « Niveau validé le 11 août », un niveau plus loin « Niveau verrouillé — validez d'abord le niveau 4 ».
- **Constructeur** : nom de la grille ; « Repos entre les séries » optionnel par pas de 15 s de 0 à 300 s, affiché « désactivé » à 0 ; une **rangée de niveaux** (pastilles + « + Niveau ») qui sélectionne le niveau édité, avec « Supprimer ce niveau » quand il y en a plus d'un et « Dupliquer le niveau précédent » sur un niveau vide — c'est la façon normale de construire une grille, un cran de charge à la fois. Puis, pour le niveau sélectionné : une carte par exercice (badge, nom, suppression) et une ligne par série avec libellé, pas de reps (−/+), chip de mode **cyclable** `Sans chrono → Tenir au moins → Faire en max`, pas de secondes (−/+, pas de 5 s, plancher 5 s) visible seulement en mode chronométré, action « Retirer ». **Masque le pas de reps en mode `minimal`** : la valeur n'est lue nulle part. « + Ajouter une série » duplique la dernière série de l'exercice. Enregistrer / Annuler, suppression de la grille en édition avec confirmation (elle emporte la progression).
- **Bibliothèque** : catalogue groupé Poussée / Tirage / Jambes / Gainage & skills en grille responsive ; un tap ajoute l'exercice **au niveau en cours d'édition** avec une série par défaut (10 reps, sans chrono) et revient au constructeur.

Le constructeur travaille sur un brouillon client et enregistre en une Server Action (remplacement complet des `levels` / `level_exercises` / `level_sets` de la grille, en transaction). Modifier un niveau déjà validé ne réécrit pas l'historique : les séances passées gardent leurs snapshots.

# Phase 6 — Statistiques

Route `/stats`, alimentée par les `sessions` et `session_sets` consolidés ; agrégations en `src/lib/stats/aggregate.ts`, rendu en SVG.

- **KPI** : séances, niveaux validés, répétitions cumulées, taux de réussite.
- **Progression** avec bascule « Par exercice » / « Par grille », sélecteur en chips au-dessus du graphique. Par exercice : reps effectuées vs objectif au fil des séances, courbe pleine + pointillée d'objectif, un point par séance coloré selon son statut. Par grille : **niveau atteint au fil des séances**, courbe en escalier, un point par séance — vert si le niveau a été validé, rose sinon.
- **Niveaux — {grille}** : une ligne par niveau tenté, avec une barre proportionnelle au nombre de tentatives et la méta « 3 tentatives · validé le 11 août » ou « 2 tentatives · en cours ». C'est la vue qui montre où l'utilisateur bloque.
- **Répartition** réussi / dépassé / échoué en barres, hauteur relative au maximum.
- **Régularité** : grille 7 colonnes sur les 35 derniers jours, case pleine si une séance a eu lieu.

# Phase 7 — PWA et finitions

`public/manifest.webmanifest` (nom, icônes 192/512 maskable, `display: standalone`, `theme_color: #06120C`), `public/sw.js` qui ne met en cache que la coquille applicative et **ne s'active qu'en production**, page `/offline`, et un composant client `service-worker-register.tsx` monté dans le layout. Icônes en PNG 192/512 (le SVG n'est pas accepté partout). Vérifie l'installabilité et le rendu à 360 px.

---

## Thème visuel

Interface sombre, vert néon dominant. Pas de dégradé, pas d'image ; les seuls effets sont des halos `box-shadow` sur les éléments actionnables et les pastilles de statut. Déclare ces valeurs une fois dans `@theme inline` (`globals.css`), documente le raisonnement en commentaire de tête comme dans StoneSteps, et ne les répète pas en dur dans les composants. Distingue les couleurs d'**interface** (aplats avec encre sombre par-dessus) des couleurs de **données** (traits de 2 px qui doivent tenir seuls contre la surface) si un néon ne passe pas en trait.

| Rôle                                     | Valeur                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| Fond de page                             | `#06120C`                                               |
| Surface de carte                         | `#0E1F16`                                               |
| Ligne de série / fond interne            | `#081710`                                               |
| Chip inactif                             | `#152B1F`                                               |
| Accent + statut réussi                   | `#00FF87`                                               |
| Statut dépassé                           | `#D4FF3F`                                               |
| Statut échoué                            | `#FF2D6F`                                               |
| En cours / catégorie secondaire          | `#22E1FF`                                               |
| Texte principal / secondaire / tertiaire | `#E8FFF2` / `#9CC4AE` / `#6E9682`                       |
| Bordures                                 | `#1D3A2A` (carte) / `#2A5340` (contrôle)                |
| Encre sur néon                           | `#05170E` (sur vert, cyan, lime) · `#1A0009` (sur rose) |
| Halo d'action                            | `0 0 24–34px rgba(0,255,135,.35)`                       |
| Halo de statut                           | `0 0 26px {statusColor}66`                              |

Règle de contraste : les néons sont clairs, donc tout texte posé dessus est une encre sombre, jamais du blanc. Les néons ne servent jamais au texte courant — uniquement aux chiffres, statuts et accents. Toute paire de texte doit tenir au-delà de 4,5:1.

Typographie : une seule famille sans-serif géométrique. Titres d'écran `clamp(26px, 4vw, 34px)` en 700, `letter-spacing: -0.02em` ; corps 14–15 px ; libellés 12–13 px. Chiffres de séance : reps 88 px / 800, chrono 52 px / 800.

Formes : cartes en rayon 20 px, lignes internes 14 px, boutons et chips en pilule. Cibles tactiles : 34 px minimum dans le constructeur, 64 px pour les pas de reps en séance.

Responsive mobile-first sans media query : conteneurs à largeur maximale (1040 px accueil et stats, 760 px constructeur, 720 px détail et résumé, 620 px séance), gouttières `clamp(16px, 3vw, 32px)`, grilles en `repeat(auto-fit, minmax(…, 1fr))`. L'écran de séance occupe la hauteur de la fenêtre et reste centré sur grand écran.

Navigation : une seule barre supérieure collante, deux destinations — **Accueil** et **Stats**. Les écrans Séance et Résumé la masquent.

## Critères d'acceptation

1. Je crée un compte, me connecte, et ne vois que mes propres grilles et séances — isolation portée par la RLS, pas seulement par filtrage applicatif.
2. Je crée une grille, j'y empile plusieurs niveaux, j'ajoute des exercices depuis la bibliothèque, je règle reps, mode de chrono et secondes par série, j'enregistre, et je retrouve le tout après rechargement.
3. Seul le niveau en cours est lançable ; les niveaux validés et verrouillés sont consultables mais pas jouables.
4. En séance, chaque type de série affiche le bon contrôle, et le statut réussi / dépassé / échoué respecte le tableau de la phase 3.
5. Une série `strict` non validée avant la fin du compte à rebours est clôturée automatiquement en échec.
6. Une séance sans aucune série échouée valide le niveau et débloque le suivant ; une séance avec une seule série échouée ne le valide pas et la séance suivante repart du même niveau.
7. Le résumé annonce le verdict du niveau avant tout le reste, puis liste toutes les séries avec leur statut.
8. Le repos ne s'affiche que si `rest_seconds > 0`, jamais après la dernière série, et peut être passé.
9. Les statistiques sont à jour immédiatement après la séance, y compris le niveau atteint et le compteur de tentatives.
10. Aucun timer ne continue à tourner après la sortie de séance.
11. Toute l'interface est utilisable à 360 px comme à 1440 px, sans défilement horizontal.
12. `just check` passe, et le déploiement Vercel de production fonctionne avec les deux variables d'environnement.

## Hors périmètre

Profil et réglages utilisateur, repos paramétrable par exercice, séance libre hors progression, allègement automatique après un niveau raté, partage de grilles, export de données, écriture hors ligne. Ne les anticipe pas — mais ne bloque pas la clé naturelle de `session_sets`, qui les prépare.
