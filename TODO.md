# StoneSteps — feuille de route

Dernière mise à jour : 2026-09-05

Deux natures de tâches cohabitent ici :

- **Développement** — ce que je réalise.
- 🔧 **Action manuelle** — ce que tu dois faire toi-même, en général dans un
  dashboard (Supabase, Vercel, Google Cloud). Je ne peux pas m'en charger.
- 🔒 **Sécurité** — sous-ensemble des actions manuelles à ne pas oublier avant
  d'ouvrir l'application à d'autres personnes.

---

## Phase 1 — Socle ✅

Livrée dans la PR #1.

- [x] Next.js 16, TypeScript, Tailwind 4, shadcn/ui
- [x] Schéma Postgres complet (9 tables) + contraintes métier
- [x] RLS sur toutes les tables, helpers `security definer`
- [x] Catalogue de 35 exercices intégrés
- [x] Authentification e-mail/mot de passe, profil créé par trigger
- [x] Protection des routes via `src/proxy.ts`
- [x] Coquille PWA : manifeste, icônes, service worker, page hors ligne
- [x] Vitest, Prettier, ESLint, justfile, CI GitHub

Reste à traiter, sans urgence :

- [ ] Convertir les icônes PWA en PNG 192 et 512 — le SVG passe sur Chrome mais
      l'installabilité n'est pas garantie partout
- [ ] Installer la CLI Supabase pour que `just types` génère
      `src/lib/database.types.ts` au lieu de le maintenir à la main
- [ ] Régénérer `package-lock.json` dans un conteneur Linux, puis rebasculer la
      CI sur `npm ci`. npm sous Windows n'inscrit que les binaires natifs de la
      plateforme courante, ce qui rend le verrou inutilisable par `npm ci` sur
      un runner Linux. En attendant, la CI utilise `npm install`, qui n'échoue
      pas mais ne vérifie plus le verrou.
      Commande, une fois Docker Desktop démarré :
      `docker run --rm -v "C:/Source/Repos/stonesteps":/w -w /w node:22-slim npm install --package-lock-only`

### 🔧 Actions manuelles — phase 1

- [x] Créer le projet Supabase et l'intégration GitHub
- [x] Renseigner `.env.local`
- [x] Appliquer les migrations via le SQL Editor
- [x] Ajouter `http://localhost:3000/auth/callback` aux _Redirect URLs_
- [ ] 🔒 **Réactiver « Confirm email »** dans Supabase → Authentication →
      Sign In / Providers → Email. Désactivé pour faciliter les tests locaux.
      **À faire avant tout déploiement** : sans cette option, n'importe qui
      crée un compte avec l'adresse e-mail d'un tiers.
- [ ] Activer le provider Google si tu veux que le bouton fonctionne :
      Supabase → Authentication → Providers → Google, avec un client OAuth créé
      côté Google Cloud Console. Sinon, retirer le bouton de l'interface.
- [ ] Vérifier que l'intégration GitHub Supabase pointe bien sur `main` comme
      branche de production, pour que les migrations s'appliquent au merge

---

## Phase 2 — Éditeur de grilles

Objectif démo : je construis ma grille de A à Z et je la retrouve au rechargement.

- [ ] Liste des grilles, création, renommage, suppression
- [ ] Désigner la grille active (une seule à la fois, contrainte déjà en base)
- [ ] Ajout / suppression / réordonnancement des niveaux
- [ ] Dans un niveau : ajout de 1 à 10 exercices, choix dans le catalogue ou
      création d'un exercice personnel
- [ ] Par exercice : séries, répétitions, mode de chrono et durée
- [ ] Réordonnancement par glisser-déposer (dnd-kit), pensé pour le tactile
- [ ] Validation côté formulaire alignée sur les contraintes SQL
- [ ] Grille modèle « 10 niveaux » proposée à la création, duplicable et
      modifiable
- [ ] Tests : règles de validation, réordonnancement, duplication

---

## Phase 3 — Exécution de séance

Objectif démo : une séance complète depuis le téléphone, en salle, sans réseau.

- [ ] Démarrage d'une séance : reprise automatique au dernier niveau non validé
- [ ] Écran de séance : exercice courant, série courante, progression visible
- [ ] Chrono `minimal` — compte à rebours à tenir ; l'arrêt anticipé marque
      l'échec et enregistre la durée réellement tenue
- [ ] Chrono `strict` — temps limite ; le dépassement marque l'échec
- [ ] Validation d'une série : réussie, ou échouée avec le nombre de
      répétitions atteintes
- [ ] Calcul de validation du niveau : toutes les séries de tous les exercices
- [ ] Fin de séance : récapitulatif, niveau validé ou non
- [ ] Persistance locale (IndexedDB) pendant la séance
- [ ] Synchronisation à la reconnexion, idempotente grâce à la clé naturelle
      `(session_id, level_exercise_id, set_index)`
- [ ] Indicateur d'état de synchronisation, et reprise d'une séance interrompue
- [ ] Wake Lock : empêcher l'écran de s'éteindre pendant la séance
- [ ] Tests : logique de validation, calcul du niveau suivant, idempotence de
      la synchronisation

---

## Phase 4 — Historique et progression

Objectif démo : je vois où j'en suis et depuis quand.

- [ ] Liste des séances passées, filtrable par grille
- [ ] Détail d'une séance : exercices, séries, réussites et échecs
- [ ] Niveau courant mis en avant sur le tableau de bord
- [ ] Courbe de progression : niveaux validés dans le temps
- [ ] Statistiques simples : fréquence, séries réussies, exercice le plus
      souvent bloquant
- [ ] Export des données personnelles (JSON ou CSV) — utile en soi, et première
      brique de la conformité RGPD

---

## Phase 5 — Social

Objectif démo : je vois la progression d'un ami et je lui partage ma grille.

- [ ] Recherche d'un membre par pseudo
- [ ] Demande d'ami, acceptation, refus, blocage, suppression
- [ ] Partage d'une grille à un ami, et duplication d'une grille reçue
- [ ] Grilles publiques : consultation et duplication
- [ ] Consultation du niveau courant d'un ami
- [ ] Consultation de l'historique d'un ami
- [ ] Notifications quand un ami valide un niveau (Supabase Realtime, ou e-mail
      via Edge Function)
- [ ] Tests d'isolation : vérifier avec deux comptes réels qu'un non-ami ne voit
      rien, et qu'un ami ne voit que ce qui est prévu

### 🔧 Actions manuelles — phase 5

- [ ] 🔒 Relire les policies RLS avant d'ouvrir l'application à des tiers, et
      tester l'isolation avec deux comptes distincts. C'est la seule barrière
      entre les données de deux utilisateurs.
- [ ] 🔒 Prévoir la suppression de compte et l'export des données. Dès que
      l'application héberge les données de tiers, le RGPD s'applique — y compris
      pour un projet personnel partagé à des amis.

---

## Déploiement

À traiter dès que la phase 2 est utilisable, pour tester en conditions réelles.

- [ ] Créer le projet Vercel connecté au dépôt
- [ ] Vérifier le service worker et l'installation PWA sur un vrai téléphone

### 🔧 Actions manuelles — déploiement

- [ ] Saisir `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
      dans Vercel → Settings → Environment Variables
- [ ] Ajouter aux _Redirect URLs_ Supabase :
      `https://<domaine>.vercel.app/auth/callback` et
      `https://stonesteps-*.vercel.app/auth/callback` — le joker couvre les
      déploiements de preview, sinon l'authentification casse sur chaque PR
- [ ] Basculer la _Site URL_ Supabase sur l'URL de production
- [ ] 🔒 Confirmer que « Confirm email » est bien réactivé

---

## Sécurité — à traiter avant d'ouvrir à d'autres personnes

- [ ] 🔒 Réactiver la confirmation d'e-mail (rappelé en phase 1, c'est le point
      le plus important)
- [ ] 🔒 Durcir la politique de mot de passe : longueur minimale à 10 ou 12, et
      activer la détection des mots de passe compromis (Supabase →
      Authentication → Policies)
- [ ] 🔒 Vérifier les limites de débit sur l'authentification (Supabase →
      Authentication → Rate Limits), en particulier l'envoi d'e-mails
- [ ] 🔒 Désactiver les clés legacy `anon` / `service_role` une fois que plus
      rien ne les utilise
- [ ] 🔒 Ne jamais introduire la clé secrète dans le code client. Si un script
      d'administration en a besoin un jour, il tourne en local, la clé reste
      hors du dépôt et est révoquée après usage.
- [ ] 🔒 Sauvegardes : le plan gratuit Supabase n'en fait pas. Soit accepter le
      risque tant que c'est un projet personnel, soit prévoir un export
      périodique.
- [ ] Envisager un second projet Supabase dédié au développement, pour arrêter
      de basculer des réglages de sécurité sur la base réelle
