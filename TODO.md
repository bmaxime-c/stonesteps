# StoneSteps — feuille de route

Dernière mise à jour : 2026-09-05 — phase 1 livrée et déployée

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
- [ ] Régler proprement le verrou multi-plateforme. npm sous Windows n'inscrit
      dans `package-lock.json` que les binaires natifs de la plateforme
      courante ; les variantes Linux en sont absentes. C'est le bug
      [npm/cli#4828](https://github.com/npm/cli/issues/4828). Conséquence : la
      CI supprime le verrou avant d'installer, et ne le vérifie donc plus.
      Deux issues possibles. Régénérer le verrou dans un conteneur Linux, une
      fois Docker Desktop démarré — mais le problème se reposera en sens
      inverse en local :
      `docker run --rm -v "C:/Source/Repos/stonesteps":/w -w /w node:22-slim npm install --package-lock-only`.
      Ou passer à pnpm, qui gère correctement les dépendances optionnelles par
      plateforme : cela change l'outillage, mais supprime le problème de fond.

### 🔧 Actions manuelles — phase 1

- [x] Créer le projet Supabase et l'intégration GitHub
- [x] Renseigner `.env.local`
- [x] Appliquer les migrations via le SQL Editor
- [x] Ajouter `http://localhost:3000/auth/callback` aux _Redirect URLs_
- [ ] 🔒 **Réactiver « Confirm email »** dans Supabase → Authentication →
      Sign In / Providers → Email. Désactivé pour faciliter les tests locaux.
      **En retard** : l'application est déjà en ligne, donc atteignable par
      n'importe qui, et sans cette option un compte peut être créé avec
      l'adresse e-mail d'un tiers.
- [x] Activer le provider Google si tu veux que le bouton fonctionne :
      Supabase → Authentication → Providers → Google, avec un client OAuth créé
      côté Google Cloud Console. Sinon, retirer le bouton de l'interface.
- [x] Vérifier que l'intégration GitHub Supabase pointe bien sur `main` comme
      branche de production, pour que les migrations s'appliquent au merge

---

## Phase 2 — Éditeur de grilles ✅

Objectif démo : je construis ma grille de A à Z et je la retrouve au rechargement.

- [x] Liste des grilles, création, renommage, suppression
- [x] Désigner la grille active (une seule à la fois, via `set_active_grid`)
- [x] Ajout / suppression / réordonnancement des niveaux
- [x] Dans un niveau : ajout de 1 à 10 exercices, choix dans le catalogue ou
      création d'un exercice personnel
- [x] Par exercice : séries, répétitions, mode de chrono et durée
- [x] Validation côté formulaire alignée sur les contraintes SQL
- [x] Grille modèle « 10 niveaux » proposée à la création, modifiable ensuite
- [x] Tests : règles de validation, description lisible, réordonnancement,
      cohérence de la grille de référence
- [x] Confort de saisie : duplication d'un niveau et d'un exercice, niveaux
      repliables, ajout d'exercices en série sans refermer le formulaire

Reste ouvert :

- [ ] Réordonnancement par glisser-déposer. Livré avec des boutons monter /
      descendre à la place : accessibles au clavier, fiables au doigt, et sans
      dépendance supplémentaire. Le glisser-déposer reste plus agréable sur
      grand écran, à ajouter par-dessus si le besoin se confirme.
- [ ] Duplication d'une grille entière. Prévue au plan initial, non livrée :
      elle n'a d'intérêt réel qu'avec le partage entre amis, en phase 5. La
      duplication d'un niveau et d'un exercice, elle, est en place.

### 🔧 Actions manuelles — phase 2

- [ ] Appliquer les migrations `20260905000004_reorder_functions.sql` et
      `20260905000005_duplicate_functions.sql`. Elles seront jouées
      automatiquement au merge par l'intégration GitHub ; il faut les appliquer
      à la main avant si tu veux tester en local ou en preview, qui partagent
      la même base.

---

## Phase 3 — Exécution de séance ✅

Objectif démo : une séance complète depuis le téléphone, en salle, sans réseau.

- [x] Démarrage d'une séance : reprise automatique au dernier niveau non validé
- [x] Écran de séance : exercice courant, série courante, progression visible
- [x] Chrono `minimal` — décompte à tenir ; l'arrêt anticipé marque l'échec et
      enregistre la durée réellement tenue. Dépasser l'objectif reste une
      réussite.
- [x] Chrono `strict` — temps limite ; le dépassement marque l'échec. Affiché
      en compte à rebours, comme le mode `minimal` : la question posée est
      toujours « combien de temps encore ». Vert tant qu'au plus 85 % du temps
      est consommé, puis interpolation continue de l'orange vers le rouge
      jusqu'à l'échéance (`timerUrgency`, jeton `--status-warning`). La couleur
      ne porte jamais seule l'information : un texte double le signal.
- [x] Validation d'une série : réussie, ou échouée avec le nombre de
      répétitions atteintes
- [x] Calcul de validation du niveau : toutes les séries de tous les exercices
- [x] Fin de séance : récapitulatif, niveau validé ou non
- [x] Persistance locale (IndexedDB) pendant la séance
- [x] Synchronisation idempotente : l'identifiant de séance est généré par le
      client, et `set_results` porte la clé naturelle
      `(session_id, level_exercise_id, set_index)`
- [x] Indicateur hors ligne, état de synchronisation, reprise automatique au
      retour du réseau, reprise d'une séance interrompue
- [x] Wake Lock : l'écran ne s'éteint plus pendant la séance
- [x] Le service worker met `/seance` en cache : recharger son téléphone en
      pleine série, sans réseau, ne fait plus perdre la séance
- [x] Tests : validation de niveau, reprise, déroulé des séries, sémantique des
      deux chronos (63 tests au total)

Reste ouvert :

- [ ] Temps de repos entre séries. Jamais demandé, mais c'est le manque qui se
      remarquera le plus vite à l'usage.
- [ ] Notification sonore ou vibration en fin de chrono : en gainage, on ne
      regarde pas l'écran.
- [ ] Les séances non synchronisées d'un compte sont effacées à la déconnexion.
      Volontaire, mais à revoir si cela se produit en pratique.

---

## Phase 4 — Historique et progression ✅

Objectif démo : je vois où j'en suis et depuis quand.

- [x] Liste des séances passées, filtrable par grille
- [x] Détail d'une séance, regroupé par exercice : séries, réussites, échecs,
      répétitions atteintes et durées tenues
- [x] Niveau courant mis en avant sur le tableau de bord (livré en phase 3)
- [x] Courbe de progression : niveaux validés dans le temps. Une seule série,
      donc une seule teinte et pas de légende ; tracé en escalier parce qu'un
      niveau se franchit d'un coup. SVG rendu côté serveur, sans JavaScript.
- [x] Statistiques : séances, niveaux validés, part de séries réussies, cadence
      hebdomadaire, jours d'affilée, exercice le plus bloquant. Rangée de
      tuiles, pas un graphique — ce sont des nombres isolés.
- [x] Export des données personnelles en JSON, `Cache-Control: private, no-store`

Reste ouvert :

- [ ] Un survol interactif sur la courbe. À cette échelle, quelques points, le
      `<title>` natif du SVG suffit ; à revoir si l'historique s'allonge.
- [ ] Comparer deux grilles sur la même courbe. Suppose une palette
      catégorielle validée, ce qu'une série unique n'exige pas.

---

## Passe de design ✅

Constat du 2026-09-05 : l'application « n'avait aucun style ». Le CSS
fonctionnait — 39 Ko servis, toutes les utilitaires présentes — mais le thème
par défaut de shadcn a une **saturation nulle partout** (`oklch(… 0 0)`). Noir,
blanc, gris : fonctionnel et parfaitement terne.

- [x] Palette énergique : lime vif sur une base de gris chauds. Deux valeurs
      distinctes pour l'interface (`#84cc16` / `#a3e635`, des aplats) et pour
      les données (`--chart-1` `#4d7c0f` / `#65a30d`, un trait de 2 px). Les
      contraintes de contraste ne sont pas les mêmes.
- [x] Les deux valeurs de `--chart-1` passent le validateur du guide de
      visualisation : bande de luminosité, plancher de chroma, contraste ≥ 3:1.
- [x] Toutes les paires de texte vérifiées à ≥ 4,8:1, au-delà du seuil AA.
- [x] **Mode sombre réellement actif** : les variables `.dark` existaient mais
      rien ne posait la classe et il n'y avait aucun `prefers-color-scheme`.
      Sur un téléphone en sombre, l'application restait blanche. Désormais
      `next-themes` en `defaultTheme="system"`, plus une bascule manuelle
      clair / sombre / système.
- [x] `theme-color` déclaré pour chaque mode : la barre du navigateur suit.
- [x] Suppression de `@import 'shadcn/tailwind.css'`, qui pointait vers un
      fichier inexistant.
- [x] Écran de séance : chrono en chiffre de tête, coloré par l'état — lime
      quand l'objectif est tenu, rouge quand la limite est franchie — et
      commandes en 56 px de haut, manipulables d'une main.

Reste ouvert :

- [ ] Aucune vérification visuelle automatisée. Tout a été contrôlé par le
      validateur de palette, le calcul de contraste et l'inspection du CSS
      produit, mais personne n'a _regardé_ le rendu. Des captures Playwright
      combleraient ce trou.
- [ ] Icônes PWA toujours dans l'ancienne teinte ardoise (`#0f172a`), à
      reprendre avec la palette lime.

---

## Phase 5 — Social ✅

Objectif démo : je vois la progression d'un ami et je lui partage ma grille.

- [x] Recherche d'un membre par pseudo
- [x] Demande d'ami, acceptation, refus, blocage, suppression
- [x] Partage nominatif d'une grille à un ami, distinct de la publication
      ouverte — fondre les deux rendrait impossible de partager à une personne
      sans exposer la grille à tout le monde
- [x] Duplication d'une grille reçue, publique, ou d'un ami. Les exercices
      personnels de l'auteur sont recopiés dans le catalogue de celui qui
      duplique, sinon la copie dépendrait d'une ligne appartenant à autrui que
      `ON DELETE RESTRICT` empêcherait de supprimer.
- [x] Page « Découvrir » : grilles publiques, partagées, et celles des amis
- [x] Consultation du niveau courant et de l'historique d'un ami
- [x] **Correction de sécurité** : la policy `friendships_update_involved`
      laissait le demandeur accepter sa propre demande et s'octroyer l'accès
      aux séances de quelqu'un qui n'avait jamais répondu. La RLS ne sait pas
      comparer l'ancienne et la nouvelle valeur ; un déclencheur le fait.
- [x] **Correction** : `exercises_select` ne laissait lire que le catalogue
      intégré et ses propres exercices. La grille d'un ami affichait donc
      « Exercice supprimé » partout où celui-ci avait créé un exercice
      personnel.

Reste ouvert :

- [ ] Notifications quand un ami valide un niveau (Supabase Realtime, ou
      e-mail via Edge Function). Non livré : suppose de décider de la fréquence
      et du canal, et personne n'a encore assez d'amis pour que ça se remarque.
- [ ] Le détail des séries échouées d'un ami n'est pas exposé — seulement le
      niveau et la réussite globale. À rediscuter si le besoin apparaît.

### 🔧 Actions manuelles — phase 5

- [ ] Appliquer la migration `20260905000006_social.sql`.
- [ ] 🔒 **Tester l'isolation avec deux comptes réels.** Les tests unitaires
      couvrent la lecture d'une relation, pas la RLS elle-même. À vérifier :
      un non-ami ne voit ni l'historique ni les grilles privées ; un ami voit
      le niveau et l'historique mais pas les grilles non partagées ; le
      demandeur ne peut pas accepter sa propre demande.
- [ ] 🔒 Prévoir la suppression de compte et l'export des données. L'export
      existe depuis la phase 4 ; la suppression reste à faire. Dès que
      l'application héberge les données de tiers, le RGPD s'applique — y
      compris pour un projet personnel partagé à des amis.

---

## Déploiement ✅

En ligne : **https://stonesteps.vercel.app**

Déploiement continu actif : chaque push sur `main` part en production, chaque
PR obtient sa preview.

- [x] Créer le projet Vercel connecté au dépôt
- [x] Vérifier en production : page d'accueil servie, `/dashboard` non connecté
      redirigé en 307 vers `/login`, manifeste et service worker accessibles
- [ ] Vérifier l'installation PWA sur un vrai téléphone — première occasion de
      tester le service worker, inactif en local. Si l'icône ne s'affiche pas
      correctement, basculer les icônes SVG en PNG 192 et 512.

### Migrations et déploiement

- [x] **Trancher l'application des migrations au merge.** L'intégration GitHub
      Supabase ne les appliquait pas et n'affichait aucun check (constaté le
      2026-09-05 : après le merge des PR #4 et #5, les fonctions de `0004` et
      `0005` étaient absentes, `/rest/v1/rpc/...` → `PGRST202`). Décision : ne
      pas dépendre d'un mécanisme silencieux. `.github/workflows/migrations.yml`
      pousse les migrations avec la CLI Supabase au push sur `main`, et sur PR
      liste l'écart + poussée à blanc + refus de toute migration existante
      modifiée. Un échec est désormais visible sur le commit de merge.
- [ ] **Appliquer à la main les migrations à tester avant merge** (`just db-push`) :
      local et preview partagent la base de production, la CI ne pousse qu'au
      merge.

### 🔧 Actions manuelles — migrations automatiques

- [ ] Créer un **access token** Supabase (Account → Access Tokens) et
      l'enregistrer en secret de dépôt `SUPABASE_ACCESS_TOKEN`
      (GitHub → Settings → Secrets and variables → Actions).
- [ ] Enregistrer le mot de passe de la base (Project Settings → Database) en
      secret `SUPABASE_DB_PASSWORD`.
- [ ] **Désactiver l'intégration GitHub Supabase** (Supabase → Integrations →
      GitHub) une fois le workflow vert : deux mécanismes d'application sur la
      même base finiraient par se contredire.
- [ ] Vérifier l'historique distant avant la première poussée automatique :
      `supabase migration list --linked`. Toute migration appliquée à la main
      sans sa ligne dans `supabase_migrations.schema_migrations` doit être
      marquée `supabase migration repair --status applied <version>`, sinon la
      CI la rejouera et échouera.
- [ ] Lancer le workflow à vide (Actions → Migrations → Run workflow) pour
      valider secrets et connexion avant d'en dépendre au merge.

### 🔧 Actions manuelles — déploiement

- [x] Saisir `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
      dans Vercel → Settings → Environment Variables
- [x] Basculer la _Site URL_ Supabase sur `https://stonesteps.vercel.app`.
      Tant qu'elle pointe sur `localhost`, les liens de confirmation envoyés
      par e-mail renvoient vers une machine qui n'est pas celle du
      destinataire.
- [x] Ajouter aux _Redirect URLs_ Supabase, en conservant l'entrée localhost : - `https://stonesteps.vercel.app/auth/callback` - `https://stonesteps-*-bmaxime-c.vercel.app/auth/callback` — le joker
      couvre les déploiements de preview, sinon l'authentification casse sur
      chaque PR
- [x] 🔒 Réactiver « Confirm email » — Supabase → Authentication → Sign In /
      Providers → Email. **L'application est publique depuis le déploiement :
      sans cette option, n'importe qui peut créer un compte avec l'adresse
      e-mail d'un tiers.**

---

## Sécurité — à traiter avant d'ouvrir à d'autres personnes

- [x] 🔒 Réactiver la confirmation d'e-mail. C'est le point le plus urgent :
      l'application est en ligne, donc atteignable par n'importe qui.
- [ ] 🔒 Durcir la politique de mot de passe : longueur minimale à 10 ou 12, et
      activer la détection des mots de passe compromis (Supabase →
      Authentication → Policies)
- [ ] 🔒 Vérifier les limites de débit sur l'authentification (Supabase →
      Authentication → Rate Limits), en particulier l'envoi d'e-mails
- [x] 🔒 Désactiver les clés legacy `anon` / `service_role` une fois que plus
      rien ne les utilise
- [ ] 🔒 Ne jamais introduire la clé secrète dans le code client. Si un script
      d'administration en a besoin un jour, il tourne en local, la clé reste
      hors du dépôt et est révoquée après usage.
- [ ] 🔒 Sauvegardes : le plan gratuit Supabase n'en fait pas. Soit accepter le
      risque tant que c'est un projet personnel, soit prévoir un export
      périodique.
- [ ] Envisager un second projet Supabase dédié au développement, pour arrêter
      de basculer des réglages de sécurité sur la base réelle
