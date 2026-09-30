import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  isExerciseEditor,
  loadEditableExercise,
  loadExerciseCategories,
} from '@/lib/exercises/queries'

import { ExerciseForm } from '../exercise-form'

export const metadata: Metadata = { title: "Modifier l'exercice" }

export default async function EditExercisePage({
  params,
}: PageProps<'/grilles/exercices/[id]'>) {
  const { id } = await params
  if (!(await isExerciseEditor())) notFound()

  const [exercise, categories] = await Promise.all([
    loadEditableExercise(id),
    loadExerciseCategories(),
  ])
  if (!exercise) notFound()

  return <ExerciseForm exercise={exercise} categories={categories} />
}
