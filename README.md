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
  features/openings/     # répertoires : arbre de variantes, éditeur, import PGN (phase 4)
  features/games/        # import Lichess / Chess.com / PGN, visionneuse, cartes d'erreurs (phase 5)
  features/puzzles/      # import de puzzles par thème et Elo (phase 3)
  lib/fsrs.ts            # planificateur ts-fsrs
  data/seed.ts           # cartes de démo
  hooks/                 # useChessGame, useTheme
  index.css              # tokens (clair/sombre), thème de l'échiquier
.github/workflows/       # déploiement GitHub Pages
```

## Répertoire d'ouvertures

Un répertoire = une ouverture + une couleur. On le construit en jouant les coups sur l'échiquier ou en important un
PGN (variantes et commentaires pris en charge). Une carte est créée pour chaque position où c'est à toi de jouer ;
les variantes à ce même point sont toutes acceptées. Modifier le répertoire met les cartes à jour sans toucher à leur
planification FSRS.

### Entraînement

Depuis un répertoire, le bouton ▶ lance une partie d'entraînement : l'adversaire joue seul, au hasard parmi les
réponses de ton arbre ; tu dois trouver ton coup. Chaque position met à jour la carte FSRS (erreur = Again ;
réussite comptée seulement si la carte est nouvelle, en apprentissage échue ou due aujourd'hui).

## Parties et erreurs

Onglet Parties : import depuis Lichess (API, parties déjà analysées), Chess.com (API publique, sans analyse) ou PGN
(export Lichess avec analyse). Chaque erreur de ton camp (gaffe, erreur, imprécision au choix) devient une carte
« position avant l'erreur → meilleur coup ». Les parties sans analyse se corrigent à la main dans la visionneuse
(l'analyse automatique viendra avec Stockfish, phase 6).

## Puzzles Lichess

Base officielle [database.lichess.org](https://database.lichess.org/#puzzles) (licence CC0). Au déploiement,
`scripts/build-puzzles.mjs` en tire un pack par thème (les 250 meilleurs puzzles par tranche de 200 Elo), servi
depuis `public/puzzles/`. Ils ne sont donc pas disponibles en local (`npm run dev`) sans lancer le script à la main.
La liste des thèmes est dans `src/data/themes.json`.

## Déploiement

Push sur `main` → GitHub Actions build et publie sur GitHub Pages
(Settings → Pages → Source : **GitHub Actions**).

## Feuille de route

- [x] 1. Structure, échiquier jouable, design system
- [x] 2. Cartes + FSRS + file de révision
- [x] 3. Puzzles Lichess par thème
- [x] 4. Éditeur de répertoire d'ouvertures
- [x] 5. Import de parties → cartes d'erreurs, entraînement d'ouvertures
- [ ] 6. Stats, Stockfish, PWA

## Workflow Git

Une branche par fonctionnalité (`feat/...`), Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), PR vers `main`.
