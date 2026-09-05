# StoneSteps — recettes de developpement
# `just` n'est pas installe sur tous les postes : chaque recette se contente
# d'appeler le script npm equivalent, utilisable directement au besoin.

set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default:
    @just --list

# Serveur de developpement
dev:
    npm run dev

# Verification complete, dans l'ordre du plus rapide au plus lent
check: format-check lint typecheck test build

install:
    npm install

lint:
    npm run lint

lint-fix:
    npm run lint:fix

typecheck:
    npm run typecheck

test:
    npm run test

test-watch:
    npm run test:watch

format:
    npm run format

format-check:
    npm run format:check

build:
    npm run build

# Copie une migration dans le presse-papier, prete a coller dans le SQL Editor.
#   just sql               la plus recente
#   just sql 20260905000006  une version precise
sql version="":
    node scripts/migration-sql.mjs {{version}} --clip

# Regenere src/lib/database.types.ts depuis le schema distant.
# Prerequis : CLI Supabase installee et `supabase login` effectue.
types:
    npx supabase gen types typescript --project-id $(Select-String -Path supabase/config.toml -Pattern 'project_id = "(.+)"').Matches.Groups[1].Value > src/lib/database.types.ts
