import { useEffect, useSyncExternalStore } from "react";

/**
 * The timer's voice and beeps (ADR 0021 amendment): short synthesised tones
 * through WebAudio — no assets — and speech synthesis for what comes next.
 * Both need a user gesture first; `arm()` is called on Start.
 */

let ctx: AudioContext | null = null;

export function arm(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* no audio here */
  }
}

function tone(freq: number, seconds: number, gain = 0.25, at = 0): void {
  if (!ctx || muted()) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + at;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.setValueAtTime(gain, t0 + seconds - 0.03);
    g.gain.linearRampToValueAtTime(0, t0 + seconds);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds);
  } catch {
    /* ignore */
  }
}

/** The 3-2-1 tick. */
export function beepCount(): void {
  tone(880, 0.1);
}
/** Interval change: a higher, longer note. */
export function beepGo(): void {
  tone(1320, 0.28, 0.3);
}
/** Rest: two low notes. */
export function beepRest(): void {
  tone(520, 0.12);
  tone(520, 0.12, 0.25, 0.16);
}
/** The end: a small rising fanfare. */
export function beepDone(): void {
  tone(659, 0.14);
  tone(784, 0.14, 0.25, 0.16);
  tone(1047, 0.36, 0.3, 0.32);
}

export function say(text: string): void {
  if (muted() || !voiceOn()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no speech here */
  }
}

// ---- preferences (per device) ----

const MUTE_KEY = "workout.audio.muted";
const VOICE_KEY = "workout.audio.voice";
const listeners = new Set<() => void>();

function read(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function write(key: string, v: boolean): void {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export function muted(): boolean {
  return read(MUTE_KEY, false);
}
export function voiceOn(): boolean {
  return read(VOICE_KEY, true);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAudioPrefs(): { muted: boolean; voice: boolean; toggleMuted: () => void; toggleVoice: () => void } {
  const m = useSyncExternalStore(subscribe, muted);
  const v = useSyncExternalStore(subscribe, voiceOn);
  return { muted: m, voice: v, toggleMuted: () => write(MUTE_KEY, !m), toggleVoice: () => write(VOICE_KEY, !v) };
}

/** Keep the screen on while the timer runs; released on unmount or when the tab hides. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: { release(): Promise<void> } | null = null;
    let alive = true;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) {
          lock = await (navigator as Navigator & { wakeLock: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock.request("screen");
        }
      } catch {
        /* denied */
      }
    };
    const onVisible = () => {
      if (alive && document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}
