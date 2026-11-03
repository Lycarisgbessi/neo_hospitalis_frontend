# Plan de Correction des Failles (Architecture Purement Front-End)

Ce plan vise à corriger toutes les failles et incohérences listées dans le rapport précédent, tout en respectant votre contrainte de **rester purement sur le front-end** (sans backend ni base de données externe).

## 1. Modifications Proposées

Nous allons diviser les corrections par domaine (Architecture, Sécurité, Métier).

### 1.1 Persistance, Performance & IDs Sécurisés
Pour que les données survivent aux rafraîchissements (F5) et pour éviter les doublons d'IDs.

#### [MODIFY] `src/context/AppContext.tsx`
- **LocalStorage Sync :** Initialisation de tous les états (patients, consultations, reçus) à partir du `localStorage` du navigateur. Ajout d'un `useEffect` pour sauvegarder automatiquement l'état global à chaque modification.
- **Catalogue de Prix (Pricing) :** Ajout d'un dictionnaire centralisé des prix (Consultation Générale, Spécialiste, Labo, etc.) pour supprimer les prix codés en dur.
- **Catalogue d'Assurances :** Ajout d'une liste d'assurances valides avec leur taux de couverture maximum.
- **IDs robustes :** Remplacement systématique des `Math.random()` par l'API native `crypto.randomUUID()` pour garantir des identifiants uniques.

### 1.2 Sécurité et Contrôle d'Accès (RBAC)
Pour empêcher le saut de pages via l'URL (ex: le réceptionniste qui tape `/doctor`).

#### [MODIFY] `src/App.tsx`
- Refonte du composant `ProtectedRoute` pour qu'il accepte une propriété `allowedRoles`.
- Si l'utilisateur connecté n'a pas un rôle autorisé pour la page demandée, il sera redirigé vers son propre tableau de bord.
- Sécurisation de toutes les routes (`/reception` -> réceptionniste, `/doctor` -> médecins, `/caisse` -> caissier, etc.).

#### [MODIFY] `src/pages/AuthPage.tsx`
- Ajout d'un champ "Mot de passe" (simulé) pour rendre l'accès plus réaliste et éviter les connexions accidentelles.
- L'ID utilisateur sera généré avec `crypto.randomUUID()`.

### 1.3 Incohérences Métier (Facturation et Transferts)
Pour éviter les prix inventés et les failles de facturation.

#### [MODIFY] `src/pages/DoctorPage.tsx`
- **Correction des prix :** Au lieu de générer des tarifs aléatoires (150000, 50000), le système ira piocher le tarif exact dans le "Catalogue de Prix" du Context.
- **Transferts corrigés :** Lors d'un transfert vers un autre service, la variable `consultationFeePaid` sera remise à `false` (sauf urgence spécifique) pour qu'une nouvelle facture de consultation spécialiste soit générée à la caisse.
- **Filtrage robuste :** Amélioration de la logique de filtrage des patients (gestion de la casse et des espaces blancs).

#### [MODIFY] `src/pages/CashierPage.tsx`
- **Consultation dynamique :** Le prix de la consultation ne sera plus fixé à 15 000 GNF en dur, mais sera calculé selon le service (Général vs Spécialité) grâce au catalogue.
- **Validation d'Assurance :** Le taux de prise en charge saisi sera plafonné par le maximum autorisé par l'assurance choisie, empêchant les saisies arbitraires de 100%.

### 1.4 Expérience Utilisateur (Crashs)
Pour éviter l'écran blanc de la mort en cas de bug.

#### [NEW] `src/components/ErrorBoundary.tsx`
- Création d'un composant barrière pour intercepter les erreurs Javascript et afficher un message propre au lieu de faire planter toute l'application.

#### [MODIFY] `src/main.tsx`
- Intégration du `ErrorBoundary` autour de l'application racine.

---

## User Review Required

> [!IMPORTANT]  
> Avant de commencer, veuillez confirmer si cette approche purement locale (`localStorage`) et de contrôle d'accès front-end vous convient pour votre démo. Si vous avez des directives particulières pour le champ "Mot de passe" fictif ou les tarifs du catalogue, faites-le moi savoir.

## Verification Plan
1. **Tests de persistance :** Rafraîchir la page (F5) et vérifier que les patients et les reçus sont toujours là.
2. **Tests d'accès :** Se connecter comme Réceptionniste et tenter de taper `/doctor` dans l'URL. Vérifier le blocage.
3. **Tests de facturation :** Faire un transfert de Général vers Pédiatrie et vérifier qu'une nouvelle facture est générée. Vérifier qu'un médecin ne peut plus envoyer de factures "aléatoires".
