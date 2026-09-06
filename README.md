# StoneSteps

Suivi de progression en callisthénie par niveaux.

Une grille est une suite de niveaux ; chaque niveau contient 1 à 10 exercices,
chacun avec ses séries, ses répétitions et, si besoin, un chrono. On ne monte
d'un niveau que lorsque **toutes** les séries de **tous** les exercices sont
réussies. La séance suivante reprend au dernier niveau non validé.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS 4** + **shadcn/ui** (Base UI)
- **Supabase** — Postgres, Auth, Row Level Security
- **Vitest** + Testing Library
- Hébergement visé : **Vercel**

Pas de backend séparé : les Server Actions Next.js et l'API Supabase suffisent.

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis renseigner les deux variables
npm run dev
```

### Variables d'environnement

| Variable                               | Où la trouver                                     |
| -------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project Settings → API → _Project URL_ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → **API Keys** → clé `sb_publishable_…`  |

`.env.local` n'est jamais versionné. La clé secrète (`sb_secret_…`) n'est **pas**
nécessaire au fonctionnement de l'application : elle contourne la RLS et ne sert
qu'à d'éventuels scripts d'administration.

Sur Vercel, les deux mêmes variables sont à saisir dans _Settings → Environment
Variables_.

## Base de données

Les migrations sont dans `supabase/migrations/`.

Elles sont appliquées **au merge sur `main`** par le workflow
`.github/workflows/migrations.yml` : la CLI Supabase se lie au projet et joue
`supabase db push`. L'intégration GitHub de Supabase n'est pas le mécanisme
d'application : son app est installée côté GitHub, mais aucun dépôt n'est
connecté au projet Supabase (constaté le 2026-09-05), et son application au
merge suppose de toute façon le Branching, payant. Ne pas la connecter sans
retirer ce workflow.

Le workflow demande un seul secret de dépôt (_Settings → Secrets and variables →
Actions_), `SUPABASE_DB_URL` : la chaîne de connexion complète, prise dans
Supabase → Project Settings → Database → _Connection string_, onglet **URI**,
variante **session pooler** (compatible IPv4, comme les runners GitHub), avec
`[YOUR-PASSWORD]` remplacé par le mot de passe de la base.

Un access token Supabase ferait aussi l'affaire, mais il n'est pas scopé : il
vaut pour le compte entier, alors que cette URL n'ouvre que cette base.

Sur une pull request, le workflow ne pousse rien : il liste l'écart avec la base
(`supabase migration list`), fait une poussée à blanc, et échoue si la PR modifie
ou supprime une migration déjà sur `main`.

Pour tester une migration **avant** le merge — local et preview partagent la même
base —, l'appliquer à la main :

```bash
npm run db:status   # ce qui manque sur la base distante
npm run db:push     # applique les migrations manquantes
```

La CLI Supabase n'a pas besoin d'être installée — `npx` la récupère — mais il
faut l'avoir authentifiée une fois : `npx supabase login`, puis
`npx supabase link --project-ref <project_id de supabase/config.toml>`.

Sans CLI Supabase installée, le repli reste le SQL Editor :

```bash
npm run migration:sql -- --clip                 # la plus récente
npm run migration:sql -- 20260905000006 --clip  # une version précise
npm run migration:sql -- --all                  # toutes, sur la sortie standard
```

Le script enveloppe la migration dans une transaction et enregistre sa version
dans `supabase_migrations.schema_migrations`, pour que la CI ne la rejoue pas au
merge. Avec `--clip`, il ne reste qu'à coller dans le
[SQL Editor](https://supabase.com/dashboard) et lancer.

| Migration                            | Contenu                       |
| ------------------------------------ | ----------------------------- |
| `…000001_init_schema.sql`            | tables, contraintes, triggers |
| `…000002_rls_policies.sql`           | Row Level Security            |
| `…000003_seed_builtin_exercises.sql` | catalogue d'exercices intégré |

Modèle : `profiles`, `exercises`, `grids` → `levels` → `level_exercises`,
`sessions` → `set_results`, `friendships`, `grid_shares`.

Deux points structurants :

- `set_results` porte une clé naturelle `(session_id, level_exercise_id, set_index)`.
  C'est elle qui rendra la synchronisation hors ligne idempotente en phase 3.
- Le mode de chrono est un enum : `none`, `minimal` (tenir ≥ N secondes) ou
  `strict` (finir en ≤ N secondes).

### À configurer une fois dans le dashboard Supabase

- **Authentication → URL Configuration** : ajouter `http://localhost:3000/auth/callback`
  et l'URL Vercel équivalente dans les _Redirect URLs_.
- **Authentication → Providers → Google** : à activer pour que le bouton
  « Continuer avec Google » fonctionne. Tant que ce n'est pas fait, le bouton
  renvoie une erreur explicite ; la connexion par e-mail, elle, fonctionne.

## Commandes

Avec [`just`](https://github.com/casey/just) si installé, sinon directement en npm :

| `just`           | npm                               |                                                             |
| ---------------- | --------------------------------- | ----------------------------------------------------------- |
| `just dev`       | `npm run dev`                     | serveur de développement                                    |
| `just check`     | —                                 | format + lint + types + tests + build                       |
| `just lint`      | `npm run lint`                    | ESLint                                                      |
| `just typecheck` | `npm run typecheck`               | `next typegen` puis `tsc --noEmit`                          |
| `just test`      | `npm run test`                    | Vitest                                                      |
| `just format`    | `npm run format`                  | Prettier                                                    |
| `just build`     | `npm run build`                   | build de production                                         |
| `just types`     | —                                 | régénère `src/lib/database.types.ts` (CLI Supabase requise) |
| `just sql`       | `npm run migration:sql -- --clip` | copie une migration dans le presse-papier                   |
| `just db-status` | `npm run db:status`               | migrations locales contre base distante                     |
| `just db-push`   | `npm run db:push`                 | applique les migrations manquantes                          |

## Notes

- Le fichier `src/proxy.ts` remplace `middleware.ts` : c'est la convention
  Next 16. Il rafraîchit la session Supabase et protège les routes privées.
- Le service worker (`public/sw.js`) ne met en cache que la coquille de
  l'application et ne s'active qu'en production. Le cache des données de séance
  arrive en phase 3.
- Les icônes PWA sont en SVG. À convertir en PNG 192/512 si l'installation doit
  être garantie sur les navigateurs qui n'acceptent pas le SVG.
