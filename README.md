<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Hospitalis — Gestion Hospitalière Neo

Logiciel de gestion hospitalière modulaire pour cliniques et polycliniques (prototype front-end, données persistées dans le navigateur).

## Fonctionnalités clés

- **Parcours patient complet** : admission → caisse (assurances plafonnées) → consultation → pharmacie / laboratoire / imagerie / soins → comptabilité.
- **Consultations spécialisées** : médecine générale, gynéco-obstétrique (CPN, accouchement, post-partum, PF), pédiatrie (croissance, vaccination, néonat).
- **Dictée médicale intelligente** : le médecin parle (examen + prescriptions), l'IA remplit le formulaire et crée ordonnances et bons d'examens — validation visuelle avant application.
- **Assistant vocal** : commandes vocales courtes en français sur toutes les pages.

## Configuration IA (requis pour la dictée et l'assistant vocal)

L'application utilise **GLM via OpenRouter** (fournisseur principal) avec **Gemini** en secours :

1. Créez une clé sur https://openrouter.ai/keys
2. `cp .env.example .env` puis renseignez `VITE_OPENROUTER_API_KEY`
3. Redémarrez le serveur dev

## Lancer en local

**Prérequis :** Node.js 18+

```bash
npm install
npm run dev        # http://localhost:3000
```

Autres commandes :

```bash
npm run lint       # vérification TypeScript (mode strict)
npm run build      # build de production
npm run preview    # prévisualiser le build
```

## Premier démarrage

1. Écran de configuration : mode Clinique ou Polyclinique + modules actifs.
2. Portail de connexion : créez votre compte (nom + mot de passe + rôle). Un nom déjà inscrit bascule en mode Connexion.
3. Le compte **Super Administrateur** accède à tous les modules et aux Paramètres (budgets, modules, réinitialisation).

---

## 🚀 Déploiement

L'application est une **SPA statique** (dossier `dist/`) déployable partout, sans serveur.

### Option A — Netlify Drop (le plus simple, 1 minute, sans compte git)
1. Ouvrir <https://app.netlify.com/drop>
2. Glisser-déposer le fichier **`hospitalis-deploy.zip`** (ou le dossier `dist/`)
3. L'application est en ligne (`_redirects` inclus pour le fallback des routes)

### Option B — Vercel
```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```
(`vercel.json` déjà configuré : build + rewrite SPA. Définir la variable
d'environnement `VITE_OPENROUTER_API_KEY` dans le projet Vercel — elle est
incorporée au bundle au moment du build.)

### Option C — Netlify CLI / Git
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### ⚠️ À savoir avant de déployer (démo locale)
- **Données par navigateur** : la persistance utilise `localStorage` — chaque
  navigateur possède SON hôpital indépendant. Parfait pour une démo/pilote
  individuelle ; **pas** pour un usage multi-utilisateurs réel (il faudrait un
  backend partagé).
- **Clé IA visible** : `VITE_OPENROUTER_API_KEY` est incorporée dans le bundle
  public (contrainte front-end pur). Créez une **clé dédiée avec limite de
  dépense** sur OpenRouter, et ne réutilisez jamais une clé personnelle.
- Le repli gratuit (`nemotron :free`) reste actif si les crédits GLM
  s'épuisent — l'assistant vocal fonctionne dans tous les cas.
