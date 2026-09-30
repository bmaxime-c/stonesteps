/**
 * Images d'exercice.
 *
 * L'image est reduite dans le navigateur avant l'envoi : une photo de
 * telephone pese plusieurs megaoctets, et l'ecran de seance n'en affiche
 * qu'une vignette.
 */

export const EXERCISE_IMAGE_BUCKET = 'exercise-images'

/** Types acceptes par le bucket. */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Taille du fichier source accepte avant reduction. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024

/** Plus grand cote de l'image enregistree, en pixels. */
export const IMAGE_MAX_SIDE = 800

export function isAcceptedImageType(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)
}

/**
 * Dimensions reduites pour tenir dans un carre de `maxSide`, proportions
 * gardees. Une image deja assez petite n'est jamais agrandie.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = IMAGE_MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const ratio = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

const IMAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/

/**
 * Chemin d'objet tel que l'editeur le produit : un uuid, en WebP ou en JPEG,
 * a la racine du bucket.
 *
 * Les actions serveur le verifient : un chemin arbitraire ferait pointer un
 * exercice vers n'importe quel objet du bucket.
 */
export function isValidImagePath(path: string): boolean {
  return IMAGE_PATH.test(path)
}

/** URL publique d'une image du bucket, a partir de l'URL du projet. */
export function publicImageUrl(projectUrl: string, path: string | null): string | null {
  if (!path) return null
  return `${projectUrl.replace(/\/+$/, '')}/storage/v1/object/public/${EXERCISE_IMAGE_BUCKET}/${encodeURIComponent(path)}`
}
