import type { ProgressPoint } from '@/lib/history/stats'

/**
 * Progression : niveau atteint dans le temps.
 *
 * Une seule serie, donc pas de legende — le titre la nomme — et une seule
 * teinte, celle du texte principal. La courbe est en escalier parce qu'un
 * niveau se franchit d'un coup : interpoler entre deux points laisserait
 * croire a une progression continue qui n'existe pas.
 *
 * SVG rendu cote serveur, sans JavaScript : a cette echelle, quelques points,
 * le survol natif de <title> suffit a lire une valeur.
 */

const WIDTH = 640
const HEIGHT = 200
const PADDING = { top: 16, right: 20, bottom: 28, left: 32 }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucun niveau valide pour l&apos;instant. La courbe apparaitra apres ta premiere
        validation.
      </p>
    )
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom

  const times = points.map((p) => Date.parse(p.date))
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const maxLevel = Math.max(...points.map((p) => p.levelPosition))

  // Un seul point, ou tous le meme jour : on le place au centre plutot que de
  // diviser par un intervalle nul.
  const spanTime = maxTime - minTime

  const x = (time: number) =>
    PADDING.left +
    (spanTime === 0 ? innerWidth / 2 : ((time - minTime) / spanTime) * innerWidth)
  const y = (level: number) =>
    PADDING.top + innerHeight - (level / Math.max(maxLevel, 1)) * innerHeight

  // Escalier : on avance dans le temps au niveau courant, puis on monte.
  const path = points
    .map((point, index) => {
      const px = x(Date.parse(point.date))
      const py = y(point.levelPosition)
      if (index === 0) return `M ${px} ${py}`
      const previous = y(points[index - 1].levelPosition)
      return `L ${px} ${previous} L ${px} ${py}`
    })
    .join(' ')

  const last = points[points.length - 1]

  // Graduations entieres, au plus quatre, pour ne pas encombrer.
  const step = Math.max(1, Math.ceil(maxLevel / 4))
  const ticks = Array.from(
    { length: Math.floor(maxLevel / step) + 1 },
    (_, index) => index * step,
  ).filter((value) => value > 0)

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Progression : niveau ${last.levelPosition} atteint le ${formatDate(last.date)}, sur ${points.length} niveau${points.length > 1 ? 'x' : ''} valide${points.length > 1 ? 's' : ''}.`}
      >
        {/* Grille en retrait : elle sert de repere, pas de decor. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}

        <path
          d={path}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <circle
            key={`${point.date}-${point.levelPosition}`}
            cx={x(Date.parse(point.date))}
            cy={y(point.levelPosition)}
            r={4}
            className="fill-primary stroke-card"
            strokeWidth={2}
          >
            <title>
              Niveau {point.levelPosition}
              {point.levelName ? ` — ${point.levelName}` : ''} · {formatDate(point.date)}
            </title>
          </circle>
        ))}

        {/* Seul le dernier point est etiquete : un nombre sur chaque point
            rendrait la courbe illisible sans rien apprendre de plus. */}
        <text
          x={x(Date.parse(last.date))}
          y={y(last.levelPosition) - 12}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-medium"
        >
          niveau {last.levelPosition}
        </text>

        <text
          x={PADDING.left}
          y={HEIGHT - 6}
          className="fill-muted-foreground text-[10px]"
        >
          {formatDate(points[0].date)}
        </text>
        {points.length > 1 ? (
          <text
            x={WIDTH - PADDING.right}
            y={HEIGHT - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatDate(last.date)}
          </text>
        ) : null}
      </svg>

      <figcaption className="sr-only">
        Niveaux valides dans le temps. Chaque point marque un niveau franchi pour la
        premiere fois.
      </figcaption>
    </figure>
  )
}
