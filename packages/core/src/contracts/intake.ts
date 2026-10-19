import type React from "react";
import { createElement, useSyncExternalStore } from "react";
import type { Handoff } from "@lifeline/handoff";
import type { AppManifest } from "../manifest";
import { registeredApps } from "../registry";
import { allDocumentTypes } from "../documents/registry";
import { createDocument, templateFor } from "../documents/ops";
import { singularOf, type Document, type DocumentTypeDef } from "../documents/types";

// The Handoff itself lives in the dependency-free codec package, which the
// Lifeline extension shares (ADR 0080); Core re-exports it as its own.
export type { Handoff };

export interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handoff: Handoff;
  /**
   * Called once the dialog has saved, with the Document it made, just before it
   * closes — the Handoff page (ADR 0080) tells a save from a cancel by it.
   */
  onSaved?: (id: string) => void;
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
  return intakesOf(registeredApps());
}

/** The Intakes of these Apps, in their order, each stamped with its App — the build reads the registry through it too. */
export function intakesOf(apps: readonly AppManifest[]): (IntakeDef & { appId: string; key: string })[] {
  return apps.flatMap((a) => (a.intakes ?? []).map((i) => ({ ...i, appId: a.id, key: `${a.id}/${i.id}` })));
}

/** One Intake by its `${appId}/${id}` key. */
export function intakeByKey(key: string): (IntakeDef & { appId: string; key: string }) | undefined {
  return allIntakes().find((i) => i.key === key);
}

// --- Core's generic Intake for user-defined types (ADR 0086) ---

/**
 * An Intake the Handoff page offers: an App's, or Core's generic one for a
 * user-defined type — then stamped `appId` "core", with the type it makes and
 * the type's Home Module (none: listed under Other).
 */
export type HandoffIntake = IntakeDef & { appId: string; key: string; typeId?: string; module?: string };

/** The App id Core's own Intakes are stamped with. */
export const CORE_INTAKE_APP = "core";

/** Core's form for a user-defined type's generic Intake, as the shell draws it (`setTypeIntakeDialog`). */
export type TypeIntakeDialog = React.ComponentType<IntakeDialogProps & { type: string }>;

let typeDialog: TypeIntakeDialog = () => null;
const boundDialogs = new Map<string, React.ComponentType<IntakeDialogProps>>();

/** Install Core's generic Intake form — the shell does at startup, as it installs the type icons. */
export function setTypeIntakeDialog(dialog: TypeIntakeDialog): void {
  typeDialog = dialog;
  boundDialogs.clear();
}

/** One dialog component per type, kept, so a re-render never remounts an open form. */
function dialogFor(type: string): React.ComponentType<IntakeDialogProps> {
  let d = boundDialogs.get(type);
  if (!d) {
    d = (props: IntakeDialogProps) => createElement(typeDialog, { ...props, type });
    boundDialogs.set(type, d);
  }
  return d;
}

/**
 * Core's generic Intake for each user-defined type (ADR 0086): a Handoff
 * becomes a Document of the type through Core's form — a title, a Template,
 * the Workspace — with the origin URL kept. Not offered by the Selection
 * menu, where a user-defined type is made at once instead.
 */
export function typeIntakesOf(types: readonly DocumentTypeDef[]): HandoffIntake[] {
  return types
    .filter((t) => !t.builtIn && !t.internal)
    .map((t) => ({ id: t.id, key: `${CORE_INTAKE_APP}/${t.id}`, appId: CORE_INTAKE_APP, title: singularOf(t), icon: t.icon, dialog: dialogFor(t.id), typeId: t.id, module: t.homeModule }));
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

/**
 * Where a generic Intake keeps the Handoff's origin URL: in the type's url
 * Field when it has one, else in the body after what the Template wrote.
 */
export function originOf(def: Pick<DocumentTypeDef, "fields">, url: string | undefined, body: string): { fields: Record<string, unknown>; body: string } {
  if (!url) return { fields: {}, body };
  const field = def.fields.find((f) => f.kind === "url");
  if (field) return { fields: { [field.key]: url }, body };
  return { fields: {}, body: body.trim() ? `${body.trimEnd()}

${url}` : url };
}

/**
 * Save what Core's generic Intake form holds: a Document of the type, titled,
 * from the picked Template (or the type's default), its origin kept, in the
 * current Workspace. Throws as `createDocument` does (a title already taken).
 */
export async function createFromHandoff(input: { type: string; title: string; handoff: Handoff; templateId?: string }): Promise<Document> {
  const def = allDocumentTypes().find((t) => t.id === input.type);
  const title = input.title.trim();
  const start = await templateFor(input.type, title, undefined, input.templateId);
  const { fields, body } = originOf(def ?? { fields: [] }, input.handoff.url, start);
  return createDocument({ type: input.type, title, fields, body });
}
