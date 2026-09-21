import { useSyncExternalStore } from "react";
import { toast } from "@lifeline/ui";
import { confettiBurst } from "./confetti";
import { fanfareDataUrl, lowThunkDataUrl, sineToneDataUrl } from "./wav";

/** The harsh-game juice (ported from life-level): sounds, confetti, shakes. */

export type SoundId = "positiveDing" | "levelUpFanfare" | "negativeThunk" | "decayAlert";

let sounds: Record<SoundId, HTMLAudioElement> | null = null;
function ensureSounds(): Record<SoundId, HTMLAudioElement> {
  if (!sounds) {
    sounds = {
      positiveDing: new Audio(sineToneDataUrl(880, 0.07)),
      levelUpFanfare: new Audio(fanfareDataUrl()),
      negativeThunk: new Audio(lowThunkDataUrl()),
      decayAlert: new Audio(sineToneDataUrl(220, 0.14, 44100, 0.28)),
    };
  }
  return sounds;
}

const MUTE_KEY = "lifelevel.audio.muted";
let mutedState = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
const muteListeners = new Set<() => void>();

export function isMuted(): boolean {
  return mutedState;
}

export function setMuted(m: boolean): void {
  mutedState = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
  for (const l of muteListeners) l();
}

/** Audio preference for the toggle button on the Life Level screen. */
export function useAudioPref(): { muted: boolean; toggle: () => void } {
  const muted = useSyncExternalStore(
    (cb) => {
      muteListeners.add(cb);
      return () => muteListeners.delete(cb);
    },
    () => mutedState,
  );
  return { muted, toggle: () => setMuted(!mutedState) };
}

export function playSound(id: SoundId): void {
  if (mutedState) return;
  try {
    const a = ensureSounds()[id];
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    /* restricted environments */
  }
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Cross-component shake: fired when a Habit takes damage; HabitCards listen. */
export const HIT_EVENT = "lifelevel:habit-hit";
export function emitHabitHit(habitId: string): void {
  window.dispatchEvent(new CustomEvent(HIT_EVENT, { detail: { habitId } }));
}

let stylesInjected = false;
export function ensureFeedbackStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
@keyframes ll-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
.ll-shake { animation: ll-shake 0.45s ease; }
@keyframes ll-pop { 0% { transform: scale(1.12); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
.ll-pop { display: inline-block; animation: ll-pop 0.25s ease-out; }
@keyframes ll-burst-in { 0% { transform: scale(0.6) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes ll-burst-out { to { transform: scale(0.9); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ll-shake, .ll-pop { animation: none; } }
`;
  document.head.appendChild(style);
}

/** The full-screen "Level up" moment: fanfare + confetti + a celebratory card. */
function showLevelUpOverlay(habitName: string, fromLevel: number, toLevel: number): void {
  ensureFeedbackStyles();
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:none;";
  const card = document.createElement("div");
  card.style.cssText = [
    "border:2px solid rgba(252,211,77,0.9)",
    "background:linear-gradient(135deg,#fffbeb,#ecfdf5)",
    "border-radius:16px",
    "padding:24px 32px",
    "text-align:center",
    "box-shadow:0 25px 50px -12px rgba(245,158,11,0.35)",
    reducedMotion() ? "" : "animation:ll-burst-in 0.3s cubic-bezier(0.34,1.56,0.64,1)",
  ].join(";");
  card.innerHTML =
    `<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#b45309">Level up</p>` +
    `<p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#171717"></p>` +
    `<p style="margin:8px 0 0;font-size:24px;font-weight:900;font-variant-numeric:tabular-nums;color:#047857">Lv ${fromLevel} → Lv ${toLevel}</p>`;
  (card.children[1] as HTMLElement).textContent = habitName;
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  window.setTimeout(() => {
    card.style.animation = "ll-burst-out 0.25s ease forwards";
    window.setTimeout(() => wrap.remove(), 260);
  }, reducedMotion() ? 900 : 1400);
}

/**
 * The Undo action every logging toast carries: one tap takes the row back out
 * of the ledger, which is all it takes to undo the XP (ADR 0026 — nothing
 * numeric is stored, so the numbers simply re-derive without it).
 */
function undoAction(undo: (() => void | Promise<void>) | undefined, done: string) {
  if (!undo) return undefined;
  return {
    label: "Undo",
    onClick: () => {
      void (async () => {
        try {
          await undo();
          toast.success(done, { duration: 2200 });
        } catch {
          toast.error("Could not undo that log");
        }
      })();
    },
  };
}

/**
 * A completion landed: ding (or fanfare + burst on level-up) and a toast. The
 * toast is also where a mis-tap is taken back, so it carries Undo — including
 * on a level-up, where the level the tap just bought goes back with it.
 */
export function celebrateCompletion(p: {
  habitTitle: string;
  xpAmount: number;
  previousLevel: number;
  nextLevel: number;
  levelDelta: number;
  /** Strike this Completion from the ledger again (a mis-tap). Omit for no Undo. */
  onUndo?: () => void | Promise<void>;
}): void {
  const action = undoAction(p.onUndo, "Completion removed — the XP is back where it was");
  if (p.levelDelta > 0) {
    playSound("levelUpFanfare");
    vibrate([40, 60, 40]);
    confettiBurst();
    showLevelUpOverlay(p.habitTitle, p.previousLevel, p.nextLevel);
    // The overlay is the celebration; the toast is what makes the tap reversible.
    toast.success(`Lv ${p.previousLevel} → Lv ${p.nextLevel} · ${p.habitTitle}`, { duration: 5000, action });
  } else {
    playSound("positiveDing");
    vibrate(15);
    toast.success(`+${Math.round(p.xpAmount)} XP · ${p.habitTitle}`, { duration: action ? 5000 : 2200, action });
  }
}

/** A Negative landed: thunk, toast (with Undo, for the mis-tap), and a shake on the victim's card. */
export function mournNegative(p: {
  negativeTitle: string;
  victimTitle: string;
  victimId: string;
  damage: number;
  /** Strike this Completion from the ledger again (a mis-tap). Omit for no Undo. */
  onUndo?: () => void | Promise<void>;
}): void {
  playSound("negativeThunk");
  vibrate([25, 40, 25]);
  emitHabitHit(p.victimId);
  toast.error(`${p.negativeTitle}: −${Math.round(p.damage)} XP from ${p.victimTitle}`, {
    duration: p.onUndo ? 6000 : 3200,
    action: undoAction(p.onUndo, `Log removed — ${p.victimTitle} has its XP back`),
  });
}

const decayWarned = new Set<string>();
/** Once per session per Habit: decay is about to bite. */
export function decayWarningOnce(habitId: string, habitTitle: string): void {
  if (decayWarned.has(habitId)) return;
  decayWarned.add(habitId);
  playSound("decayAlert");
  toast.warning(`Decay soon · ${habitTitle}`, {
    description: "Log soon to avoid losing more XP to decay (decay only erodes positive progress, down to 0).",
    duration: 5000,
  });
}
