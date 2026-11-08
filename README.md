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
  features/stats/        # série, heatmap, courbe de rétention (phase 6A)
  features/games/        # import Lichess / Chess.com / PGN, visionneuse, cartes d'erreurs (phase 5)
  features/puzzles/      # import de puzzles par thème et Elo (phase 3)
  lib/fsrs.ts            # planificateur ts-fsrs
  data/seed.ts           # cartes de démo
  hooks/                 # useChessGame, useTheme
  index.css              # tokens (clair/sombre), thème de l'échiquier
.github/workflows/       # déploiement GitHub Pages
```

## Analyse Stockfish

Les parties sont analysées dans le navigateur par Stockfish 19 « lite » (WASM, un seul thread, ≈2 Mo, copié depuis le
paquet npm `stockfish` vers `public/stockfish` par `scripts/copy-stockfish.mjs`), avec 2 lignes par position
(MultiPV). Chaque coup des deux camps est classé d'après les points attendus perdus par rapport au meilleur coup :
brillant (sacrifice), très bon coup (seul bon coup), meilleur coup, excellent (≤ 0,02), bon (≤ 0,05), imprécision
(≤ 0,10), erreur (≤ 0,20), gaffe (> 0,20), coup manqué (faute adverse non exploitée) et théorie (base d'ouvertures
Lichess, CC0, `src/data/openings.json`, régénérable avec `scripts/build-openings.mjs`). Ces critères approchent ceux de
Chess.com sans les reproduire. La précision par camp suit la formule de Lichess. Les erreurs choisies deviennent des
cartes ; l'analyse est conservée avec la partie (export JSON inclus).
**Licence** : Stockfish est sous GPL-3.0 (`Copying.txt` est servi avec le moteur) ; si tu publies le code de
l'application, fais-le sous une licence compatible.

## PWA

Manifeste + service worker (`public/sw.js`) : installation sur mobile/ordinateur et usage hors ligne après une première
visite (les packs de puzzles et le moteur sont mis en cache à la première utilisation). Le cache est renouvelé à
chaque déploiement.

## Paquets (façon Anki)

Chaque carte a un chemin de paquet : `Ouvertures::Système de Londres`, `Puzzles::Fourchette`,
`Parties::Lichess`, `Finales`, `Démo`. Chaque ouverture a deux sous-paquets : `Coups seuls` et `Lignes`.
L'onglet Réviser se parcourt par clics (niveau par niveau, fil d'Ariane) et affiche les compteurs
(Nouvelles / Apprentissage / À revoir) ; un paquet parent inclut ses sous-paquets. Le plafond de nouvelles cartes par
jour s'applique au paquet étudié. Les cartes créées avant les paquets sont rangées automatiquement (migration Dexie v5).

## Cartes-lignes

Dans l'éditeur de répertoire, « Jusqu'ici » ou « Toutes les lignes » créent des cartes qui font rejouer une suite de
coups (réponses adverses automatiques) dans le sous-paquet `…::Lignes`. Après une erreur, la ligne continue ;
une seule note à la fin, et seul Again si tu t'es trompé.

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
- [x] 6A. Paquets façon Anki, cartes-lignes, favoris et suppression groupée, statistiques
- [x] 6B. Navigation par paquets (Coups seuls / Lignes), Stockfish, PWA hors ligne
- [x] 7A. Analyse complète façon Chess.com (catégories, précision, barre et courbe d'évaluation), choix du nombre de parties, import simplifié
- [ ] 7B. Plateau avec bot (choix de l'Elo), rubrique Tuto

## Workflow Git

Une branche par fonctionnalité (`feat/...`), Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), PR vers `main`.
