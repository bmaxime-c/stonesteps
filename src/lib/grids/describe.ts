/**
 * Libelles derives d'une grille.
 *
 * Ce sont des regles d'affichage, mais elles se testent : l'accord des
 * pluriels et le resume d'un groupe de series se trompent silencieusement, et
 * on ne le voit qu'a la relecture d'une capture d'ecran.
 */

import type { LevelExercise, LevelSet } from './model'

/** Pluriel simple : « 1 serie », « 3 series ». */
export function plural(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/**
 * Initiales d'une grille, pour le badge colore : « Push Day » devient PD.
 *
 * Les mots d'une lettre sont ecartes — « Jour J » donnerait JJ, pas JO — et
 * les parentheses ne comptent pas comme des lettres.
 */
export function initials(name: string): string {
  const words = name
    .replace(/[()]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 1)

  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? name).slice(0, 2).toUpperCase()
}

/**
 * Resume des series d'un exercice.
 *
 * Le mode de la premiere serie fait foi : un exercice melange rarement les
 * modes, et la maquette resume sur cette hypothese.
 *
 *   3 series · 15/15/12 reps
 *   2 series · tenir 30s min
 *   1 serie · 10 reps en 30s max
 */
export function describeSets(sets: LevelSet[]): string {
  if (sets.length === 0) return 'Aucune série'

  const count = plural(sets.length, 'série')
  const first = sets[0]

  if (first.timerMode === 'minimal') {
    return `${count} · tenir ${first.timerSeconds}s min`
  }

  if (first.timerMode === 'strict') {
    return `${count} · ${first.targetReps} reps en ${first.timerSeconds}s max`
  }

  return `${count} · ${sets.map((set) => set.targetReps).join('/')} reps`
}

/** « 3 exercices · 7 series a ce niveau », avec l'accord qui va bien. */
export function describeLevelContent(exercises: Pick<LevelExercise, 'sets'>[]): string {
  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
  return `${plural(exercises.length, 'exercice')} · ${plural(setCount, 'série')} à ce niveau`
}

/** « repos 60s », ou « sans repos » quand il est desactive. */
export function describeRest(restSeconds: number): string {
  return restSeconds > 0 ? `repos ${restSeconds}s` : 'sans repos'
}

/** Date courte a la francaise : « 11 aout ». */
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

export function shortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/**
 * Nom d'une grille dupliquee.
 *
 * Suffixe explicite plutot qu'un nom identique : deux grilles homonymes dans
 * la meme liste ne se distinguent plus, et l'issue demande « un nouveau nom ».
 * Dupliquer une copie numerote, plutot que d'empiler les suffixes.
 */
export function copyName(name: string): string {
  const trimmed = name.trim()
  const match = trimmed.match(/^(.*) \(copie(?: (\d+))?\)$/)

  if (!match) return `${trimmed} (copie)`

  const base = match[1]
  const rank = match[2] ? Number(match[2]) : 1
  return `${base} (copie ${rank + 1})`
}
