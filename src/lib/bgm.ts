declare global {
  interface Window {
    __pathArrowsBgm?: HTMLAudioElement;
    __pathArrowsBgmPool?: Set<HTMLAudioElement>;
    __pathArrowsBgmHooks?: boolean;
  }
}

const BGM_ID = 'patharrows-bgm';
// Android asset FS is case-sensitive — file must be promo.mp3 (not promo.MP3).
const BGM_SRC = '/audio/promo.mp3';

let owners = 0;
let gestureHooked = false;

function pool(): Set<HTMLAudioElement> {
  if (typeof window === 'undefined') return new Set();
  if (!window.__pathArrowsBgmPool) window.__pathArrowsBgmPool = new Set();
  return window.__pathArrowsBgmPool;
}

function isPromoSrc(src: string) {
  return /promo\.mp3/i.test(src);
}

/** Stop detached/orphan promo players only — never strip the main element. */
function silenceOrphans() {
  for (const el of pool()) {
    const main = typeof document !== 'undefined' ? document.getElementById(BGM_ID) : null;
    if (el === main) continue;
    el.pause();
    el.removeAttribute('src');
    el.load();
    pool().delete(el);
  }

  if (typeof document === 'undefined') return;
  const main = document.getElementById(BGM_ID);
  for (const el of document.querySelectorAll('audio')) {
    if (el === main) continue;
    if (!isPromoSrc(el.currentSrc || el.src)) continue;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }
}

function getBgm(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(BGM_ID) as HTMLAudioElement | null;
  if (!el) {
    el = document.createElement('audio');
    el.id = BGM_ID;
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', 'true');
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  if (!el.src || !isPromoSrc(el.currentSrc || el.src)) {
    el.src = BGM_SRC;
  }
  el.loop = true;
  el.volume = 0.35;
  window.__pathArrowsBgm = el;
  pool().add(el);
  return el;
}

function tryPlay() {
  if (typeof document === 'undefined' || document.hidden) return;
  silenceOrphans();
  const audio = getBgm();
  if (!audio) return;
  if (!audio.paused) return;
  audio.play().catch(() => hookGestureOnce());
}

function hookGestureOnce() {
  if (gestureHooked || typeof window === 'undefined') return;
  gestureHooked = true;
  const resume = () => {
    tryPlay();
    gestureHooked = false;
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true, passive: true });
}

function pauseBgm() {
  const audio = getBgm();
  if (audio) audio.pause();
}

function installGlobalHooks() {
  if (typeof window === 'undefined' || window.__pathArrowsBgmHooks) return;
  window.__pathArrowsBgmHooks = true;

  window.addEventListener('pagehide', pauseBgm);
  window.addEventListener('beforeunload', pauseBgm);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseBgm();
    else if (owners > 0) tryPlay();
  });
}

/** Call once when the app mounts. Returns a cleanup for unmount. */
export function acquireBgm() {
  installGlobalHooks();
  silenceOrphans();
  owners += 1;
  tryPlay();
  return () => {
    owners = Math.max(0, owners - 1);
    if (owners === 0) stopBgm();
  };
}

export function stopBgm() {
  pauseBgm();
  silenceOrphans();
}

export function resumeBgm() {
  tryPlay();
}

if (typeof window !== 'undefined') {
  installGlobalHooks();
  silenceOrphans();
}
