// Génère les packs de puzzles à partir de la base Lichess (CC0) lue sur stdin.
//   curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | node scripts/build-puzzles.mjs public/puzzles
// Un fichier par thème : les K meilleurs puzzles (popularité) par tranche de 200 Elo.
import { createInterface } from 'node:readline';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const outDir = process.argv[2] ?? 'public/puzzles';
const THEMES = JSON.parse(readFileSync(new URL('../src/data/themes.json', import.meta.url), 'utf8'));
const KEEP = new Set(THEMES.map((t) => t.key));
const PER_BUCKET = 250;
const MIN_PLAYS = 100;
const BUCKET = 200;

const pools = new Map(); // "theme|bucket" -> [{score, entry}]
let cols = null;
let rows = 0;
let kept = 0;

function add(key, item) {
  let pool = pools.get(key);
  if (!pool) pools.set(key, (pool = []));
  pool.push(item);
  if (pool.length > PER_BUCKET * 2) {
    pool.sort((a, b) => b.score - a.score);
    pool.length = PER_BUCKET;
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  const f = line.split(',');
  if (!cols) {
    cols = Object.fromEntries(f.map((name, i) => [name.trim(), i]));
    for (const need of ['PuzzleId', 'FEN', 'Moves', 'Rating', 'Popularity', 'NbPlays', 'Themes']) {
      if (!(need in cols)) throw new Error(`Colonne manquante : ${need}`);
    }
    continue;
  }
  rows++;
  const plays = Number(f[cols.NbPlays]);
  if (plays < MIN_PLAYS) continue;
  const rating = Number(f[cols.Rating]);
  const themes = f[cols.Themes].split(' ').filter((t) => KEEP.has(t));
  if (!themes.length) continue;
  const entry = [f[cols.PuzzleId], f[cols.FEN], f[cols.Moves], rating, themes.join(' ')];
  const score = Number(f[cols.Popularity]) * 1e6 + Math.min(plays, 999999);
  const bucket = Math.min(14, Math.max(3, Math.floor(rating / BUCKET)));
  for (const theme of themes) add(`${theme}|${bucket}`, { score, entry });
  kept++;
}

mkdirSync(outDir, { recursive: true });
const index = {};
for (const { key } of THEMES) {
  const merged = [];
  for (let b = 3; b <= 14; b++) {
    const pool = pools.get(`${key}|${b}`);
    if (!pool) continue;
    pool.sort((a, c) => c.score - a.score);
    merged.push(...pool.slice(0, PER_BUCKET).map((p) => p.entry));
  }
  if (!merged.length) continue;
  merged.sort((a, b) => a[3] - b[3]);
  writeFileSync(`${outDir}/${key}.json`, JSON.stringify(merged));
  index[key] = { count: merged.length, min: merged[0][3], max: merged[merged.length - 1][3] };
}
writeFileSync(
  `${outDir}/index.json`,
  JSON.stringify({ generated: new Date().toISOString(), source: 'database.lichess.org (CC0)', themes: index }),
);
console.log(`Puzzles lus : ${rows}, retenus : ${kept}, thèmes écrits : ${Object.keys(index).length}`);
