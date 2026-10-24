import { appById, registeredApps } from "../registry";
import { db, TALLY_FIRES } from "../data/db";
import type { Document } from "../documents/types";
import { logTo, type LogPayload } from "./loggable";

/**
 * A Tally (ADR 0059, CONTEXT.md "Tally"): a standing instruction on a
 * Document to log each of its occurrences into one Loggable target. Kept on
 * the Document itself, in the Core-reserved `tallies` field, so it follows
 * the Document wherever it goes — its Workspace, its deletion.
 */
export interface Tally {
  /** A Loggable target key: `${appId}/${id}`. */
  target: string;
  /** Which of the type's offered values to send — "one" always exists. */
  value: string;
  /** Which of the type's occurrences it counts (its id); absent = the type's first. */
  occurrence?: string;
}

/** One occurrence a type offers: an id a Tally records, and the editor's words for it. */
export interface TallyOccurrenceDef {
  id: string;
  /** "day practised", "puzzle solved". */
  label: string;
}

/** One value a Tallying type offers: "one" (a tick), or a number it measures ("duration", in minutes). */
export interface TallyValueDef {
  id: string;
  /** How the editor offers it: "+ duration (min)". */
  label: string;
}

/**
 * The Tallying Contract for one Document type (ADR 0059): what an occurrence
 * of its Documents is, and which values the owning App reports with each.
 * "one" needs no declaring — every occurrence is worth one.
 */
export interface TallyingDef {
  typeId: string;
  /** The first (default) occurrence in the editor's words: "session", "day practised". */
  occurrence: string;
  /** Every occurrence the type offers, the first being the default; absent = just `occurrence`. */
  occurrences?: TallyOccurrenceDef[];
  /** Values beyond "one". */
  values?: TallyValueDef[];
}

/** One occurrence an App reports: its key (unique per Document), the moment, and the values it measured. */
export interface Occurrence {
  key: string;
  /** ISO instant — when it happened, which is the moment logged. */
  at: string;
  /** Measured values by id; "one" is always 1 and need not be given. */
  values?: Record<string, number>;
  note?: string;
  /** Which occurrence this is (an id); absent = the type's first. */
  occurrence?: string;
}

/** The occurrences a type offers, first = default. A bare `occurrence` is its own id and label. */
export function occurrencesOf(def: TallyingDef): TallyOccurrenceDef[] {
  return def.occurrences?.length ? def.occurrences : [{ id: def.occurrence, label: def.occurrence }];
}

/** The field every Tallying Document keeps its Tallies in. */
export const TALLIES_FIELD = "tallies";

/** A Document's Tallies, read defensively — PocketBase returns an absent JSON field as null or "". */
export function talliesOf(doc: Record<string, unknown> | undefined): Tally[] {
  const raw = doc?.[TALLIES_FIELD];
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is Tally => !!t && typeof t.target === "string" && t.target !== "").map((t) => ({ target: t.target, value: typeof t.value === "string" && t.value ? t.value : "one", ...(typeof t.occurrence === "string" && t.occurrence ? { occurrence: t.occurrence } : {}) }));
}

/** The mark that says one Tally already fired for one occurrence. */
export function fireMarkId(docId: string, target: string, occurrenceKey: string): string {
  return `${docId}|${target}|${occurrenceKey}`;
}

export interface PlannedFire {
  markId: string;
  target: string;
  payload: LogPayload;
}

/**
 * What one occurrence should log (ADR 0059): one write per Tally not yet
 * marked fired for this occurrence. A Tally asking for a value the occurrence
 * did not measure sends one — a tally never goes silent over a missing number.
 */
export function planFires(docId: string, tallies: Tally[], occ: Occurrence, fired: ReadonlySet<string>, first?: string): PlannedFire[] {
  const out: PlannedFire[] = [];
  const reported = occ.occurrence ?? first;
  for (const t of tallies) {
    if ((t.occurrence ?? first) !== reported) continue;
    const markId = fireMarkId(docId, t.target, occ.key);
    if (fired.has(markId)) continue;
    const measured = t.value === "one" ? 1 : occ.values?.[t.value];
    out.push({ markId, target: t.target, payload: { at: occ.at, value: typeof measured === "number" && Number.isFinite(measured) ? measured : 1, note: occ.note } });
  }
  return out;
}

interface FireMark {
  id: string;
  firedAt: string;
}

/**
 * Report one occurrence of a Tallying Document (ADR 0059): Core logs it to
 * each of the Document's Tallies through Loggable, once. Marks are written
 * per Tally only after its log succeeded, so a failing target is retried by
 * the next report of the same occurrence and never double-logs the others.
 * Marks are kept on this device only; across devices the owning App's own
 * reading of "has this occurred yet" is what stops a second report.
 */
export async function fireTallies(doc: Document, occ: Occurrence): Promise<void> {
  const tallies = talliesOf(doc);
  if (!tallies.length) return;
  const def = tallyingOf(doc.type);
  const first = def ? occurrencesOf(def)[0]!.id : undefined;
  const table = db().table<FireMark, string>(TALLY_FIRES);
  const ids = tallies.map((t) => fireMarkId(doc.id, t.target, occ.key));
  const existing = await table.bulkGet(ids);
  const fired = new Set(existing.filter((m): m is FireMark => !!m).map((m) => m.id));
  const errors: string[] = [];
  for (const f of planFires(doc.id, tallies, occ, fired, first)) {
    try {
      await logTo(f.target, f.payload);
      await table.put({ id: f.markId, firedAt: new Date().toISOString() });
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  if (errors.length) throw new Error(`Some tallies failed: ${errors.join("; ")}`);
}

/** Read side: every App's Tallying types, each stamped with its App. */
export function allTallying(): (TallyingDef & { appId: string })[] {
  return registeredApps().flatMap((a) => (a.tallying ?? []).map((t) => ({ ...t, appId: a.id })));
}

/** The Tallying declaration for one Document type, if its App made one. */
export function tallyingOf(typeId: string): (TallyingDef & { appId: string; appTitle: string }) | undefined {
  const t = allTallying().find((x) => x.typeId === typeId);
  return t ? { ...t, appTitle: appById(t.appId)?.title ?? t.appId } : undefined;
}
