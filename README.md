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
  features/playground/   # Plateau : deux côtés ou bot Stockfish à Elo réglable (phase 7B)
  features/tuto/         # rubrique Tuto (aide en en-tête + bandeau de bienvenue)
  features/stats/        # série, heatmap, courbe de rétention (phase 6A)
  features/games/        # import Lichess / Chess.com / PGN, visionneuse, cartes d'erreurs (phase 5)
  features/puzzles/      # import de puzzles par thème et Elo (phase 3)
  lib/fsrs.ts            # planificateur ts-fsrs
  data/seed.ts           # cartes de démo
  hooks/                 # useChessGame, useTheme
  index.css              # tokens (clair/sombre), thème de l'échiquier
.github/workflows/       # déploiement GitHub Pages
```

## Plateau : bot

Le mode « Contre un bot » utilise Stockfish (même moteur que l'analyse). À partir de 1320 Elo, le réglage d'Elo
du moteur (`UCI_LimitStrength` / `UCI_Elo`, jusqu'à 3190) limite sa force ; en dessous, niveau de compétence 0,
recherche très courte et coups au hasard de plus en plus fréquents (`src/lib/bot.ts`). Les Elo sont **approximatifs**.
Une partie terminée peut être enregistrée dans « Mes parties » puis analysée.

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
- [x] 7B. Plateau avec bot (choix de l'Elo), rubrique Tuto
- [x] 8. Correctifs (plateau noirs, budget de nouvelles cartes, coordonnées), protection des données, clavier et sons, gestion des cartes, licence et écran de secours

## Workflow Git

Une branche par fonctionnalité (`feat/...`), Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), PR vers `main`.

## Protection des données

Tout est stocké localement (IndexedDB). La carte « Mes données » (écran Réviser) : demande de **stockage persistant**
(`navigator.storage.persist`), **export / partage / import** JSON, **rappel** hebdomadaire (`src/lib/backupReminder.ts`) et
**sauvegarde automatique** quotidienne dans un dossier choisi (API d'accès aux fichiers, Chrome/Edge ordinateur :
`src/db/autobackup.ts`, 7 sauvegardes conservées).

## Confort d'étude

Raccourcis en révision : 1-4 (notes), Espace/Entrée (Good ou « Continuer la ligne »), H (indice), U / Ctrl+Z (annuler la
note), Échap (quitter). Sons et vibrations synthétisés (`src/lib/sounds.ts`, aucun fichier audio). Gestion des cartes :
suspendre, supprimer, déplacer, explorateur (`CardBrowser`). Le plafond de nouvelles cartes par jour est un **budget par
catégorie** (Ouvertures, Puzzles…), partagé entre ses sous-paquets.

## Licence et fiabilité

**GPL-3.0 ou ultérieure** (`LICENSE`, `THIRD_PARTY.md`, page « À propos » du Tuto, lien vers le code source injecté par la
CI via `VITE_REPO_URL`). Un écran de secours (`ErrorBoundary`) propose d'exporter les données en cas d'erreur d'affichage ;
les erreurs inattendues affichent un bandeau discret et sont mémorisées pour le diagnostic.

## Notes pour les développeurs

- `Board` n'utilise pas l'option `viewOnly` de chessground : changer l'orientation pendant qu'elle est active recrée le
  plateau sans réattacher les clics (test de non-régression dans `Board.test.tsx`).
- Les tests d'interface utilisent jsdom + Testing Library (`// @vitest-environment jsdom` en tête de fichier).
