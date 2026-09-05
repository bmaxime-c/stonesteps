import type { TimerMode } from '@/lib/database.types'

/**
 * Grille de reference, proposee a la creation.
 *
 * Dix niveaux, cinq exercices chacun, avec des variantes de plus en plus
 * techniques : pompes classiques puis pieds sureleves puis claquees, tractions
 * strictes puis controlees puis muscle-up. Le chrono n'apparait que la ou il a
 * un sens — gainage et descentes lentes en `minimal`, series explosives en
 * `strict`.
 *
 * Les noms d'exercices doivent correspondre au catalogue integre
 * (migration `..._seed_builtin_exercises.sql`). Un nom inconnu fait echouer la
 * creation plutot que de produire une grille incomplete.
 */

export interface TemplateExercise {
  exerciseName: string
  sets: number
  reps: number | null
  timerMode: TimerMode
  timerSeconds: number | null
}

export interface TemplateLevel {
  name: string
  exercises: TemplateExercise[]
}

function reps(exerciseName: string, sets: number, count: number): TemplateExercise {
  return { exerciseName, sets, reps: count, timerMode: 'none', timerSeconds: null }
}

function hold(exerciseName: string, sets: number, seconds: number): TemplateExercise {
  return {
    exerciseName,
    sets,
    reps: null,
    timerMode: 'minimal',
    timerSeconds: seconds,
  }
}

function slow(
  exerciseName: string,
  sets: number,
  count: number,
  seconds: number,
): TemplateExercise {
  return {
    exerciseName,
    sets,
    reps: count,
    timerMode: 'minimal',
    timerSeconds: seconds,
  }
}

function fast(
  exerciseName: string,
  sets: number,
  count: number,
  seconds: number,
): TemplateExercise {
  return {
    exerciseName,
    sets,
    reps: count,
    timerMode: 'strict',
    timerSeconds: seconds,
  }
}

export const TEMPLATE_GRID_NAME = 'Progression de reference'

export const TEMPLATE_GRID_DESCRIPTION =
  'Dix niveaux, cinq exercices par niveau. Les variantes se durcissent au fil de la progression, et le chrono apparait la ou il a un sens.'

export const TEMPLATE_LEVELS: TemplateLevel[] = [
  {
    name: 'Prise de contact',
    exercises: [
      reps('Pompes classiques', 3, 8),
      reps('Tractions strictes', 3, 3),
      reps('Dips sur banc', 3, 6),
      reps('Squats classiques', 3, 12),
      hold('Planche (gainage)', 3, 15),
    ],
  },
  {
    name: 'Consolidation',
    exercises: [
      reps('Pompes classiques', 4, 10),
      reps('Tractions strictes', 3, 4),
      reps('Dips sur banc', 3, 8),
      reps('Squats classiques', 4, 15),
      hold('Planche (gainage)', 3, 20),
    ],
  },
  {
    name: 'Introduction du controle',
    exercises: [
      reps('Pompes pieds sureleves', 5, 12),
      slow('Tractions controlees', 3, 5, 20),
      reps('Dips sur barres', 4, 10),
      reps('Squats classiques', 5, 20),
      hold('Planche (gainage)', 3, 30),
    ],
  },
  {
    name: 'Endurance',
    exercises: [
      reps('Pompes pieds sureleves', 4, 15),
      slow('Tractions controlees', 4, 6, 20),
      reps('Dips sur barres', 4, 12),
      reps('Squats classiques', 6, 25),
      hold('Planche laterale', 3, 30),
    ],
  },
  {
    name: 'Explosivite',
    exercises: [
      reps('Pompes pieds sureleves', 3, 20),
      fast('Tractions explosives', 3, 8, 20),
      reps('Dips sur barres', 5, 15),
      reps('Squats pieds sureleves', 5, 30),
      hold('Planche (gainage)', 3, 45),
    ],
  },
  {
    name: 'Puissance',
    exercises: [
      reps('Pompes claquees', 5, 15),
      slow('Tractions controlees', 4, 8, 25),
      reps('Dips sur barres', 4, 20),
      reps('Squats pieds sureleves', 4, 40),
      hold('Planche avec lever de jambe', 3, 20),
    ],
  },
  {
    name: 'Volume',
    exercises: [
      reps('Pompes claquees', 5, 20),
      fast('Tractions explosives', 3, 10, 25),
      reps('Dips sur barres', 5, 25),
      reps('Squats pieds sureleves', 5, 50),
      hold('Planche (gainage)', 3, 90),
    ],
  },
  {
    name: 'Vers le muscle-up',
    exercises: [
      slow('Pompes pieds sureleves', 4, 25, 1),
      slow('Muscle-up negatif', 4, 10, 5),
      reps('Dips sur barres', 6, 30),
      reps('Squats sautes', 6, 60),
      hold('Planche avec lever de jambe', 3, 30),
    ],
  },
  {
    name: 'Maitrise',
    exercises: [
      reps('Pompes claquees', 5, 30),
      reps('Muscle-up', 3, 12),
      reps('Dips sur barres', 5, 40),
      reps('Squats sautes', 5, 80),
      hold('Planche (gainage)', 3, 180),
    ],
  },
  {
    name: 'Densite',
    exercises: [
      fast('Pompes claquees', 10, 15, 60),
      reps('Muscle-up', 5, 15),
      reps('Dips sur barres', 6, 50),
      fast('Squats sautes', 10, 10, 60),
      hold('Handstand contre mur', 5, 30),
    ],
  },
]
