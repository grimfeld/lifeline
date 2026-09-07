import type React from "react";
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
