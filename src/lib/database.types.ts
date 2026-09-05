/**
 * Types de la base, ecrits a la main pour l'instant.
 *
 * A remplacer par la generation automatique des que la CLI Supabase est
 * installee sur le poste :
 *   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * La recette `just types` fait exactement cela.
 */

export type TimerMode = 'none' | 'minimal' | 'strict'
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  owner_id: string | null
  name: string
  category: string | null
  is_builtin: boolean
  created_at: string
}

export interface Grid {
  id: string
  owner_id: string
  name: string
  description: string | null
  is_public: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Level {
  id: string
  grid_id: string
  position: number
  name: string | null
}

export interface LevelExercise {
  id: string
  level_id: string
  exercise_id: string
  position: number
  sets: number
  reps: number | null
  timer_mode: TimerMode
  timer_seconds: number | null
  notes: string | null
}

export interface Session {
  id: string
  user_id: string
  grid_id: string
  level_id: string
  started_at: string
  ended_at: string | null
  validated: boolean
}

export interface SetResult {
  id: string
  session_id: string
  level_exercise_id: string
  set_index: number
  success: boolean
  reps_done: number | null
  duration_seconds: number | null
  recorded_at: string
}
