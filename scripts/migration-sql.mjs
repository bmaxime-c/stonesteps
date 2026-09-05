#!/usr/bin/env node
/*
 * Prepare une migration a coller dans le SQL Editor Supabase.
 *
 * Tant que l'integration GitHub n'applique pas les migrations au merge (voir
 * TODO.md), il faut les jouer a la main. Ce script evite de reconstruire le
 * bloc a chaque fois : il enveloppe la migration dans une transaction et
 * enregistre sa version, pour que l'integration ne la rejoue pas plus tard.
 *
 * Usage :
 *   node scripts/migration-sql.mjs                 la plus recente
 *   node scripts/migration-sql.mjs 20260905000006  une version precise
 *   node scripts/migration-sql.mjs --all           toutes, dans l'ordre
 *   node scripts/migration-sql.mjs --clip          copie dans le presse-papier
 *   node scripts/migration-sql.mjs --out fichier.sql
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase', 'migrations')

const args = process.argv.slice(2)
const wantsAll = args.includes('--all')
const wantsClip = args.includes('--clip')
const outIndex = args.indexOf('--out')
const outPath = outIndex === -1 ? null : args[outIndex + 1]
const version = args.find((arg) => /^\d{8,}/.test(arg))

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.error('Aucune migration dans supabase/migrations.')
  process.exit(1)
}

let selected
if (wantsAll) {
  selected = files
} else if (version) {
  selected = files.filter((name) => name.startsWith(version))
  if (selected.length === 0) {
    console.error(`Aucune migration ne commence par ${version}.`)
    console.error('Disponibles :')
    for (const name of files) console.error(`  ${name}`)
    process.exit(1)
  }
} else {
  selected = [files[files.length - 1]]
}

const parts = ['-- StoneSteps : a coller dans le SQL Editor Supabase.', 'begin;', '']

for (const name of selected) {
  parts.push(`-- ${'='.repeat(70)}`)
  parts.push(`-- ${name}`)
  parts.push(`-- ${'='.repeat(70)}`)
  parts.push(readFileSync(join(dir, name), 'utf8').trimEnd())
  parts.push('')
}

const rows = selected
  .map((name) => {
    const [ver, ...rest] = name.replace(/\.sql$/, '').split('_')
    return `  ('${ver}', '${rest.join('_')}')`
  })
  .join(',\n')

parts.push("-- Historique des migrations : sans ces lignes, l'integration GitHub")
parts.push('-- rejouerait les memes migrations et echouerait.')
parts.push('insert into supabase_migrations.schema_migrations (version, name) values')
parts.push(rows)
parts.push('on conflict (version) do nothing;')
parts.push('')
parts.push('commit;')

const sql = parts.join('\n')

if (outPath) {
  writeFileSync(outPath, sql, 'utf8')
  console.error(`Ecrit dans ${outPath}`)
} else if (wantsClip) {
  // clip.exe sous Windows, pbcopy sous macOS, xclip sinon.
  const [command, commandArgs] =
    process.platform === 'win32'
      ? ['clip', []]
      : process.platform === 'darwin'
        ? ['pbcopy', []]
        : ['xclip', ['-selection', 'clipboard']]

  execFileSync(command, commandArgs, { input: sql })
  console.error(
    `Copie dans le presse-papier : ${selected.join(', ')}\n` +
      'Colle dans https://supabase.com/dashboard → SQL Editor → Run.',
  )
} else {
  process.stdout.write(sql)
}
