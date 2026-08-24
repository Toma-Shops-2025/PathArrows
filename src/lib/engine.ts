export type Dir = 'U' | 'D' | 'L' | 'R';

export interface Arrow {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  path?: { x: number; y: number }[];
}

export interface Level {
  id: number;
  name: string;
  cols: number;
  rows: number;
  arrows: Arrow[];
}

export const D: Record<Dir, { dx: number; dy: number }> = {
  U: { dx: 0, dy: -1 },
  D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 },
  R: { dx: 1, dy: 0 },
};

export function cellsOf(arrow: Arrow): { x: number; y: number }[] {
  if (arrow.path && arrow.path.length) return arrow.path;
  return [{ x: arrow.x, y: arrow.y }];
}

export function occupies(arrow: Arrow, x: number, y: number): boolean {
  return cellsOf(arrow).some((c) => c.x === x && c.y === y);
}

/** Exit ray from the tip must not hit another arrow OR this arrow's own body. */
export function hitsOwnBody(arrow: Arrow, cols: number, rows: number): boolean {
  const body = cellsOf(arrow);
  if (body.length < 2) return false;
  const { dx, dy } = D[arrow.dir];
  const tip = body[body.length - 1];
  const self = new Set(body.slice(0, -1).map((c) => `${c.x},${c.y}`));
  let x = tip.x + dx;
  let y = tip.y + dy;
  while (x >= 0 && x < cols && y >= 0 && y < rows) {
    if (self.has(`${x},${y}`)) return true;
    x += dx;
    y += dy;
  }
  return false;
}

export function isClear(arrow: Arrow, others: Arrow[], cols: number, rows: number): boolean {
  if (hitsOwnBody(arrow, cols, rows)) return false;
  const { dx, dy } = D[arrow.dir];
  const start = cellsOf(arrow)[cellsOf(arrow).length - 1];
  let x = start.x + dx;
  let y = start.y + dy;
  while (x >= 0 && x < cols && y >= 0 && y < rows) {
    if (others.some((a) => occupies(a, x, y))) return false;
    x += dx;
    y += dy;
  }
  return true;
}

export function firstHint(arrows: Arrow[], cols: number, rows: number): number | null {
  const found = arrows.find((a) => isClear(a, arrows.filter((o) => o.id !== a.id), cols, rows));
  return found ? found.id : null;
}

/** Body path + a long straight runway past the tip so the arrow can fully leave the board. */
export function unwindTrack(arrow: Arrow, cols: number, rows: number): { x: number; y: number }[] {
  const body = cellsOf(arrow).map((c) => ({ ...c }));
  const { dx, dy } = D[arrow.dir];
  const tip = body[body.length - 1];
  // Runway long enough to clear the board from any tip position.
  const runway = Math.max(cols, rows) + body.length + 2;
  let x = tip.x;
  let y = tip.y;
  for (let i = 0; i < runway; i++) {
    x += dx;
    y += dy;
    body.push({ x, y });
  }
  return body;
}

/**
 * Unwind / sliver: eat from the tail while the tip leads out the exit runway.
 * progress 0 = full body on board, 1 = fully off.
 */
export function unwindSlice(
  track: { x: number; y: number }[],
  bodyLength: number,
  progress: number,
  maxSamples = 24
): { x: number; y: number }[] {
  if (track.length === 0) return [];
  const p = Math.max(0, Math.min(1, progress));
  const max = track.length - 1;
  const bodyTip = Math.max(0, bodyLength - 1);

  // Tip travels from end of body → end of runway.
  const tip = bodyTip + p * (max - bodyTip);
  // Tail catches up from 0 → tip so the ribbon shortens and leaves.
  const tail = p * tip;

  if (tip - tail < 0.08) {
    const i0 = Math.min(Math.floor(tip), max);
    const i1 = Math.min(i0 + 1, max);
    const f = tip - Math.floor(tip);
    const a = track[i0];
    const b = track[i1];
    const tipPt = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    const backI = Math.max(0, i0 - 1);
    return [track[backI], tipPt];
  }

  const span = tip - tail;
  const sampleCap = Math.max(4, Math.min(maxSamples, 24));
  const samples = Math.max(2, Math.min(sampleCap, Math.ceil(span) + 2));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const t = tail + (span * i) / (samples - 1);
    const i0 = Math.min(Math.floor(t), max);
    const i1 = Math.min(i0 + 1, max);
    const f = t - Math.floor(t);
    const a = track[i0];
    const b = track[i1];
    pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return pts;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function cellCenter(c: { x: number; y: number }, cell: number) {
  return { x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell };
}

/** Find the arrow closest to a board pixel (generous hit area for thick strokes + heads). */
export function pickArrowAt(
  px: number,
  py: number,
  arrows: Arrow[],
  cell: number
): Arrow | null {
  if (cell <= 0 || arrows.length === 0) return null;
  const hit = cell * 0.42;
  let best: { arrow: Arrow; dist: number } | null = null;

  for (const arrow of arrows) {
    const cells = cellsOf(arrow);
    for (let i = 0; i < cells.length; i++) {
      const { x, y } = cellCenter(cells[i], cell);
      const d = Math.hypot(px - x, py - y);
      if (d <= hit && (!best || d < best.dist)) best = { arrow, dist: d };
    }
    for (let i = 1; i < cells.length; i++) {
      const a = cellCenter(cells[i - 1], cell);
      const b = cellCenter(cells[i], cell);
      const d = distToSegment(px, py, a.x, a.y, b.x, b.y);
      if (d <= hit && (!best || d < best.dist)) best = { arrow, dist: d };
    }
    const tip = cellCenter(cells[cells.length - 1], cell);
    const { dx, dy } = D[arrow.dir];
    const headX = tip.x + dx * cell * 0.35;
    const headY = tip.y + dy * cell * 0.35;
    const d = distToSegment(px, py, tip.x, tip.y, headX, headY);
    if (d <= hit && (!best || d < best.dist)) best = { arrow, dist: d };
  }

  return best?.arrow ?? null;
}
