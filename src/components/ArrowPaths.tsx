import { cellsOf, D, type Arrow } from '@/lib/engine';

const INK = '#1a4a8c';
const HINT = '#3b82f6';

function polyline(cells: { x: number; y: number }[], cell: number) {
  if (cells.length === 0) return '';
  const pts = cells.map((c) => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell }));
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  return `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
}

function heading(cells: { x: number; y: number }[], fallback: Arrow['dir']) {
  if (cells.length >= 2) {
    const a = cells[cells.length - 2];
    const b = cells[cells.length - 1];
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  }
  return { R: 0, D: 90, L: 180, U: 270 }[fallback];
}

function trimPathForHead(cells: { x: number; y: number }[], cell: number, dir: Arrow['dir']) {
  if (cells.length < 2) return polyline(cells, cell);
  const pts = cells.map((c) => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell }));
  const tip = pts[pts.length - 1];
  const { dx, dy } = D[dir];
  const trim = cell * 0.28;
  const end = { x: tip.x - dx * trim, y: tip.y - dy * trim };
  const body = pts.slice(0, -1);
  return `M ${body.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${end.x} ${end.y}`;
}

function renderArrowPath(
  arrow: Arrow,
  cells: { x: number; y: number }[],
  cell: number,
  stroke: number,
  head: number,
  hinted: boolean,
  key?: string | number
) {
  if (cells.length < 1) return null;
  const color = hinted ? HINT : INK;
  const tip = cells[cells.length - 1];
  const tx = (tip.x + 0.5) * cell;
  const ty = (tip.y + 0.5) * cell;
  const angle = heading(cells, arrow.dir);
  const d =
    cells.length === 1
      ? (() => {
          const { dx, dy } = D[arrow.dir];
          const back = cell * 0.22;
          return `M ${tx - dx * back} ${ty - dy * back} L ${tx - dx * (head * 0.2)} ${ty - dy * (head * 0.2)}`;
        })()
      : trimPathForHead(cells, cell, arrow.dir);

  return (
    <g key={key ?? arrow.id}>
      <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <polygon
        points={`${head * 0.55},0 ${-head * 0.34},${-head * 0.38} ${-head * 0.34},${head * 0.38}`}
        transform={`translate(${tx} ${ty}) rotate(${angle})`}
        fill={color}
      />
    </g>
  );
}

export function ArrowPaths({
  cols,
  rows,
  cell,
  arrows,
  hintId,
  motion,
}: {
  cols: number;
  rows: number;
  cell: number;
  arrows: Arrow[];
  hintId: number | null;
  motion: { id: number; arrow: Arrow; cells: { x: number; y: number }[] } | null;
}) {
  const stroke = Math.max(4, cell * 0.22);
  const head = cell * 0.48;
  // Extra SVG margin so arrows stay visible while they sliver off every edge.
  const pad = cell * 3;
  const width = cols * cell;
  const height = rows * cell;

  return (
    <svg
      className="absolute pointer-events-none overflow-visible"
      aria-hidden
      width={width + pad * 2}
      height={height + pad * 2}
      style={{ left: -pad, top: -pad, overflow: 'visible' }}
    >
      <g transform={`translate(${pad}, ${pad})`}>
        {arrows
          .filter((arrow) => arrow.id !== motion?.id)
          .map((arrow) => renderArrowPath(arrow, cellsOf(arrow), cell, stroke, head, hintId === arrow.id))}
        {motion &&
          motion.cells.length > 0 &&
          renderArrowPath(motion.arrow, motion.cells, cell, stroke, head, hintId === motion.id, `motion-${motion.id}`)}
      </g>
    </svg>
  );
}
