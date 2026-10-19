import type React from "react";
import { useSyncExternalStore } from "react";
import { registeredApps } from "../registry";

/**
 * What one App hands to another's Intake (ADR 0050, CONTEXT.md "Handoff"):
 * a title, a text in markdown, where it came from, who wrote it, when — and
 * nothing the sender would have to know about the receiver.
 */
export interface Handoff {
  title: string;
  /** Markdown. May be empty (a bare title). */
  text: string;
  /** Origin URL, when there is one. */
  url?: string;
  author?: string;
  /** ISO instant or YYYY-MM-DD: when the material was written / sent. */
  date?: string;
  /**
   * The Document it was taken from, when there is one (ADR 0073) — a Note, a
   * Quote, a Thought a passage was selected in. A receiver may keep it as a
   * link; what it says is read through the link, never copied.
   */
  originId?: string;
}

export interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handoff: Handoff;
}

/**
 * One way an App accepts a Handoff (ADR 0050): what it makes ("Clipping",
 * "Task", "Event") and the dialog it opens prefilled. Nothing is written
 * until that dialog saves — ownership stays whole.
 */
export interface IntakeDef {
  /** Unique within the App ("clipping", "task"). */
  id: string;
  /** What it makes — a singular noun. */
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  dialog: React.ComponentType<IntakeDialogProps>;
}

/** Read side: every App's Intakes, in registry order, each stamped with its App. */
export function allIntakes(): (IntakeDef & { appId: string; key: string })[] {
  return registeredApps().flatMap((a) => (a.intakes ?? []).map((i) => ({ ...i, appId: a.id, key: `${a.id}/${i.id}` })));
}

/** One Intake by its `${appId}/${id}` key. */
export function intakeByKey(key: string): (IntakeDef & { appId: string; key: string }) | undefined {
  return allIntakes().find((i) => i.key === key);
}

// --- the Intake a sender last chose (per-device, never synced) ---

const LAST_PREFIX = "lifeline.intake.last.";
const listeners = new Set<() => void>();

/**
 * The key of the Intake last chosen from this sending App on this device, or
 * "" when none. Remembered per sender — a selection's "Quote" never becomes
 * Pantry's default — and a convenience only: the sender still names no
 * receiver, the user did.
 */
export function lastIntakeKey(sender: string): string {
  try {
    return localStorage.getItem(LAST_PREFIX + sender) ?? "";
  } catch {
    return "";
  }
}

export function rememberIntake(sender: string, key: string): void {
  try {
    localStorage.setItem(LAST_PREFIX + sender, key);
  } catch {
    /* private mode: nothing is remembered */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The sender's last Intake key, live across every row that offers one. */
export function useLastIntakeKey(sender: string): string {
  return useSyncExternalStore(subscribe, () => lastIntakeKey(sender), () => "");
}
