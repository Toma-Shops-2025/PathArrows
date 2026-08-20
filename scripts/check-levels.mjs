import { LEVELS } from '../src/lib/levels.ts';
import { firstHint } from '../src/lib/engine.ts';

let failed = 0;
for (let i = 0; i < LEVELS.length; i++) {
  const level = LEVELS[i];
  let arrows = level.arrows.map((a) => ({ ...a }));
  let ok = true;
  while (arrows.length) {
    const id = firstHint(arrows, level.cols, level.rows);
    if (id == null) {
      ok = false;
      break;
    }
    arrows = arrows.filter((a) => a.id !== id);
  }
  if (!ok) {
    failed += 1;
    console.log('UNSOLVABLE', level.id);
  }
}
if (failed) {
  console.log('FAILED', failed);
  process.exit(1);
}
console.log('All', LEVELS.length, 'levels solvable');
