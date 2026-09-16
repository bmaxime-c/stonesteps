'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { TimerCuePreferences } from '@/lib/account/preferences'

import type { Cue } from './cues'
import { startDelay, stopDelay } from './timers'

/**
 * Emission des reperes du chrono.
 *
 * Trois canaux, chacun coupable : un son, un clignotement de l'ecran, et le
 * flash de l'appareil photo. Aucun n'est indispensable — l'un manque, les
 * autres passent.
 *
 * Les sons sont synthetises plutot que charges : trois bips ne justifient pas
 * trois fichiers audio a telecharger, et un oscillateur donne des timbres
 * distincts qu'on reconnait a l'oreille sans les avoir appris.
 */

const BLINK_MS = 120

/** Chaque repere a son timbre : on doit les distinguer sans les regarder. */
const TONES: Record<Cue, { frequencies: number[]; duration: number }> = {
  // Depart : deux notes qui montent.
  start: { frequencies: [660, 990], duration: 0.09 },
  // Approche : une note breve, toujours la meme.
  beep: { frequencies: [880], duration: 0.07 },
  // Bascule : trois notes qui descendent, plus longues.
  end: { frequencies: [990, 740, 550], duration: 0.12 },
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }

/** Piste video dont on peut allumer la lampe, quand l'appareil en a une. */
type TorchTrack = MediaStreamTrack & {
  applyConstraints: (constraints: { advanced?: { torch: boolean }[] }) => Promise<void>
}

export function useTimerCues(preferences: TimerCuePreferences) {
  const [blinking, setBlinking] = useState(false)

  const audioRef = useRef<AudioContext | null>(null)
  const torchRef = useRef<TorchTrack | null>(null)
  const torchAskedRef = useRef(false)

  /**
   * Le contexte audio ne s'ouvre qu'au premier repere.
   *
   * Les navigateurs refusent de le demarrer hors d'un geste utilisateur ; le
   * premier repere est le depart du chrono, declenche par un tap. L'ouvrir au
   * montage serait refuse en silence.
   */
  const tone = useCallback((cue: Cue) => {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext ?? null
    if (!Ctor) return

    try {
      audioRef.current ??= new Ctor()
      const context = audioRef.current
      void context.resume()

      const { frequencies, duration } = TONES[cue]
      frequencies.forEach((frequency, index) => {
        const at = context.currentTime + index * duration
        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.type = 'square'
        oscillator.frequency.value = frequency
        // Enveloppe courte : sans elle, couper l'oscillateur net produit un
        // claquement plus audible que la note elle-meme.
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(0.18, at + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)

        oscillator.connect(gain).connect(context.destination)
        oscillator.start(at)
        oscillator.stop(at + duration)
      })
    } catch {
      // Contexte refuse, quota d'oscillateurs, onglet muet : la seance
      // continue sans le son.
    }
  }, [])

  /**
   * Le flash reclame l'acces a la camera : on ne le demande qu'une fois, au
   * premier repere, et seulement si l'utilisateur l'a active.
   */
  const torch = useCallback(async () => {
    if (!torchAskedRef.current) {
      torchAskedRef.current = true
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        const track = stream.getVideoTracks()[0] as TorchTrack | undefined
        // Un appareil sans lampe accepte la piste mais refuse la contrainte :
        // on garde la piste, l'echec se verra au premier allumage.
        torchRef.current = track ?? null
      } catch {
        torchRef.current = null
      }
    }

    const track = torchRef.current
    if (!track) return

    try {
      await track.applyConstraints({ advanced: [{ torch: true }] })
      const handle = startDelay(() => {
        void track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {})
      }, BLINK_MS)
      void handle
    } catch {
      // Pas de lampe sur cet appareil : on n'insiste pas.
      torchRef.current = null
    }
  }, [])

  const emit = useCallback(
    (cue: Cue) => {
      if (preferences.sound) tone(cue)

      if (preferences.blink) {
        setBlinking(true)
        const handle = startDelay(() => setBlinking(false), BLINK_MS)
        void handle
      }

      if (preferences.flash) void torch()
    },
    [preferences.blink, preferences.flash, preferences.sound, tone, torch],
  )

  /**
   * Relache tout a la sortie.
   *
   * Une piste camera laissee ouverte garde la lampe allumee et le voyant de
   * la camera avec : la seance finie, rien ne doit survivre.
   */
  const release = useCallback(() => {
    const track = torchRef.current
    if (track) {
      void track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {})
      track.stop()
      torchRef.current = null
    }
    torchAskedRef.current = false

    void audioRef.current?.close().catch(() => {})
    audioRef.current = null
  }, [])

  useEffect(() => release, [release])

  return { emit, blinking, release }
}

/** Arrete un clignotement en cours. Exporte pour les tests d'ecran. */
export { stopDelay as stopCueDelay }
