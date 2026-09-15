import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` ajoute sinon un bloc de consignes a CLAUDE.md a chaque
  // demarrage. Le fichier est ecrit a la main et suivi en revue : il ne doit
  // pas bouger sous l'effet d'un outil.
  agentRules: false,
}

export default nextConfig
