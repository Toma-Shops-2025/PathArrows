import { LEVELS } from './levels';
import { firstHint } from './engine';
import type { Arrow } from './engine';

export function isSolvable(levelIndex: number): boolean {
  const level = LEVELS[levelIndex];
  let arrows: Arrow[] = level.arrows.map((a) => ({ ...a }));
  while (arrows.length) {
    const id = firstHint(arrows, level.cols, level.rows);
    if (id == null) return false;
    arrows = arrows.filter((a) => a.id !== id);
  }
  return true;
}

export function allLevelsSolvable(): boolean {
  return LEVELS.every((_, i) => isSolvable(i));
}
