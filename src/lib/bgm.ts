const VOL_KEY = 'patharrows_volume';
const MUTE_KEY = 'patharrows_muted';
export const DEFAULT_VOLUME = 0.25;

const listeners = new Set<() => void>();

export function readVolumeSettings() {
  if (typeof window === 'undefined') return { volume: DEFAULT_VOLUME, muted: false };
  const raw = localStorage.getItem(VOL_KEY);
  const parsed = raw != null ? parseFloat(raw) : DEFAULT_VOLUME;
  return {
    volume: Number.isNaN(parsed) ? DEFAULT_VOLUME : Math.min(1, Math.max(0, parsed)),
    muted: localStorage.getItem(MUTE_KEY) === '1',
  };
}

export function getEffectiveVolume() {
  const { volume, muted } = readVolumeSettings();
  return muted ? 0 : volume;
}

export function setVolume(v: number) {
  localStorage.setItem(VOL_KEY, String(Math.min(1, Math.max(0, v))));
  applyToRegistered();
  listeners.forEach((fn) => fn());
}

export function setMuted(m: boolean) {
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  applyToRegistered();
  listeners.forEach((fn) => fn());
}

export function subscribeVolume(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyToRegistered() {
  if (typeof window === 'undefined') return;
  const main = document.getElementById(BGM_ID) as HTMLAudioElement | null;
  if (main) applyEl(main);
  if (window.__pathArrowsBgm) applyEl(window.__pathArrowsBgm);
}

function applyEl(el: HTMLAudioElement) {
  const { volume, muted } = readVolumeSettings();
  el.muted = muted;
  el.volume = muted ? 0 : volume;
}

declare global {
  interface Window {
    __pathArrowsBgm?: HTMLAudioElement;
    __pathArrowsBgmPool?: Set<HTMLAudioElement>;
    __pathArrowsBgmHooks?: boolean;
  }
}

const BGM_ID = 'patharrows-bgm';
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
  applyEl(el);
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
