import { writeFileSync } from 'node:fs';
import { firstHint, hitsOwnBody, isClear } from '../src/lib/engine.ts';

const DIRS = ['U', 'D', 'L', 'R'];
const DELTA = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const ORTHO = { U: ['L', 'R'], D: ['L', 'R'], L: ['U', 'D'], R: ['U', 'D'] };

function cellsOf(arrow) {
  return arrow.path?.length ? arrow.path : [{ x: arrow.x, y: arrow.y }];
}

function occupied(arrows, x, y) {
  return arrows.some((a) => cellsOf(a).some((c) => c.x === x && c.y === y));
}

function inBounds(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function key(x, y) {
  return `${x},${y}`;
}

function dirFrom(path) {
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  if (b.x > a.x) return 'R';
  if (b.x < a.x) return 'L';
  if (b.y > a.y) return 'D';
  return 'U';
}

function coverage(level) {
  const seen = new Set();
  for (const a of level.arrows) {
    for (const c of cellsOf(a)) seen.add(key(c.x, c.y));
  }
  return seen.size / (level.cols * level.rows);
}

function solvable(level) {
  let arrows = level.arrows.map((a) => ({ ...a, path: a.path?.map((c) => ({ ...c })) }));
  while (arrows.length) {
    const id = firstHint(arrows, level.cols, level.rows);
    if (id == null) return false;
    arrows = arrows.filter((a) => a.id !== id);
  }
  return true;
}

function pickStart(cols, rows, blocked, rand, arrows) {
  const adjacent = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (blocked(x, y)) continue;
      if (
        arrows.length === 0 ||
        blocked(x + 1, y) ||
        blocked(x - 1, y) ||
        blocked(x, y + 1) ||
        blocked(x, y - 1)
      ) {
        adjacent.push({ x, y });
      }
    }
  }
  if (adjacent.length && rand() < 0.8) {
    return adjacent[Math.floor(rand() * adjacent.length)];
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rand() * cols);
    const y = Math.floor(rand() * rows);
    if (!blocked(x, y)) return { x, y };
  }
  return null;
}

function randomWalk(cols, rows, minLen, maxLen, blocked, rand, arrows) {
  const target = minLen + Math.floor(rand() * (maxLen - minLen + 1));
  for (let attempt = 0; attempt < 50; attempt++) {
    const start = pickStart(cols, rows, blocked, rand, arrows);
    if (!start) continue;
    let { x, y } = start;
    const path = [{ x, y }];
    const seen = new Set([key(x, y)]);
    let d = DIRS[Math.floor(rand() * 4)];
    let turns = 0;
    for (let i = 1; i < target; i++) {
      const options = [];
      for (const nd of [d, ...ORTHO[d]]) {
        const [dx, dy] = DELTA[nd];
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, cols, rows) || blocked(nx, ny) || seen.has(key(nx, ny))) continue;
        options.push({ nd, nx, ny, turn: nd !== d });
      }
      if (!options.length) break;
      const forward = options.filter((o) => !o.turn);
      const pick =
        forward.length && rand() < 0.6 ? forward[0] : options[Math.floor(rand() * options.length)];
      x = pick.nx;
      y = pick.ny;
      if (pick.turn) turns += 1;
      d = pick.nd;
      path.push({ x, y });
      seen.add(key(x, y));
    }
    if (path.length >= minLen && turns >= 1) return { path, dir: dirFrom(path) };
  }
  return null;
}

function makeLevel(id, cols, rows, targetCount, minLen, maxLen, seed) {
  const arrows = [];
  let n = seed;
  const rand = () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 0xffffffff;
  };
  const blocked = (x, y) => occupied(arrows, x, y);

  for (let i = 0; i < targetCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const built = randomWalk(cols, rows, minLen, maxLen, blocked, rand, arrows);
      if (!built) continue;
      const next = {
        id: arrows.length + 1,
        x: built.path[0].x,
        y: built.path[0].y,
        dir: built.dir,
        path: built.path,
      };
      // Never place an arrow whose tip aims back into its own body.
      if (hitsOwnBody(next, cols, rows)) continue;
      arrows.push(next);
      const level = { id, name: `Level ${id}`, cols, rows, arrows };
      if (!solvable(level)) {
        arrows.pop();
        continue;
      }
      placed = true;
    }
    if (!placed) break;
  }

  return { id, name: `Level ${id}`, cols, rows, arrows };
}

const specs = [
  [1, 10, 10, 16, 4, 9],
  [2, 10, 10, 18, 4, 10],
  [3, 11, 11, 20, 4, 10],
  [4, 11, 11, 22, 4, 11],
  [5, 12, 12, 24, 4, 11],
  [6, 12, 12, 26, 4, 12],
  [7, 13, 13, 28, 4, 12],
  [8, 13, 13, 30, 4, 12],
  [9, 14, 14, 32, 4, 13],
  [10, 14, 14, 34, 5, 13],
  [11, 15, 15, 36, 5, 14],
  [12, 15, 15, 38, 5, 14],
  [13, 16, 16, 40, 5, 14],
  [14, 16, 16, 42, 5, 15],
  [15, 16, 16, 44, 5, 15],
  [16, 17, 17, 46, 5, 15],
  [17, 17, 17, 48, 5, 16],
  [18, 18, 18, 50, 5, 16],
  [19, 18, 18, 52, 5, 16],
  [20, 18, 18, 54, 5, 17],
  [21, 19, 19, 56, 5, 17],
  [22, 19, 19, 58, 5, 17],
  [23, 20, 20, 60, 5, 18],
  [24, 20, 20, 62, 5, 18],
  [25, 20, 20, 64, 5, 18],
  [26, 20, 20, 66, 5, 19],
  [27, 20, 20, 68, 5, 19],
  [28, 20, 20, 70, 5, 19],
  [29, 20, 20, 72, 5, 20],
  [30, 20, 20, 74, 5, 20],
];

function writeLevels(levels) {
  writeFileSync(
    new URL('../src/lib/levels.ts', import.meta.url),
    `import type { Level } from './engine';\n\nexport const LEVELS: Level[] = ${JSON.stringify(levels, null, 2)};\n`
  );
}

const levels = [];
for (const [id, cols, rows, count, minLen, maxLen] of specs) {
  const minArrows = Math.floor(count * (id >= 28 ? 0.5 : 0.58));
  const minCov = Math.min(0.8, 0.32 + id * 0.012);
  const tries = id >= 26 ? 90 : 140;
  let found = null;
  let fallback = null;
  for (let seed = id * 131; seed < id * 131 + tries; seed++) {
    const level = makeLevel(id, cols, rows, count, minLen, maxLen, seed);
    const cov = coverage(level);
    const open = level.arrows.some((a) =>
      isClear(a, level.arrows.filter((o) => o.id !== a.id), cols, rows)
    );
    if (!open || !solvable(level)) continue;
    const score = cov * 100 + level.arrows.length;
    if (!fallback || score > fallback.score) fallback = { level, score, cov };
    if (level.arrows.length < minArrows) continue;
    if (cov < minCov) continue;
    found = level;
    break;
  }
  if (!found) found = fallback?.level;
  if (!found) throw new Error('Could not generate level ' + id);
  levels.push(found);
  writeLevels(levels);
  console.log(
    'Level',
    id,
    `${found.cols}x${found.rows}`,
    found.arrows.length,
    'arrows',
    `${Math.round(coverage(found) * 100)}% fill`
  );
}

console.log('Wrote', levels.length, 'levels');
