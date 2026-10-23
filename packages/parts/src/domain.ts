import type { DateStr, Document } from "@lifeline/core";

/**
 * Parts and Groups (CONTEXT.md, ADR 0074): the numbered pieces a work is made
 * of — issues, chapters, episodes, tracks — optionally collected into one
 * level of Groups (volumes, seasons, discs, sections). Everything here is
 * pure: the run is *derived* from the work's size, its catch-up position and
 * whichever Parts and Groups exist, never stored.
 */

/** Whether Part numbers restart in each Group (series, albums) or run on across them (manga, comics, books). The medium's, never the work's. */
export type Numbering = "restart" | "runOn";

/** How a medium speaks of its Parts and Groups. */
export interface PartsMedium {
  numbering: Numbering;
  /** "Chapter", "Issue", "Episode", "Track". */
  part: string;
  /** "chapters", "issues", "episodes", "tracks". */
  parts: string;
  /** "Volume", "Season", "Disc", "Section". */
  group: string;
  /** "volumes", "seasons", "discs", "sections". */
  groups: string;
  /** Past tense of the act, for the Daylog and toasts: "Read", "Watched", "Heard". */
  verb: string;
  /** The work field holding the run's length: its `size` when that counts Parts, else a field of its own (a book's size is pages). */
  sizeKey?: "size" | "partCount";
  /** A short name for a restarting position ("S2E4"); default "Disc 2 · Track 4". */
  abbrev?: (group: number, number: number) => string;
}

/** Where a Part stands in the run. `group` is 0 when numbering runs on, or when a restarting work has no Groups. */
export interface Pos {
  group: number;
  number: number;
}

export const NO_POS: Pos = { group: 0, number: 0 };

/** The fields a work carries for its Parts (ADR 0074). */
export interface PartsHolder extends Document {
  size: number;
  /** The run's length when `size` counts something else (a book's pages). 0 = ongoing. */
  partCount?: number;
  /** The user tracks this work's Parts. A work without them behaves as before. */
  partsTracked?: boolean;
  /** "Caught up to" — every Part up to here is read, with no day. 0/0 = none. */
  caughtUpGroup?: number;
  caughtUpPart?: number;
}

/** What I make of something (CONTEXT.md, Marks): the heart and whole stars, 0 = unrated. */
export interface Marked {
  liked: boolean;
  rating: number;
}

export const RATING_MAX = 5;

/** A Part Document: exists only once it has something to say. */
export interface Part extends Document, Marked {
  /** The work it belongs to. */
  work: string;
  /** Restarting media only; 0 when numbering runs on. */
  group: number;
  number: number;
  /** An optional title typed by hand. */
  name: string;
  /** The day it was read (watched, heard); "" = not read on a day of its own. */
  readOn: DateStr;
  /** The Review. */
  body?: string;
}

/** A Group Document: exists once declared, marked or reviewed. */
export interface Group extends Document, Marked {
  work: string;
  number: number;
  name: string;
  /** Restarting media: how many Parts it has; 0 = not known yet. */
  size: number;
  /** Running-on media: the first Part in it; the Group ends where the next begins. */
  firstPart: number;
  body?: string;
}

/** The run's length as far as it is known; 0 = ongoing. */
export const runSize = (m: PartsMedium, w: PartsHolder): number => (m.sizeKey === "partCount" ? w.partCount : w.size) || 0;

export const comparePos = (a: Pos, b: Pos) => a.group - b.group || a.number - b.number;
export const samePos = (a: Pos, b: Pos) => a.group === b.group && a.number === b.number;
export const posOf = (p: Pick<Part, "group" | "number">): Pos => ({ group: p.group || 0, number: p.number || 0 });
export const caughtUpOf = (w: PartsHolder): Pos => ({ group: w.caughtUpGroup || 0, number: w.caughtUpPart || 0 });

/** "Chapter 1046", "S2E4", "Disc 2 · Track 4". */
export function partName(m: PartsMedium, pos: Pos): string {
  if (pos.group > 0) return m.abbrev ? m.abbrev(pos.group, pos.number) : `${m.group} ${pos.group} · ${m.part} ${pos.number}`;
  return `${m.part} ${pos.number}`;
}

export const groupName = (m: PartsMedium, n: number) => `${m.group} ${n}`;

/** One stretch of the run as the detail lists it: a Group's Parts, or the whole run when there are none. */
export interface RunSection {
  /** The Group number; 0 = no Group (the whole run, or the Parts before a running-on work's first Group). */
  group: number;
  groupDoc?: Group;
  /** First and last Part number shown, inclusive; last < first = nothing known yet. */
  first: number;
  last: number;
  /** The end is not known: more Parts may follow. */
  open: boolean;
}

export interface RunInput {
  medium: PartsMedium;
  work: PartsHolder;
  parts: Part[];
  groups: Group[];
}

/** Restarting media count by Group only once there is a Group to count by. */
export const usesGroups = (m: PartsMedium, groups: Group[], parts: Part[], caughtUp: Pos) =>
  m.numbering === "restart" && (groups.length > 0 || parts.some((p) => p.group > 0) || caughtUp.group > 0);

/** The run, Group by Group, as far as it is known (CONTEXT.md, Part: "the work's size is the run as far as it is known"). */
export function runOf({ medium, work, parts, groups }: RunInput): RunSection[] {
  const caught = caughtUpOf(work);
  if (usesGroups(medium, groups, parts, caught)) {
    const numbers = new Set<number>([...groups.map((g) => g.number), ...parts.map((p) => p.group), caught.group].filter((n) => n > 0));
    const maxG = Math.max(...numbers);
    const out: RunSection[] = [];
    for (let g = 1; g <= maxG; g++) {
      const doc = groups.find((d) => d.number === g);
      const maxPart = Math.max(0, ...parts.filter((p) => p.group === g).map((p) => p.number));
      const caughtHere = caught.group === g ? caught.number : 0;
      const size = doc?.size || 0;
      out.push({ group: g, groupDoc: doc, first: 1, last: Math.max(size, maxPart, caughtHere), open: !size });
    }
    return out;
  }
  const maxPart = Math.max(0, ...parts.map((p) => p.number));
  const runOnGroups = medium.numbering === "runOn" ? groups.filter((g) => g.firstPart > 0).sort((a, b) => a.firstPart - b.firstPart) : [];
  const lastKnown = Math.max(runSize(medium, work), maxPart, caught.number, ...runOnGroups.map((g) => g.firstPart));
  const open = !runSize(medium, work);
  if (runOnGroups.length === 0) return [{ group: 0, first: 1, last: lastKnown, open }];
  const out: RunSection[] = [];
  if (runOnGroups[0]!.firstPart > 1) out.push({ group: 0, first: 1, last: runOnGroups[0]!.firstPart - 1, open: false });
  runOnGroups.forEach((g, i) => {
    const next = runOnGroups[i + 1];
    out.push({ group: g.number, groupDoc: g, first: g.firstPart, last: next ? next.firstPart - 1 : lastKnown, open: next ? false : open });
  });
  return out;
}

/** The Position of Part `n` in a section. */
export const sectionPos = (m: PartsMedium, s: RunSection, n: number): Pos => ({ group: m.numbering === "restart" ? s.group : 0, number: n });

/** Parts by position key, for lookups. */
export const posKey = (p: Pos) => `${p.group}:${p.number}`;
export function partIndex(parts: Part[]): Map<string, Part> {
  return new Map(parts.map((p) => [posKey(posOf(p)), p]));
}

/** Read up to the catch-up position (with no day), or on a day of its own. */
export function isRead(pos: Pos, caughtUp: Pos, part: Part | undefined): boolean {
  return (caughtUp.number > 0 && comparePos(pos, caughtUp) <= 0) || !!part?.readOn;
}

/** Read only by the catch-up: no day of its own to clear. */
export const isCaughtUp = (pos: Pos, caughtUp: Pos, part: Part | undefined) => caughtUp.number > 0 && comparePos(pos, caughtUp) <= 0 && !part?.readOn;

export interface Progress {
  read: number;
  /** 0 = ongoing, the end not known. */
  total: number;
}

/** "14 of 54" — derived, never stored. */
export function progressOf(input: RunInput): Progress {
  const caught = caughtUpOf(input.work);
  const idx = partIndex(input.parts);
  let read = 0;
  for (const s of runOf(input)) {
    for (let n = s.first; n <= s.last; n++) {
      const pos = sectionPos(input.medium, s, n);
      if (isRead(pos, caught, idx.get(posKey(pos)))) read++;
    }
  }
  return { read, total: runSize(input.medium, input.work) };
}

/**
 * Next part (CONTEXT.md): the lowest unread Part. Past the known end, the one
 * after it — unless the run is known to be over, when there is none.
 */
export function nextPart(input: RunInput): Pos | null {
  const { medium, work } = input;
  const caught = caughtUpOf(work);
  const idx = partIndex(input.parts);
  const sections = runOf(input);
  for (const s of sections) {
    for (let n = s.first; n <= s.last; n++) {
      const pos = sectionPos(medium, s, n);
      if (!isRead(pos, caught, idx.get(posKey(pos)))) return pos;
    }
  }
  const last = sections[sections.length - 1];
  if (!last) return { group: 0, number: 1 };
  if (medium.numbering === "restart" && last.group > 0) {
    if (last.open) return { group: last.group, number: last.last + 1 };
    return runSize(medium, work) ? null : { group: last.group + 1, number: 1 };
  }
  return runSize(medium, work) ? null : { group: 0, number: last.last + 1 };
}

/** Every Part of the known run is read and the end is known: the moment to *offer* Done (never to set it). */
export function runComplete(input: RunInput): boolean {
  const p = progressOf(input);
  return p.total > 0 && p.read >= p.total;
}

/**
 * Reading (or catching up) past the known end raises it; a blank size stays
 * blank — ongoing. Returns the work's new size, or null when unchanged.
 */
export function raisedSize(input: RunInput, pos: Pos): number | null {
  const { medium, work } = input;
  const size = runSize(medium, work);
  if (!size) return null;
  if (medium.numbering === "runOn" || pos.group === 0) return pos.number > size ? pos.number : null;
  // Restarting: the run's length is the sum of its Groups', this position included.
  const sections = runOf(input);
  let total = 0;
  let seen = false;
  for (const s of sections) {
    if (s.group === pos.group) {
      seen = true;
      total += Math.max(s.last, pos.number);
    } else total += s.last;
  }
  if (!seen) total += pos.number;
  return total > size ? total : null;
}

/** A Group's size raised by reading past it, or null. */
export function raisedGroupSize(group: Group | undefined, pos: Pos): number | null {
  return group && group.size > 0 && pos.number > group.size ? pos.number : null;
}

/** A Part with nothing to say any more goes (ADR 0074). */
export const partIsEmpty = (p: Pick<Part, "readOn" | "liked" | "rating" | "body" | "name">) => !p.readOn && !p.liked && !p.rating && !(p.body ?? "").trim() && !p.name.trim();
export const groupIsEmpty = (g: Pick<Group, "size" | "firstPart" | "liked" | "rating" | "body" | "name">) =>
  !g.size && !g.firstPart && !g.liked && !g.rating && !(g.body ?? "").trim() && !g.name.trim();

/** The average of the Ratings given, shown beside a Rating and never stored (CONTEXT.md: Marks never roll up). 0 = none rated. */
export function averageRating(items: Marked[]): number {
  const rated = items.filter((i) => i.rating > 0);
  return rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : 0;
}

/** One Daylog line's subtitle for the Parts of one work read on one day: "Chapter 1046", "3 chapters", "S2E4–6". */
export function daySummary(m: PartsMedium, read: Pos[]): string {
  const sorted = [...read].sort(comparePos);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return `0 ${m.parts}`;
  if (sorted.length === 1) return partName(m, first);
  const consecutive = sorted.every((p, i) => i === 0 || (p.group === first.group && p.number === sorted[i - 1]!.number + 1));
  if (consecutive && first.group > 0) return `${partName(m, first)}–${last.number}`;
  if (consecutive) return `${m.parts.charAt(0).toUpperCase()}${m.parts.slice(1)} ${first.number}–${last.number}`;
  return `${sorted.length} ${m.parts}`;
}
