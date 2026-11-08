// Copie le moteur Stockfish « lite » (WASM, 1 thread) du paquet npm vers public/stockfish.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const pkg = 'node_modules/stockfish';
const dest = 'public/stockfish';
if (!existsSync(`${pkg}/bin`)) {
  console.warn('Paquet stockfish absent : analyse Stockfish indisponible (npm install).');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) cpSync(`${pkg}/bin/${f}`, `${dest}/${f}`);
cpSync(`${pkg}/Copying.txt`, `${dest}/Copying.txt`); // licence GPL-3.0
console.log('Stockfish copié dans', dest);
