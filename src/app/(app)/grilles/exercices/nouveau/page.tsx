import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { isExerciseEditor, loadExerciseCategories } from '@/lib/exercises/queries'

import { ExerciseForm } from '../exercise-form'

export const metadata: Metadata = { title: 'Nouvel exercice' }

export default async function NewExercisePage() {
  if (!(await isExerciseEditor())) notFound()

  const categories = await loadExerciseCategories()
  return <ExerciseForm exercise={null} categories={categories} />
}
