# Chess SRS

Entraînement aux échecs en répétition espacée (FSRS) : tactiques, ouvertures, finales.

**Stack** : React · TypeScript · Vite · Tailwind v4 · Framer Motion · chessground · chess.js
(à venir : ts-fsrs, Dexie, Stockfish WASM, PWA)

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de production
```

## Structure

```
src/
  components/
    board/Board.tsx      # wrapper chessground (coups légaux via chess.js, flash de feedback)
    ui/                  # design system : Button, Card, RatingButtons, ThemeToggle
  features/playground/   # échiquier jouable (phase 1)
  hooks/                 # useChessGame, useTheme
  index.css              # tokens (clair/sombre), thème de l'échiquier
.github/workflows/       # déploiement GitHub Pages
```

## Déploiement

Push sur `main` → GitHub Actions build et publie sur GitHub Pages
(Settings → Pages → Source : **GitHub Actions**).

## Feuille de route

- [x] 1. Structure, échiquier jouable, design system
- [ ] 2. Cartes + FSRS + file de révision
- [ ] 3. Puzzles Lichess par thème
- [ ] 4. Éditeur de répertoire d'ouvertures
- [ ] 5. Import de parties → cartes d'erreurs
- [ ] 6. Stats, Stockfish, PWA

## Workflow Git

Une branche par fonctionnalité (`feat/...`), Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), PR vers `main`.
