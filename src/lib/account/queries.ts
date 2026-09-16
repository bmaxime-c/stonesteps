import 'server-only'

import { createClient } from '@/lib/supabase/server'

import { DEFAULT_TIMER_CUES, type TimerCuePreferences } from './preferences'

/**
 * Preferences de reperes de l'utilisateur courant.
 *
 * Retombe sur les valeurs par defaut quand la lecture echoue : un reglage
 * illisible ne doit pas empecher une seance de se jouer.
 */
export async function loadTimerCues(): Promise<TimerCuePreferences> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return DEFAULT_TIMER_CUES

  const { data, error } = await supabase
    .from('profiles')
    .select('timer_sound, timer_blink, timer_flash, timer_warning_percent')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return DEFAULT_TIMER_CUES

  return {
    sound: data.timer_sound,
    blink: data.timer_blink,
    flash: data.timer_flash,
    warningPercent: data.timer_warning_percent,
  }
}
