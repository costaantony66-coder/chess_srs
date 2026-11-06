# Chess SRS

Entraînement aux échecs en répétition espacée (FSRS) : tactiques, ouvertures, finales.

**Stack** : React · TypeScript · Vite · Tailwind v4 · Framer Motion · chessground · chess.js
(à venir : ts-fsrs, Dexie, Stockfish WASM, PWA)

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de production
npm test           # tests (cartes de démo)
```

## Structure

```
src/
  components/
    board/Board.tsx      # wrapper chessground (coups légaux via chess.js, flash de feedback)
    ui/                  # design system : Button, Card, RatingButtons, ThemeToggle
  features/playground/   # échiquier libre (phase 1)
  features/review/       # session de révision : carte, notes, sauvegarde (phase 2)
  db/                    # Dexie : cartes, journal de révisions, file du jour, export/import
  lib/fsrs.ts            # planificateur ts-fsrs
  data/seed.ts           # cartes de démo
  hooks/                 # useChessGame, useTheme
  index.css              # tokens (clair/sombre), thème de l'échiquier
.github/workflows/       # déploiement GitHub Pages
```

## Déploiement

Push sur `main` → GitHub Actions build et publie sur GitHub Pages
(Settings → Pages → Source : **GitHub Actions**).

## Feuille de route

- [x] 1. Structure, échiquier jouable, design system
- [x] 2. Cartes + FSRS + file de révision
- [ ] 3. Puzzles Lichess par thème
- [ ] 4. Éditeur de répertoire d'ouvertures
- [ ] 5. Import de parties → cartes d'erreurs
- [ ] 6. Stats, Stockfish, PWA

## Workflow Git

Une branche par fonctionnalité (`feat/...`), Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), PR vers `main`.
