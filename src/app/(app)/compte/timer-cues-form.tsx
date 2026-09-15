'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { cn } from '@/lib/utils'
import {
  describeWarningWindow,
  stepWarningPercent,
  WARNING_PERCENT_MAX,
  WARNING_PERCENT_MIN,
  type TimerCuePreferences,
} from '@/lib/account/preferences'
import { useTimerCues } from '@/lib/session/use-timer-cues'

import { emptyAccountState, type AccountState } from './account-state'
import { updateTimerCues } from './actions'
import { Feedback } from './account-forms'

type AccountAction = (state: AccountState, formData: FormData) => Promise<AccountState>

/**
 * Reglages des reperes du chrono.
 *
 * Les interrupteurs sont tenus en etat local plutot que laisses aux cases du
 * formulaire : le bouton d'essai doit jouer ce qui est affiche a l'ecran, pas
 * ce qui est enregistre en base. Une case cochee et pas encore validee s'essaie
 * donc quand meme, ce qui est exactement ce qu'on cherche a faire avant de
 * valider.
 */
export function TimerCuesForm({ cues }: { cues: TimerCuePreferences }) {
  const [state, formAction] = useActionState<AccountState, FormData>(
    updateTimerCues as AccountAction,
    emptyAccountState,
  )

  const [draft, setDraft] = useState(cues)
  const { emit, blinking } = useTimerCues(draft)

  const toggle = (key: 'sound' | 'blink' | 'flash') =>
    setDraft((current) => ({ ...current, [key]: !current[key] }))

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />

      <div className="flex flex-col gap-2.5">
        <CueToggle
          label="Son"
          hint="Des bips qui se resserrent à l'approche de la fin."
          checked={draft.sound}
          name="sound"
          onToggle={() => toggle('sound')}
        />
        <CueToggle
          label="Clignotement"
          hint="L'écran s'allume en vert, visible du coin de l'œil."
          checked={draft.blink}
          name="blink"
          onToggle={() => toggle('blink')}
        />
        <CueToggle
          label="Flash"
          hint="La lampe du téléphone, quand l'appareil en a une. Demande l'accès à la caméra."
          checked={draft.flash}
          name="flash"
          onToggle={() => toggle('flash')}
        />
      </div>

      <div className="bg-inset border-border flex flex-col gap-3 rounded-[16px] border px-4 py-3.5">
        <div>
          <p className="text-sm font-bold">Annonce de la fin</p>
          <p className="text-tertiary mt-0.5 text-xs">
            {describeWarningWindow(draft.warningPercent)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StepButton
            label="Réduire la fenêtre d'annonce"
            disabled={draft.warningPercent <= WARNING_PERCENT_MIN}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                warningPercent: stepWarningPercent(current.warningPercent, -1),
              }))
            }
          >
            &minus;
          </StepButton>
          <span
            aria-live="polite"
            className="text-success min-w-[62px] text-center text-xl font-extrabold"
          >
            {draft.warningPercent} %
          </span>
          <StepButton
            label="Agrandir la fenêtre d'annonce"
            disabled={draft.warningPercent >= WARNING_PERCENT_MAX}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                warningPercent: stepWarningPercent(current.warningPercent, 1),
              }))
            }
          >
            +
          </StepButton>
        </div>
        <input type="hidden" name="warningPercent" value={draft.warningPercent} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton />
        <button
          type="button"
          onClick={() => emit('beep')}
          className="border-border-strong text-muted-foreground rounded-full border px-5 py-2.5 text-sm font-semibold"
        >
          Essayer
        </button>
      </div>

      {/* Meme repere qu'en seance, pour que l'essai ressemble a ce qu'on aura
          telephone pose a un metre. */}
      {blinking ? (
        <div
          aria-hidden="true"
          className="bg-success pointer-events-none fixed inset-0 z-30 opacity-80"
        />
      ) : null}
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
    >
      {pending ? 'Un instant…' : 'Enregistrer'}
    </button>
  )
}

/**
 * Interrupteur d'un canal.
 *
 * Le champ cache porte la valeur au formulaire : une case a cocher native
 * n'aurait pas la cible tactile ni l'apparence du reste de l'application, et
 * son etat doit de toute facon rester lisible par le bouton d'essai.
 */
function CueToggle({
  label,
  hint,
  checked,
  name,
  onToggle,
}: {
  label: string
  hint: string
  checked: boolean
  name: string
  onToggle: () => void
}) {
  return (
    <div className="bg-inset border-border flex items-center gap-3 rounded-[16px] border px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-tertiary mt-0.5 text-xs">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full transition-colors',
          checked ? 'bg-success' : 'bg-chip border-border-strong border',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-6 rounded-full transition-[left]',
            checked ? 'bg-ink-neon left-7' : 'bg-muted-foreground left-1',
          )}
        />
      </button>
      {checked ? <input type="hidden" name={name} value="on" /> : null}
    </div>
  )
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="bg-chip border-border-strong flex size-11 shrink-0 items-center justify-center rounded-full border text-2xl leading-none select-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
