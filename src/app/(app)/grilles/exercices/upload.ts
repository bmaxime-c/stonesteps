import { EXERCISE_IMAGE_BUCKET, fitWithin } from '@/lib/exercises/image'
import { createClient } from '@/lib/supabase/client'

/**
 * Envoi d'une image d'exercice, depuis le navigateur.
 *
 * Isole du formulaire pour que les tests le remplacent : jsdom n'a ni canvas
 * ni Storage.
 */

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
}

/**
 * Reduit l'image et la reencode en WebP, ou en JPEG a defaut.
 *
 * Toute image passe par le canvas, meme deja petite : c'est ce qui retire les
 * metadonnees (position GPS d'une photo de telephone comprise). Certains
 * navigateurs ne savent pas encoder le WebP et rendent alors du PNG, bien plus
 * lourd : on retombe sur le JPEG.
 */
export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D indisponible')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const webp = await encode(canvas, 'image/webp')
  if (webp?.type === 'image/webp') return webp

  const jpeg = await encode(canvas, 'image/jpeg')
  if (!jpeg) throw new Error('Encodage de l image impossible')
  return jpeg
}

/** Envoie l'image au bucket et rend son chemin, ou null en cas d'echec. */
export async function uploadExerciseImage(image: Blob): Promise<string | null> {
  const extension = image.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${crypto.randomUUID()}.${extension}`
  const { error } = await createClient()
    .storage.from(EXERCISE_IMAGE_BUCKET)
    // Un chemin neuf a chaque envoi : l'objet ne change jamais, il se met en
    // cache pour de bon.
    .upload(path, image, { contentType: image.type, cacheControl: '31536000' })
  return error ? null : path
}
