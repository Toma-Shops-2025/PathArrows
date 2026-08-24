import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { Heart, Lightbulb, RotateCcw, Settings, ChevronLeft, Send } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { LEVELS } from '@/lib/levels';
import { cellsOf, firstHint, isClear, pickArrowAt, unwindSlice, unwindTrack, type Arrow } from '@/lib/engine';
import { initAds, setBannerVisible, showInterstitial, showRewardedAd } from '@/lib/ads';
import { ArrowPaths } from '@/components/ArrowPaths';
import { acquireBgm, resumeBgm } from '@/lib/bgm';
import { cn } from '@/lib/utils';

const LIVES = 3;
const STORAGE_KEY = 'patharrows-progress';
/** Native WebView: keep snake unwind, but fewer SVG rebuilds so it stays stable. */
const NATIVE = Capacitor.isNativePlatform();

function difficultyLabel(cols: number) {
  if (cols <= 10) return 'Easy';
  if (cols <= 14) return 'Normal';
  return 'Hard';
}

function cloneArrows(arrows: Arrow[]): Arrow[] {
  return arrows.map((a) => ({ ...a, path: a.path?.map((c) => ({ ...c })) }));
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: 1, hints: 2 };
    return JSON.parse(raw) as { unlocked: number; hints: number };
  } catch {
    return { unlocked: 1, hints: 2 };
  }
}

export default function App() {
  const saved = useMemo(loadProgress, []);
  const [screen, setScreen] = useState<'home' | 'play' | 'win' | 'lose'>('home');
  const [levelIndex, setLevelIndex] = useState(Math.max(0, saved.unlocked - 1));
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [lives, setLives] = useState(LIVES);
  const [hints, setHints] = useState(saved.hints);
  const [hintId, setHintId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(saved.unlocked);
  const [motion, setMotion] = useState<{
    id: number;
    arrow: Arrow;
    cells: { x: number; y: number }[];
  } | null>(null);
  const [splash, setSplash] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const winsRef = useRef(0);
  const motionFrame = useRef<number | null>(null);
  const motionSafety = useRef<number | null>(null);
  const motionSession = useRef(0);
  const animatingRef = useRef(false);
  const arrowsRef = useRef(arrows);
  arrowsRef.current = arrows;

  const level = LEVELS[levelIndex];

  useEffect(() => acquireBgm(), []);

  useEffect(() => {
    const t = window.setTimeout(() => setSplash(false), 1400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (motionFrame.current != null) cancelAnimationFrame(motionFrame.current);
    };
  }, []);

  useEffect(() => {
    initAds().catch(() => undefined);
  }, []);

  useEffect(() => {
    // Hide banner during play — Unity banner attach/resize mid-level crashes WebView on some phones.
    if (screen === 'home') {
      setBannerVisible(true).catch(() => undefined);
    } else {
      setBannerVisible(false).catch(() => undefined);
    }
  }, [screen]);

  useEffect(() => {
    document.body.classList.toggle('pa-playing', screen !== 'home');
    return () => document.body.classList.remove('pa-playing');
  }, [screen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked, hints }));
  }, [unlocked, hints]);

  const startLevel = useCallback((index: number) => {
    const next = LEVELS[index];
    setLevelIndex(index);
    setArrows(cloneArrows(next.arrows));
    setLives(LIVES);
    setHintId(null);
    setMotion(null);
    animatingRef.current = false;
    if (motionFrame.current != null) cancelAnimationFrame(motionFrame.current);
    motionFrame.current = null;
    if (motionSafety.current != null) window.clearTimeout(motionSafety.current);
    motionSafety.current = null;
    motionSession.current += 1;
    setScreen('play');
  }, []);

  const tapArrow = useCallback(
    (arrow: Arrow) => {
      try {
        if (screen !== 'play' || animatingRef.current) return;
        const current = arrowsRef.current;
        const others = current.filter((a) => a.id !== arrow.id);
        if (!isClear(arrow, others, level.cols, level.rows)) {
          const nextLives = lives - 1;
          setLives(nextLives);
          toast.error('Blocked — that path is not free');
          if (nextLives <= 0) setScreen('lose');
          return;
        }
        if (motionFrame.current != null) cancelAnimationFrame(motionFrame.current);
        if (motionSafety.current != null) window.clearTimeout(motionSafety.current);

        setHintId(null);
        const finishClear = () => {
          animatingRef.current = false;
          setMotion(null);
          if (others.length === 0) {
            const nextUnlocked = Math.max(unlocked, levelIndex + 2);
            setUnlocked(Math.min(nextUnlocked, LEVELS.length));
            setScreen('win');
            winsRef.current += 1;
            if (winsRef.current % 3 === 0) {
              window.setTimeout(() => {
                showInterstitial().catch(() => undefined);
              }, 600);
            }
          }
        };

        const body = cellsOf(arrow);
        const track = unwindTrack(arrow, level.cols, level.rows);
        // Native: snappier crawl + fewer path samples / setState ticks (avoids WebView OOM).
        const duration = NATIVE
          ? Math.min(720, Math.max(280, body.length * 42 + Math.max(level.cols, level.rows) * 14))
          : Math.min(1400, Math.max(450, body.length * 70 + Math.max(level.cols, level.rows) * 22));
        const frameSkip = NATIVE ? 4 : 2;
        const maxSamples = NATIVE ? 10 : 24;
        const start = performance.now();
        const session = motionSession.current + 1;
        motionSession.current = session;
        animatingRef.current = true;
        setArrows(others);
        setMotion({ id: arrow.id, arrow, cells: body.map((c) => ({ ...c })) });

        const finish = () => {
          if (session !== motionSession.current) return;
          if (motionFrame.current != null) {
            cancelAnimationFrame(motionFrame.current);
            motionFrame.current = null;
          }
          if (motionSafety.current != null) {
            window.clearTimeout(motionSafety.current);
            motionSafety.current = null;
          }
          finishClear();
        };

        motionSafety.current = window.setTimeout(finish, duration + 400);

        let frame = 0;
        const tick = (now: number) => {
          if (session !== motionSession.current) return;
          const t = Math.min(1, (now - start) / duration);
          // Ease-in then accelerate out — reads like a snake shooting off the board.
          const eased = t * t * (3 - 2 * t);
          frame += 1;
          if (frame % frameSkip === 0 || t >= 1) {
            setMotion({
              id: arrow.id,
              arrow,
              cells: unwindSlice(track, body.length, eased, maxSamples),
            });
          }
          if (t < 1) {
            motionFrame.current = requestAnimationFrame(tick);
            return;
          }
          finish();
        };
        motionFrame.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('tapArrow failed', err);
        animatingRef.current = false;
        setMotion(null);
        toast.error('Something went wrong — try again');
      }
    },
    [screen, lives, level.cols, level.rows, levelIndex, unlocked]
  );

  const useHint = async () => {
    if (busy || screen !== 'play') return;
    if (hints <= 0) {
      setBusy(true);
      const ad = await showRewardedAd();
      setBusy(false);
      if (!ad.success) return;
      setHints((h) => h + 2);
      toast.success('+2 hints');
      return;
    }
    const id = firstHint(arrows, level.cols, level.rows);
    if (id == null) return;
    setHints((h) => h - 1);
    setHintId(id);
  };

  const refillLives = async () => {
    setBusy(true);
    const ad = await showRewardedAd();
    setBusy(false);
    if (!ad.success) return;
    setLives(LIVES);
    setScreen('play');
    toast.success('Lives refilled');
  };

  const hardLevel = difficultyLabel(level.cols) === 'Hard';

  return (
    <div className="app-shell min-h-screen text-white flex flex-col items-center pb-24">
      {splash && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#050814] cursor-pointer"
          onPointerDown={() => {
            setSplash(false);
            resumeBgm();
          }}
          role="button"
          aria-label="Tap to continue"
        >
          <img
            src="/logo.png"
            alt="Path Arrows"
            className="w-64 h-64 rounded-3xl object-cover shadow-neon border border-sky/40"
          />
          <p className="mt-6 text-sm font-bold tracking-[0.2em] text-sky uppercase title-neon">Follow the arrows</p>
        </div>
      )}
      <Toaster richColors position="top-center" />
      <header className="w-full max-w-md px-4 pt-10 pb-2 flex items-center justify-between">
        <button
          type="button"
          className="h-10 w-10 rounded-full btn-neon flex items-center justify-center"
          onClick={() => setScreen('home')}
          aria-label="Home"
        >
          <ChevronLeft className="h-5 w-5 text-sky" />
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-white title-neon">Path Arrows</h1>
          {screen !== 'home' && (
            <p className={cn('text-sm font-semibold', hardLevel ? 'text-hard' : 'text-sky')}>
              Level {level.id}
            </p>
          )}
        </div>
        <button
          type="button"
          className="h-10 w-10 rounded-full btn-neon flex items-center justify-center"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-5 w-5 text-sky" />
        </button>
      </header>

      {screen === 'home' && (
        <main className="w-full max-w-md px-5 mt-4">
          <img
            src="/logo.png"
            alt="Path Arrows"
            className="w-40 h-40 mx-auto mb-4 rounded-3xl object-cover shadow-neon border border-sky/30"
          />
          <p className="text-center text-sm text-sky-100/90 mb-6 chip-neon rounded-2xl px-4 py-3 font-medium">
            Tap an arrow only when its path is clear. Clear the board to win.
          </p>
          <div className="grid grid-cols-5 gap-2">
            {LEVELS.map((lvl, i) => {
              const locked = i + 1 > unlocked;
              const hard = difficultyLabel(lvl.cols) === 'Hard';
              return (
                <button
                  key={lvl.id}
                  disabled={locked}
                  onClick={() => startLevel(i)}
                  className={cn(
                    'aspect-square rounded-2xl font-black text-sm border transition active:scale-95',
                    locked
                      ? 'bg-slate-900/50 text-slate-500 border-slate-700'
                      : hard
                        ? 'bg-slate-900/80 text-hard border-hard/50 shadow-neon-hard'
                        : 'bg-slate-900/80 text-sky border-sky/40 shadow-neon'
                  )}
                >
                  {lvl.id}
                </button>
              );
            })}
          </div>
        </main>
      )}

      {screen !== 'home' && (
        <>
          <div className="w-full max-w-[34rem] px-5 flex items-center justify-between mt-2">
            <span className="text-sm font-bold chip-neon rounded-full px-3 py-1 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-sky" />
              {arrows.length}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  className={cn('h-5 w-5', i < lives ? 'fill-hard text-hard drop-shadow-[0_0_6px_rgba(251,113,133,0.8)]' : 'text-slate-600')}
                />
              ))}
            </div>
            <span
              className={cn(
                'text-sm font-bold chip-neon rounded-full px-3 py-1',
                hardLevel && 'border-hard/50 text-hard shadow-neon-hard'
              )}
            >
              {difficultyLabel(level.cols)}
            </span>
          </div>

          <div className="w-full max-w-[min(96vw,44rem)] px-3 mt-4 overflow-visible">
            <Board
              cols={level.cols}
              rows={level.rows}
              arrows={arrows}
              hintId={hintId}
              motion={motion}
              hard={hardLevel}
              animatingRef={animatingRef}
              onTap={tapArrow}
            />
          </div>

          <div className="flex items-end gap-5 mt-8">
            <button
              type="button"
              onClick={useHint}
              className="relative h-[72px] w-[72px] rounded-full btn-neon flex items-center justify-center"
            >
              <Lightbulb className="h-8 w-8 text-amber-300 fill-amber-300/80 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="absolute -top-1 -right-1 h-6 min-w-6 px-1 rounded-full bg-sky text-slate-950 text-xs font-black flex items-center justify-center shadow-neon">
                {hints}
              </span>
            </button>
            <button
              type="button"
              onClick={() => startLevel(levelIndex)}
              className="h-14 w-14 rounded-full btn-neon flex items-center justify-center"
              aria-label="Reset level"
            >
              <RotateCcw className="h-6 w-6 text-sky" />
            </button>
          </div>
        </>
      )}

      {screen === 'win' && (
        <Overlay
          title="Level complete"
          action={levelIndex + 1 < LEVELS.length ? 'Next level' : 'Finish'}
          onAction={() => {
            if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
            else setScreen('home');
          }}
          secondary="Home"
          onSecondary={() => setScreen('home')}
        />
      )}

      {screen === 'lose' && (
        <Overlay
          title="Out of lives"
          action={busy ? 'Loading…' : 'Watch ad to continue'}
          onAction={refillLives}
          secondary="Retry"
          onSecondary={() => startLevel(levelIndex)}
        />
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl p-6 border border-sky/30 bg-slate-950/95 shadow-neon"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black mb-4 title-neon">Settings</h2>
            <a className="block font-semibold text-sky py-2" href="/privacy.html">
              Privacy
            </a>
            <a className="block font-semibold text-sky py-2" href="/terms.html">
              Terms
            </a>
            <button
              type="button"
              className="mt-4 w-full bg-sky text-slate-950 font-black py-3 rounded-full shadow-neon"
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Overlay({
  title,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  title: string;
  action: string;
  onAction: () => void;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col items-center justify-center p-8 text-white backdrop-blur-sm">
      <h2 className="text-3xl font-black mb-8 title-neon">{title}</h2>
      <button
        type="button"
        onClick={onAction}
        className="w-full max-w-xs bg-sky text-slate-950 font-black py-4 rounded-full shadow-neon"
      >
        {action}
      </button>
      <button type="button" onClick={onSecondary} className="mt-4 font-bold text-sky underline">
        {secondary}
      </button>
    </div>
  );
}

function Board({
  cols,
  rows,
  arrows,
  hintId,
  motion,
  hard,
  animatingRef,
  onTap,
}: {
  cols: number;
  rows: number;
  arrows: Arrow[];
  hintId: number | null;
  motion: { id: number; arrow: Arrow; cells: { x: number; y: number }[] } | null;
  hard: boolean;
  animatingRef: MutableRefObject<boolean>;
  onTap: (arrow: Arrow) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0);
  const lastTapRef = useRef(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setCell(el.clientWidth / cols);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

  const handleBoardTap = (clientX: number, clientY: number) => {
    resumeBgm();
    if (animatingRef.current) return;
    const el = wrapRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) return;
    lastTapRef.current = now;
    const rect = el.getBoundingClientRect();
    const cellNow = rect.width / cols;
    if (cellNow <= 0) return;
    const arrow = pickArrowAt(clientX - rect.left, clientY - rect.top, arrows, cellNow);
    if (arrow) onTap(arrow);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    handleBoardTap(e.clientX, e.clientY);
  };

  return (
    <div className={cn('relative rounded-[1.75rem] mx-auto p-2 sm:p-3 w-full max-w-[min(96vw,44rem)] overflow-visible board-neon', hard && 'hard')}>
      <div
        ref={wrapRef}
        className="relative w-full touch-manipulation cursor-pointer select-none overflow-visible rounded-2xl bg-slate-950/80"
        style={{ aspectRatio: `${cols} / ${rows}`, touchAction: 'manipulation' }}
        onPointerUp={handlePointerUp}
      >
        {cell > 0 && (
          <ArrowPaths
            cols={cols}
            rows={rows}
            cell={cell}
            arrows={arrows}
            hintId={hintId}
            motion={motion}
            hard={hard}
          />
        )}
      </div>
    </div>
  );
}
