# StoneSteps

Suivi de progression en callisthénie par niveaux.

Une grille est une suite de niveaux ; chaque niveau contient 1 à 10 exercices,
chacun avec ses séries, ses répétitions et, si besoin, un chrono. On ne monte
d'un niveau que lorsque **toutes** les séries de **tous** les exercices sont
réussies. La séance suivante reprend au dernier niveau non validé.

## État d'avancement

| Phase | Contenu                                                                 | Statut  |
| ----- | ----------------------------------------------------------------------- | ------- |
| 1     | Socle : Next.js, Supabase, schéma + RLS, authentification, coquille PWA | ✅ fait |
| 2     | Éditeur de grilles                                                      | à venir |
| 3     | Exécution de séance, chrono, hors ligne                                 | à venir |
| 4     | Historique et progression                                               | à venir |
| 5     | Amis, partage de grilles                                                | backlog |

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

⚠️ **L'intégration GitHub de Supabase ne les applique pas au merge** — constaté
le 2026-09-05, la question est ouverte dans `TODO.md`. En attendant, il faut les
jouer à la main. Pour éviter de reconstruire le bloc à chaque fois :

```bash
npm run migration:sql -- --clip                 # la plus récente
npm run migration:sql -- 20260905000006 --clip  # une version précise
npm run migration:sql -- --all                  # toutes, sur la sortie standard
```

Le script enveloppe la migration dans une transaction et enregistre sa version
dans `supabase_migrations.schema_migrations`, pour que l'intégration ne la
rejoue pas plus tard. Avec `--clip`, il ne reste qu'à coller dans le
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

## Notes

- Le fichier `src/proxy.ts` remplace `middleware.ts` : c'est la convention
  Next 16. Il rafraîchit la session Supabase et protège les routes privées.
- Le service worker (`public/sw.js`) ne met en cache que la coquille de
  l'application et ne s'active qu'en production. Le cache des données de séance
  arrive en phase 3.
- Les icônes PWA sont en SVG. À convertir en PNG 192/512 si l'installation doit
  être garantie sur les navigateurs qui n'acceptent pas le SVG.
