/**
 * Comparaison de deux versions de grille.
 *
 * Sert au moment de publier : ce qui n'a pas bouge en tete de grille reste
 * acquis, le reste se rejoue. C'est le compromis entre deux mauvaises reponses
 * — tout conserver laisserait deverrouiller un niveau dur en le reecrivant,
 * tout remettre a zero effacerait des mois de progression pour une faute de
 * frappe.
 */

import type { Level, LevelExercise, LevelSet } from './model'

/**
 * Deux series sont identiques si elles demandent le meme effort.
 *
 * Les identifiants de ligne ne comptent pas : republier une grille recree les
 * lignes, elles changent d'identifiant sans que rien n'ait bouge pour
 * l'utilisateur.
 */
function sameSet(a: LevelSet, b: LevelSet): boolean {
  return (
    a.targetReps === b.targetReps &&
    a.timerMode === b.timerMode &&
    a.timerSeconds === b.timerSeconds
  )
}

/**
 * Deux exercices sont identiques s'ils designent le meme exercice du catalogue
 * et demandent les memes series, dans le meme ordre.
 *
 * C'est `exerciseId` qui fait foi, pas le nom : renommer un exercice du
 * catalogue ne change pas l'effort demande.
 */
function sameExercise(a: LevelExercise, b: LevelExercise): boolean {
  if (a.exerciseId !== b.exerciseId) return false
  if (a.sets.length !== b.sets.length) return false

  const left = [...a.sets].sort((x, y) => x.position - y.position)
  const right = [...b.sets].sort((x, y) => x.position - y.position)
  return left.every((set, index) => sameSet(set, right[index]))
}

export function sameLevel(a: Level, b: Level): boolean {
  if (a.exercises.length !== b.exercises.length) return false

  const left = [...a.exercises].sort((x, y) => x.position - y.position)
  const right = [...b.exercises].sort((x, y) => x.position - y.position)
  return left.every((exercise, index) => sameExercise(exercise, right[index]))
}

/**
 * Nombre de niveaux identiques depuis le debut, avant la premiere difference.
 *
 * Ajouter un niveau 13 a une grille de douze rend 12 : rien n'a bouge en
 * dessous. Durcir le niveau 5 rend 4 : tout ce qui suit est a refaire.
 */
export function unchangedPrefix(previous: Level[], next: Level[]): number {
  const before = [...previous].sort((a, b) => a.position - b.position)
  const after = [...next].sort((a, b) => a.position - b.position)

  let prefix = 0
  while (prefix < before.length && prefix < after.length) {
    if (!sameLevel(before[prefix], after[prefix])) break
    prefix += 1
  }
  return prefix
}

/**
 * Niveaux reportes lors d'une publication.
 *
 * Le plus petit du prefixe inchange et de ce qui etait deja franchi : on ne
 * donne jamais plus que ce qui avait ete gagne, et on ne reprend jamais ce qui
 * n'a pas change.
 *
 * `reachedLevel` est la position du niveau en cours avant publication ; les
 * niveaux franchis sont donc ceux d'avant lui. Une grille terminee passe
 * `levels.length + 1`.
 */
export function carriedLevels(
  previous: Level[],
  next: Level[],
  reachedLevel: number,
): number {
  return Math.max(0, Math.min(unchangedPrefix(previous, next), reachedLevel - 1))
}
