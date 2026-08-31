import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readVolumeSettings, setMuted, setVolume, subscribeVolume } from '@/lib/bgm';

export function VolumeBar({ className = 'bottom-4' }: { className?: string }) {
  const [volume, setVol] = useState(() => readVolumeSettings().volume);
  const [isMuted, setIsMuted] = useState(() => readVolumeSettings().muted);

  useEffect(() => subscribeVolume(() => {
    const s = readVolumeSettings();
    setVol(s.volume);
    setIsMuted(s.muted);
  }), []);

  return (
    <div
      className={`fixed left-3 right-3 z-[70] flex items-center gap-3 bg-[#050814]/95 border border-sky-400/40 rounded-2xl px-4 py-3 backdrop-blur-xl shadow-[0_0_24px_rgba(56,189,248,0.15)] ${className}`}
    >
      <button
        type="button"
        onClick={() => setMuted(!isMuted)}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className={`shrink-0 p-2.5 rounded-xl border active:scale-95 transition-transform ${
          isMuted ? 'bg-white/5 border-white/10' : 'bg-sky-400/20 border-sky-400/50'
        }`}
      >
        {isMuted ? <VolumeX className="h-6 w-6 text-white/40" /> : <Volume2 className="h-6 w-6 text-sky-400" />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((isMuted ? 0 : volume) * 100)}
        onChange={(e) => {
          const next = Number(e.target.value) / 100;
          setVolume(next);
          setVol(next);
          if (next > 0 && isMuted) {
            setMuted(false);
            setIsMuted(false);
          }
        }}
        className="flex-1 h-2 accent-sky-400 cursor-pointer"
        aria-label="Volume"
      />
      <span className="text-[11px] font-black text-sky-400 w-8 text-right tabular-nums">
        {isMuted ? 0 : Math.round(volume * 100)}
      </span>
    </div>
  );
}
