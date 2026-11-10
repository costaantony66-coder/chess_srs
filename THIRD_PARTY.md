# Composants tiers

| Composant | Usage | Licence |
|---|---|---|
| [Base de puzzles Lichess](https://database.lichess.org/#puzzles) | puzzles | CC0 |
| [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | noms et théorie des ouvertures (`src/data/openings.json`) | CC0 |
| [chessground](https://github.com/lichess-org/chessground) | échiquier | GPL-3.0-or-later |
| Jeu de pièces « cburnett » (Colin M.L. Burnett) | dessin des pièces (fourni avec chessground) | GPL-2.0-or-later |
| [Stockfish](https://github.com/official-stockfish/Stockfish) via [stockfish.js](https://github.com/nmrugg/stockfish.js) | analyse et bot (`public/stockfish`, copié au build) | GPL-3.0 |
| [chess.js](https://github.com/jhlywa/chess.js) | règles du jeu | BSD-2-Clause |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | répétition espacée (FSRS) | MIT |
| [Dexie](https://dexie.org) | stockage local (IndexedDB) | Apache-2.0 |
| React, Framer Motion, Lucide | interface | MIT, MIT, ISC |

Chess SRS étant distribué avec chessground et Stockfish (GPL), l'ensemble est publié sous **GPL-3.0 ou ultérieure** (voir `LICENSE`).
