// Fabrique src/data/openings.json (position -> nom d'ouverture) depuis les fichiers a.tsv … e.tsv du dépôt
// lichess-org/chess-openings (domaine public CC0).
//   node scripts/build-openings.mjs <dossier contenant a.tsv … e.tsv> [sortie.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const dir = process.argv[2];
const out = process.argv[3] ?? 'src/data/openings.json';
if (!dir) throw new Error('Usage : node scripts/build-openings.mjs <dossier> [sortie.json]');

const key = (fen) => fen.split(' ').slice(0, 3).join(' ');
const book = {};
let rows = 0;
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(`${dir}/${f}.tsv`, 'utf8').split('\n').slice(1);
  for (const line of lines) {
    const [, name, pgn] = line.split('\t');
    if (!name || !pgn) continue;
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      continue;
    }
    rows++;
    book[key(chess.fen())] ??= name;
  }
}
writeFileSync(out, JSON.stringify(book));
console.log(`${rows} ouvertures lues, ${Object.keys(book).length} positions écrites dans ${out}`);
