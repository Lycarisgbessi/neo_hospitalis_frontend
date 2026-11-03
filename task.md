# Tâches de Correction - Gestion Hospi Neo

## Cycle 1 (terminé)
- [x] **Phase 1: Persistance et Contexte (AppContext.tsx)** — catalogue de prix, catalogue d'assurances, `crypto.randomUUID()`, persistance `localStorage`.
- [x] **Phase 2: Sécurité et RBAC (App.tsx & AuthPage.tsx)** — `ProtectedRoute` avec `allowedRoles`, mot de passe à la connexion.
- [x] **Phase 3: Logique Métier (DoctorPage, CashierPage, ReceptionPage)** — prix du catalogue, plafonds d'assurance, transfert refacturé.
- [x] **Phase 4: Stabilité UI/UX** — `ErrorBoundary` créé et intégré dans `main.tsx`.

## Cycle 2 — Correction canonique (terminé)
- [x] **Bug 1 :** `SettingsPage` crash (`setActiveModules` inexistant) → `setActiveModules` correctement exposé et typé dans `AppContext`.
- [x] **Bug 2 :** `@types/react` + `@types/react-dom` installés ; `strict: true` activé ; types Web Speech créés (`src/types/speech.d.ts`) ; plus aucun `any` dans le code.
- [x] **Bug 3 :** Compte-rendu d'imagerie et compte-rendu infirmier désormais **persistés dans `medicalRecords`** (visibles par le médecin).
- [x] **Bug 4 :** `GynecoPage` / `PediatriePage` : `generateId()` partout, frais de repli depuis `PRICING_CATALOG` (fin des montants aléatoires), transfert remet `consultationFeePaid` à `false`. IDs également corrigés dans Lab/Pharmacie/Imagerie (LAB-RES, PO, MQ).
- [x] **Bug 5 :** **Registre d'utilisateurs** (`users` dans le contexte) avec distinction Connexion/Inscription, mot de passe haché (démo), vérification du rôle ; attribution correcte du nom du médecin dans les historiques (fin du lookup erroné dans `patients`).
- [x] **Bug 6 :** Entrée sidebar « Interventions » (`/chirurgie` sans route) retirée.
- [x] **Bug 7 :** `stopListening()` arrête réellement la reconnaissance vocale ; tendances du dashboard **calculées** (admissions/recettes/consultations du jour vs hier) ; budgets par service **configurables** (Paramètres) et consommés par les PO/devis validés ; **stock pharmacie persistant** avec recherche fonctionnelle et décrément réel à la délivrance ; CSS `@media print` (`.print-area`) pour reçus et tickets.
- [x] **Bug 8 :** Dépendances mortes retirées (`express`, `@types/express`, `dotenv`, `@google/genai`, `tsx`, `autoprefixer`) ; `index.html` francisé (titre + `lang`) ; `define` mort du `vite.config.ts` retiré ; `.env.example` corrigé (`VITE_GEMINI_API_KEY`).
- [x] **Bonus :** statut invalide `in_consultation` (code mort) corrigé en `consultation` dans ReceptionPage ; comparaison de service du médecin normalisée (`'Général'` → `general`).

## Recommandations appliquées
- [x] Typage React complet + `strict` (la commande `npm run lint` redevient significative).
- [x] Corrections métier étendues à toutes les pages de consultation.
- [x] Persistance des comptes-rendus (imagerie, soins infirmiers).
- [x] Registre d'utilisateurs.
- [x] Nettoyage complet (deps, titres, routes, IDs).
- [x] **Migration localStorage versionnée** (`hospi_schemaVersion`, v2) : normalisation des données existantes, complétion des nouvelles collections, déconnexion des sessions pré-v2 ; bouton « Réinitialiser toutes les données » dans Paramètres.
- [ ] Backend réel (Supabase/Firebase) — hors périmètre front-end, prochaine étape majeure.

## Vérifications
- `npx tsc --noEmit` (strict) : **0 erreur**.
- `npm run build` : **succès**.

## Cycle 3 — Contrôle vocal total + OpenRouter GLM (terminé)
- [x] **Fournisseur IA** : bascule vers **GLM (Zhipu) via OpenRouter** (`zhipuai/glm-4.6` par défaut, surchargeable via `VITE_AI_MODEL`), Gemini gardé en secours — abstraction dans `src/lib/ai.ts` (`generateText`, `getActiveProvider`, `extractJsonObject`).
- [x] **Dictée d'actes** : la même dictée crée désormais ordonnances (médicaments structurés), bons de biologie, bons d'imagerie et bons de soins infirmiers — avec **aperçu validé avant création** (chaque médicament/analyse/examen/soin est décochable).
- [x] **Tarifs du catalogue** appliqués aux actes dictés (labo 100 000 FG, imagerie 250 000 FG/examen, soins 20 000 FG) — jamais de prix inventé.
- [x] Intégré aux 3 pages de consultation (Médecine Générale, Gynéco, Pédiatrie) — les ordres créés suivent le circuit habituel : caisse → service exécutant.
- [x] `.env.example`, README et bannières UI mis à jour.

## Cycle 4 — AUDIT 1 : Logique métier / parcours patient (terminé)
Audit atomique de bout en bout (réception → caisse → consultation → paraclinique → hospitalisation → dossier). 14 constats classés par sévérité, tous corrigés :

**Critiques**
- [x] **A1 Trou de facturation des transferts** : le transfert passe désormais par `waiting_payment` (retour caisse) ET les files médecins exigent `consultationFeePaid` — plus aucune consultation gratuite de second service.
- [x] **A2 Ordres à 0 FG invisibles en caisse** : filtre `fee > 0` supprimé — le circuit pharmacie (tarif catalogue 0) est débloqué de bout en bout.
- [x] **A3 Accès direct aux examens** : nouveau mode d'admission « Examen direct » à la réception (prescripteur externe + choix des analyses/imageries, tarifs catalogue) — pas de consultation, dossier clôturé automatiquement à la fin des examens (`completeOrder`).
- [x] **A4 Hospitalisation fonctionnelle** : case « Hospitaliser après consultation » sur les 3 pages médecins → statut `hospitalized`, badges file/réception, compteur dashboard.

**Majeurs**
- [x] **B1** : patientes traités réintégrés dans les files Gynéco/Pédiatrie (accès historique + nouvelle consultation).
- [x] **B2** : dossier longitudinal (`RecordsTimeline` partagé) rendu sur les 3 pages — résultats labo/CR imagerie/soins enfin visibles en spécialité.
- [x] **B3** : dispensation pharmaceutique tracée dans `medicalRecords`.
- [x] **B4** : transfert vers le même service impossible (option exclue).

**Mineurs** : détection de doublons à l'admission (C1), file du jour + bascule historique (C2), urgences de triage prioritaires dans les files (C3), arrondis GNF sur l'assurance (C4), badges et résumé de triage dans le dialog réception (C6).

**Vérification E2E** (`node e2e-audit1.mjs`, Chrome headless CDP) : **14/14 PASS** — accès direct complet (enregistrement→caisse sans consultation→labo→clôture auto), transfert refacturé (file exclut l'impayé, 50 000 FG cardiologie présentés), ordre 0 FG visible/payable, hospitalisation (statut+badge+dashboard).

## Cycle 4bis — RÉ-AUDIT 1 (yeux neufs sur code corrigé) — terminé
Les 14 corrections du Cycle 4 tiennent face aux nouveaux cas limites testés. 5 nouveaux constats, tous corrigés :
- [x] **R1 (critique) Non-contamination des dossiers** : sélection d'un autre patient = purge complète (texte clinique, transfert, hospitalisation, dictée, type de consultation) sur les 3 pages — plus d'attribution croisée de données médicales.
- [x] **R2 (majeur) Tri des files** : patients actifs avant dossiers clôturés (après urgences de triage), puis ordre d'arrivée.
- [x] **R3 (mineur)** : lignes de résultats labo sans paramètre rejetées à la signature.
- [x] **R4 (mineur)** : badge « Examen terminé » pour les patients examen-direct clôturés.
- [x] **R5 (cosmétique)** : condition morte supprimée dans CashierPage.
- E2E étendu : **16/16 PASS** (dont T5 non-contamination inter-dossiers et T6 tri des files).

## Cycle 5 — AUDIT 2 : Contrôle vocal (terminé)
6 constats atomiques sur les deux systèmes vocaux (assistant court + dictée médicale), tous corrigés :
- [x] **F1 (critique) Orientation pilotable à la voix** : les schémas de dictée des 3 pages exposent `orientation` (service de transfert) et `hospitalisation` (oui/non) — dictables, affichés dans l'aperçu validable, mappés sur le transfert/hospitalisation (avec exclusion du même service et hospitalisation prioritaire).
- [x] **F2 (majeur) Navigation fiable** : carte complète des 12 routes de l'application injectée dans le prompt de l'assistant (« va à la réception » → `/reception` garanti, plus d'URL devinée).
- [x] **F3a (majeur) Gynéco & Pédiatrie enregistrées** auprès de l'assistant vocal (schemas motif/ATCD/constantes/diagnostic + déclencheur de dictée) — elles étaient muettes (0 useAI).
- [x] **F3b (moyen) Assistant médecin enrichi** : constantes rapides (température/tension/pouls/poids), synonymes (motif/diagnostic_final) et commande « ouvre la dictée ».
- [x] **F4 (moyen)** : le micro est coupé au lancement de l'analyse (l'instantané analysé ne dérive plus).
- [x] **F5 (mineur)** : hints de commandes vocales synchronisés (médecin/gynéco/pédiatrie, ouverture de dictée).
- [x] **Robustesse** : regex hospitalisation étendu aux réponses anglaises (yes/true) — l'IA peut répondre dans la langue de la dictée.
- E2E vocal dédié (`node e2e-audit2-voice.mjs`, OpenRouter mocké par interception CDP) : **13/13 PASS** — dictée complète (13 items en aperçu dont orientation/ordonnance/biologie), IMC auto, transfert dicté appliqué, ordres créés aux tarifs catalogue, transmission intégrale jusqu'à la consultation sauvegardée (motif/diagnostic/constantes/IMC/examen/médecin), hospitalisation dictée de bout en bout.
- Non-régression : Audit 1 **16/16 PASS**, tsc strict 0 erreur, build OK.

## Cycle 5bis — Clé OpenRouter réelle + résilience fournisseur (terminé)
- Clé OpenRouter réelle installée dans `.env` ; identifiant modèle corrigé : les GLM d'OpenRouter sont préfixés **`z-ai/`** (`z-ai/glm-4.6`), pas `zhipuai/`.
- **Repli automatique** (`lib/ai.ts`) : si le modèle principal échoue (402 crédits, 429 rate-limit, indisponibilité), l'appel est rejoué sur `VITE_AI_FALLBACK_MODEL` (défaut : `nvidia/nemotron-3-ultra-550b-a55b:free`, gratuit, validé sur prompt médical français : normalisation « 38 virgule 5 » → 38.5, ordonnances structurées, orientation).
- **E2E avec la VRAIE IA : 13/13 PASS** (`node e2e-audit2-voice.mjs --real`) : dictée française complète → 15 items en aperçu → champs + IMC 26.1 auto + transfert cardiologie dicté + ordres (0 FG / 100 000 FG) → consultation sauvegardée (TA 12/8, IMC, médecin) → hospitalisation dictée → statut hospitalized.
- Note compte : la clé est valide mais **sans crédits** (HTTP 402 sur GLM) → ajouter des crédits sur openrouter.ai/credits pour utiliser GLM ; en attendant le repli gratuit prend le relais automatiquement.

## Cycle 6 — AUDIT 1 (3e passe) : CIRCULATION DE L'INFORMATION (terminé)
Audit bidirectionnel de tous les flux (médecin → services ET services → médecin). La matrice émetteur→stockage→consommateur a confirmé 11 flux complets et révélé 4 brèches, toutes corrigées :
- [x] **X1 (majeur)** : les blocs de détail spécialisé (CPN, accouchement, PF, post-partum, croissance, vaccination, néonat, examen pédiatrique) n'étaient rendus que par leur page d'origine — une consult' CPN vue par le généraliste perdait son détail. → composant partagé `ConsultationSpecialtyDetails` (tous les types, partout).
- [x] **X2 (majeur)** : le généraliste ne voyait jamais les triages (gynéco/pédiatrie) des patients transférés → bandeau « Triage à l'admission — service d'origine » dans DoctorPage (avec urgences ⚠).
- [x] **X3 (mineur)** : résumé de résultat labo tronqué au premier examen avec tiret résiduel → résumé complet propre.
- [x] **X4 (mineur)** : les prescriptions exécutées disparaissaient de la vue médecin → statut « Exécuté ✓ » désormais visible (3 pages).
- Runner dédié `node e2e-audit1-flux.mjs` : **15/15 PASS** — chaîne complète Réception(triage urgence)→Caisse(40k)→Gynéco(consult'+3 ordres+transfert)→Caisse(15k+0+100k+250k)→Labo→Imagerie→Pharmacie→**Généraliste voit TOUT** (triage, spécialité, dossier, exécutions)→clôture, recettes totales exactes (405 000 FG).
- Non-régression : Audit 1 **16/16**, tsc strict 0 erreur, build OK.

## Cycle 7 — AUDIT 1 (4e passe) : LIMITES & INTÉGRITÉ NUMÉRIQUE (terminé)
Nouvelle loupe : conditions aux limites, écrêtages, protections de double-soumission, statuts fantômes.
- [x] **Y1 (moyen)** : bons de commande et devis acceptaient des montants **négatifs** (un PO à -5 M augmenterait le budget !) → `Math.max(0, …)` sur les 5 sites (Labo, Pharmacie, Imagerie × PO/devis).
- [x] **Y2 (moyen)** : âge non borné à l'admission (999 ans possible) → `max="120"` (blocage natif navigateur) + écrêtage code `min(120, max(0, …))`.
- [x] **Y3 (mineur)** : validation de clôture par `alert()` bloquant en Gynéco/Pédiatrie → **erreur inline** cohérente avec DoctorPage.
- [x] **Vérifié sans correctif** : protections double-clic déjà efficaces (admission : identité purgée → garde ; caisse : sélection purgée ; clôture : diagnostic purgé → validation). Statuts `registered`/`consultation` : documentés comme simplifications mono-utilisateur volontaires.
- Runner flux étendu (FL11–FL13) : **18/18 PASS** · non-régression **16/16** · vocale mock **13/13** · tsc 0 erreur · build OK.

## Cycle 8 — AUDIT 3 : INTERFACE (terminé)
7 constats, tous corrigés :
- [x] **Z1 (critique)** : **toutes les classes d'animation étaient mortes** — `animate-in/fade-in/zoom-in/...` utilisées dans 16 fichiers mais le plugin n'était pas installé sous Tailwind 4 → `tw-animate-css` ajouté : toute la matière animée existante est révélée.
- [x] **Z2 (critique)** : **aucune navigation mobile** (sidebar cachée < md sans remplacement) → menu hamburger + slide-over animé (backdrop, cascade des items, fermeture X/clic).
- [x] **Z3 (majeur)** : 5 `window.alert()` bloquants → **système de toasts animé** (framer-motion, succès/erreur/info, auto-fermeture, empilage, barre colorée).
- [x] **Z4 (majeur)** : Dialog brut → animation scale+fade, **ÉCHAP**, **verrou de scroll**, tailles md/lg/xl, bouton fermer rotatif.
- [x] **Z5 (moyen)** : micro-interactions boutons (`active:scale`, anneau focus), **transition de page** (fade+slide au changement de route), scrollbar fine, sélection colorée.
- [x] **Z6 (moyen)** : dashboard vivant — **compteurs animés** (count-up cubique, montants compris), cartes avec élévation au survol + icône réactive ; **files d'attente en cascade** (stagger 70 ms) sur les 3 pages de consultation.
- [x] **Z7 (mineur)** : montants formatés `fr-GN` dans les listes de prescriptions (3 pages) ; indicateur actif animé dans la sidebar.
- Preuves : tsc 0 erreur, build OK, non-régression **flux 18/18 + logique 16/16**, captures d'écran réelles desktop (dashboard/réception/médecin/dictée/caisse/paramètres) et mobile (dashboard + menu ouvert).

## Cycle 9 — RE-AUDIT 3 : moderne / épuré / ergonomique (terminé)
Examen visuel de 17 captures réelles (toutes les pages + mobile), 5 constats corrigés :
- [x] **V1 (majeur)** : selects natifs incohérents (flèche OS, hauteurs h-9/h-10/h-12 mélangées) → chevron SVG unifié + `appearance-none` + états hover/focus + **12 hauteurs normalisées à h-9** (alignement parfait avec les Inputs).
- [x] **V5 (majeur)** : Dialogs sans borne de hauteur (contenus longs hors écran sur portable) → `max-h-[88vh]` + scroll interne sur TOUS les dialogs ; saisisie labo / CR imagerie / soins passés en `xl`, reçu de caisse en `lg`.
- [x] **V4 (majeur)** : cartes de file et items de caisse inaccessibles au clavier → `tabIndex`, `role="button"`, Entrée/Espace, anneau focus visible, `aria-label` (3 files + caisse).
- [x] **V11 (moyen)** : boutons « Détails »/« Reçu » invisibles au tactile (apparus au survol uniquement) → toujours visibles sur mobile, au survol sur desktop.
- [x] **V-a11y** : `aria-label` sur boutons icônes de fermeture (Dialog, menu mobile, toasts).
- Preuves : tsc 0 erreur, build OK, non-régression **flux 18/18 + logique 16/16**, nouvelles captures (selects unifiés, mobile caisse opérable, auth épuré).

## Cycle 10 — AUDIT 1 (5e passe) : MULTI-RÔLES & MODE POLYCLINIQUE (terminé)
Nouvelle loupe : toutes les validations précédentes tournaient en mode CLINIQUE et en super_admin. 3 constats, tous corrigés :
- [x] **W1 (majeur)** : cloisonnement polyclinique non enforced sur Gynéco/Pédiatrie — un cardiologue affecté pouvait consulter en gynéco → files filtrées par service + **bandeau explicite** « réservée au service » (sage-femmes et super_admin conservent l'accès).
- [x] **W2 (mineur)** : nav incohérente avec le RBAC — comptable/directeur financier avaient /caisse par URL sans lien → entrée « Caisse (supervision) » ajoutée.
- [x] **W3 (majeur, découvert en E2E)** : en polyclinique, l'inscription exigeait un service pour TOUS les rôles médicaux → **impossible de créer un technicien labo / pharmacien / sage-femme** (bouton bloqué à jamais) → service demandé uniquement pour les médecins.
- Runner dédié `node e2e-audit1-roles.mjs` : **16/16 PASS** — setup polyclinique, 6 comptes réels par rôle (réceptionniste, caissier, Dr gynéco, Dr cardiologue, technicien labo, comptable), nav vérifiée par rôle, blocage RBAC (/doctor → /), parcours patient distribué entre les rôles (admission+triage → 40 k → consult'+bon labo → paiement → exécution → dossier), urgence en tête de file, cloisonnement prouvé dans les 2 directions.
- Non-régression totale : logique **16/16** · circulation **18/18** · vocale **13/13** · tsc 0 erreur · build OK.

## Cycle 11 — PRÉPARATION AU DÉPLOIEMENT (terminé)
- [x] Fallback SPA configuré pour les 3 plateformes : `vercel.json` (rewrites), `netlify.toml` (redirects 200), `public/_redirects` (copié dans dist).
- [x] Favicon SVG Hospitalis (caducée médicale bleue) + `<link>` dans index.html.
- [x] Build de production vérifié en conditions réelles (`vite preview`) : `/`, `/reception`, `/caisse` (fallback 200), favicon 200, `_redirects` servi.
- [x] **`hospitalis-deploy.zip`** (237 Ko) prêt à glisser-déposer sur Netlify Drop — clé OpenRouter incorporée + repli gratuit actif.
- [x] README : guide de déploiement (3 options) + avertissements (données par navigateur, clé exposée → clé dédiée avec limite de dépense).

## Cycle 12 — DÉPLOIEMENT VERCEL (terminé)
- Découverte : 2 comptes Vercel (session CLI = team einsof-test ; le projet historique `neo-hospitalis-frontend` du 3 sept. appartient au compte travaileinsof-1730 — ancienne version sans audits).
- Projet **`hospitalis`** créé proprement sous einsof-test et déployé en production :
  - **URL finale : https://hospitalis.vercel.app** (+ URL de déploiement `hospitalis-9xlpmv3j4-einsof-test.vercel.app`)
  - Vérifié en ligne : `/` 200 (titre « Hospitalis — Gestion Hospitalière »), **fallback SPA** (`/caisse` et `/labo` → 200), favicon 200, bundle IA présent (clé OpenRouter + repli gratuit incorporés).
  - Déploiement reproduisible : `vercel deploy --prod` depuis la racine (vercel.json : build + rewrites).
- Nettoyage : suppression des 3 projets dupliqués créés pendant l'exploration (`dist`, `gestion-hospi-neo`, `neo-hospitalis-frontend` einsof-test).
- Note Node : les projets affichent « 26.x » (réglage compte) — sans impact : le build s'exécute localement puis le statique est déployé.

## Cycle 13 — ACCÈS & DÉPLOIEMENT SUR LE PROJET HISTORIQUE (terminé)
- Connexion au compte `travaileinsof-1730` réussie (flux device OAuth, confirmation utilisateur) ; contournement d'un bug CLI (expiresAt bogus + tokens vca_ non reconnus) en pilotant **l'API REST directement** avec le token de session.
- **`neo-hospitalis-frontend.vercel.app` sert désormais la VERSION AUDITÉE** (déploiement `dpl_6YCCoo…`, 21 fichiers, encoding base64 — piège v13 documenté : `encoding: "base64"` obligatoire, `$schema` rejeté dans vercel.json de déploiement).
- Vérifié en ligne : `/` 200 « Hospitalis — Gestion Hospitalière », fallback SPA `/caisse` et `/gyneco` → 200, favicon 200, bundle IA présent.
- Situation finale : 2 URL en ligne servent la même version auditée — `neo-hospitalis-frontend.vercel.app` (projet historique, compte travaileinsof) et `hospitalis.vercel.app` (team einsof-test).
