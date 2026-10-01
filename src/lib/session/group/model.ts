/**
 * Formes du domaine, cote salon.
 *
 * Ce que l'application lit d'un salon et de ses membres. Les noms viennent des
 * profils : un participant se reconnait a son nom, pas a son identifiant.
 */

import type { Database } from '@/lib/database.types'

import type { RoomStatus } from './room'

export type RoomStage = Database['public']['Enums']['room_stage']

export type RoomMember = {
  userId: string
  /** Null tant que le participant n'a pas choisi de nom. */
  displayName: string | null
  levelCeiling: number
  declaredCursor: number
  lastStatus: Database['public']['Enums']['set_status'] | null
  joinedAt: string
}

export type Room = {
  id: string
  gridId: string
  /** Version figee a l'ouverture : celle que tout le salon joue. */
  gridVersionId: string
  hostId: string
  /** Null tant que l'hote n'a pas lance. */
  levelId: string | null
  status: RoomStatus
  cursor: number
  stage: RoomStage
  restStartedAt: string | null
  /** Dans l'ordre d'arrivee. */
  members: RoomMember[]
}
