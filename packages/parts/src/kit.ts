import { useMemo } from "react";
import {
  documentsOf,
  documentsWhere,
  getDocument,
  putDocument,
  removeDocument,
  sharedLiveQuery,
  todayStr,
  useLiveQuery,
  type DateStr,
  type DaylogItem,
  type Document,
  type DocumentTypeDef,
} from "@lifeline/core";
import { ListOrdered, Layers } from "lucide-react";
import {
  caughtUpOf,
  daySummary,
  groupIsEmpty,
  groupName,
  isCaughtUp,
  nextPart,
  partIsEmpty,
  partName,
  posOf,
  raisedGroupSize,
  raisedSize,
  runComplete,
  runSize,
  samePos,
  usesGroups,
  type Group,
  type Part,
  type PartsHolder,
  type PartsMedium,
  type Pos,
  type RunInput,
} from "./domain";

/** A work as the Parts see it: the Parts fields plus where it stands on the Shelf. */
export interface PartsWork extends PartsHolder {
  engagement: string;
}

/**
 * What a family App tells the kit (ADR 0074). The App owns its Parts and
 * Groups — its own two types — and keeps its own Shelf: the kit calls back
 * for Start and Done rather than writing them itself.
 */
export interface PartsKitConfig<W extends PartsWork> {
  appId: string;
  /** "Library", "Cinema", "Discotheque" — prefixes the types' labels in Bases. */
  appTitle: string;
  partType: string;
  groupType: string;
  /** The medium's words, or null for a type that never has Parts (a film). */
  mediumOf(work: W): PartsMedium | null;
  /** Re-establish the domain's defaults on a raw row (PocketBase hands absent fields back as ""/0). */
  normalize(work: W): W;
  patchWork(work: W, patch: Partial<W>): Promise<void>;
  /** The App's Start: the first Part read on an unstarted work starts it, exactly like Start. */
  start(work: W): Promise<void>;
  /** The App's Done, offered when the last known Part is read — never run by itself. */
  finish(work: W): Promise<void>;
  /** Where the work opens, for the Daylog. */
  href(work: W): string;
  order: number;
}

function normalizePart(p: Part): Part {
  return { ...p, work: p.work ?? "", group: p.group || 0, number: p.number || 0, name: p.name ?? "", readOn: p.readOn ?? "", liked: !!p.liked, rating: p.rating || 0, tags: p.tags ?? [] };
}
function normalizeGroup(g: Group): Group {
  return { ...g, work: g.work ?? "", number: g.number || 0, name: g.name ?? "", size: g.size || 0, firstPart: g.firstPart || 0, liked: !!g.liked, rating: g.rating || 0, tags: g.tags ?? [] };
}

export type PartPatch = Partial<Pick<Part, "readOn" | "liked" | "rating" | "body" | "name">>;
export type GroupPatch = Partial<Pick<Group, "size" | "firstPart" | "liked" | "rating" | "body" | "name">>;

/** What a read did, so the caller can say so (and offer Done). */
export interface ReadOutcome {
  pos: Pos;
  started: boolean;
  /** The last known Part is read: offer Done. */
  complete: boolean;
}

export type PartsKit<W extends PartsWork = PartsWork> = ReturnType<typeof createPartsKit<W>>;

export function createPartsKit<W extends PartsWork>(cfg: PartsKitConfig<W>) {
  const { partType, groupType } = cfg;

  const partTypeDef: DocumentTypeDef = {
    id: partType,
    label: `${cfg.appTitle} parts`,
    singular: `${cfg.appTitle} part`,
    icon: ListOrdered,
    iconName: "list",
    internal: true,
    titleRule: "name",
    body: "optional",
    indexes: ["work", "readOn"],
    order: cfg.order,
    builtIn: true,
    fields: [
      { key: "work", label: "Work", kind: "text", hidden: true },
      { key: "group", label: "Group", kind: "number", column: true },
      { key: "number", label: "Number", kind: "number", column: true },
      { key: "name", label: "Title", kind: "text" },
      { key: "readOn", label: "Read on", kind: "date", column: true },
      { key: "liked", label: "Liked", kind: "boolean", column: true },
      { key: "rating", label: "Rating", kind: "number", column: true },
    ],
  };

  const groupTypeDef: DocumentTypeDef = {
    id: groupType,
    label: `${cfg.appTitle} groups`,
    singular: `${cfg.appTitle} group`,
    icon: Layers,
    iconName: "layers",
    internal: true,
    titleRule: "name",
    body: "optional",
    indexes: ["work"],
    order: cfg.order + 1,
    builtIn: true,
    fields: [
      { key: "work", label: "Work", kind: "text", hidden: true },
      { key: "number", label: "Number", kind: "number", column: true },
      { key: "name", label: "Title", kind: "text" },
      { key: "size", label: "Size", kind: "number", column: true },
      { key: "firstPart", label: "First part", kind: "number", column: true },
      { key: "liked", label: "Liked", kind: "boolean", column: true },
      { key: "rating", label: "Rating", kind: "number", column: true },
    ],
  };

  const partsOf = async (workId: string) => (await documentsWhere<Part>(partType, "work", workId)).map(normalizePart);
  const groupsOf = async (workId: string) => (await documentsWhere<Group>(groupType, "work", workId)).map(normalizeGroup);

  const allPartsLive = sharedLiveQuery(async () => (await documentsOf<Part>(partType)).map(normalizePart), [] as Part[]);
  const allGroupsLive = sharedLiveQuery(async () => (await documentsOf<Group>(groupType)).map(normalizeGroup), [] as Group[]);

  /** The work as stored now: the App's patch writes whole rows, so a stale copy would undo the last write. */
  async function fresh(work: W): Promise<W> {
    const row = await getDocument<W>(work.id);
    return row ? cfg.normalize(row) : work;
  }
  async function patchFresh(work: W, patch: Partial<W>): Promise<W> {
    const cur = await fresh(work);
    await cfg.patchWork(cur, patch);
    return { ...cur, ...patch };
  }

  /** The run's inputs, read fresh: the work as stored now and its Parts and Groups. */
  async function inputFor(stale: W): Promise<RunInput & { medium: PartsMedium; work: W }> {
    const work = await fresh(stale);
    const medium = cfg.mediumOf(work);
    if (!medium) throw new Error(`A ${work.type} has no parts`);
    const [parts, groups] = await Promise.all([partsOf(work.id), groupsOf(work.id)]);
    return { medium, work, parts, groups };
  }

  /** The Part at a position: upserted with the patch, or deleted once it has nothing to say. */
  async function writePart(work: W, medium: PartsMedium, parts: Part[], pos: Pos, patch: PartPatch): Promise<void> {
    const cur = parts.find((p) => samePos(posOf(p), pos));
    const next: Part = {
      ...(cur ?? { id: undefined as unknown as string, type: partType, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, work: work.id, group: pos.group, number: pos.number, name: "", readOn: "", liked: false, rating: 0, workspace: work.workspace }),
      ...patch,
      title: `${work.title} · ${partName(medium, pos)}`,
    };
    if (partIsEmpty(next)) {
      if (cur) await removeDocument(cur.id);
      return;
    }
    await putDocument<Part>(cur ? next : { ...next, id: undefined });
  }

  async function writeGroup(work: W, medium: PartsMedium, groups: Group[], number: number, patch: GroupPatch): Promise<void> {
    const cur = groups.find((g) => g.number === number);
    const next: Group = {
      ...(cur ?? { id: undefined as unknown as string, type: groupType, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, work: work.id, number, name: "", size: 0, firstPart: 0, liked: false, rating: 0, workspace: work.workspace }),
      ...patch,
      title: `${work.title} · ${groupName(medium, number)}`,
    };
    if (groupIsEmpty(next)) {
      if (cur) await removeDocument(cur.id);
      return;
    }
    await putDocument<Group>(cur ? next : { ...next, id: undefined });
  }

  /**
   * A restarting work's first Group: until now its Parts had no Group, so
   * they (and the catch-up) become the first one's.
   */
  async function adoptIntoFirstGroup(work: W, input: RunInput): Promise<W> {
    const caught = caughtUpOf(work);
    if (usesGroups(input.medium, input.groups, input.parts, caught)) return work;
    for (const p of input.parts) if (p.group === 0) await putDocument<Part>({ ...p, group: 1, title: `${work.title} · ${partName(input.medium, { group: 1, number: p.number })}` });
    if (caught.number > 0) {
      return patchFresh(work, { caughtUpGroup: 1 } as Partial<W>);
    }
    return work;
  }

  /** After a read: raise a known end, mark the work as tracking Parts, start it. */
  async function afterRead(work: W, input: RunInput, pos: Pos, extra: Partial<W> = {}): Promise<{ work: W; started: boolean }> {
    const patch: Partial<W> = { ...extra };
    const size = raisedSize(input, pos);
    if (size !== null) (patch as Record<string, unknown>)[input.medium.sizeKey ?? "size"] = size;
    if (!work.partsTracked) (patch as PartsHolder).partsTracked = true;
    const next = Object.keys(patch).length ? await patchFresh(work, patch) : await fresh(work);
    const group = input.groups.find((g) => g.number === pos.group);
    const groupSize = raisedGroupSize(group, pos);
    if (groupSize !== null) await writeGroup(work, input.medium, input.groups, pos.group, { size: groupSize });
    const started = next.engagement === "UNSTARTED";
    if (started) await cfg.start(await fresh(next));
    return { work: next, started };
  }

  /** Mark one Part read on a day (today by default). */
  async function markRead(stale: W, pos: Pos, day: DateStr = todayStr()): Promise<ReadOutcome> {
    const input = await inputFor(stale);
    const work = input.work;
    await writePart(work, input.medium, input.parts, pos, { readOn: day });
    const res = await afterRead(work, input, pos);
    const after = await inputFor(res.work);
    return { pos, started: res.started, complete: runComplete(after) };
  }

  /** Untick a Part read on its own day. One read by the catch-up has no day to clear: move the catch-up instead. */
  async function markUnread(stale: W, pos: Pos): Promise<void> {
    const input = await inputFor(stale);
    const work = input.work;
    const cur = input.parts.find((p) => samePos(posOf(p), pos));
    if (isCaughtUp(pos, caughtUpOf(work), cur)) throw new Error(`Caught up past ${partName(input.medium, pos)} — catch up to an earlier one to change it`);
    await writePart(work, input.medium, input.parts, pos, { readOn: "" });
  }

  /** Next part (CONTEXT.md): the lowest unread one, read today. */
  async function readNext(work: W): Promise<ReadOutcome> {
    const input = await inputFor(work);
    const pos = nextPart(input);
    if (!pos) throw new Error(`Every part of “${work.title}” is read`);
    return markRead(work, pos);
  }

  /**
   * Caught up to (CONTEXT.md): every Part up to `pos` read with no day — one
   * position on the work, nothing in the Daylog. Catching up again moves it,
   * lower as well as higher; Parts read on a day of their own stay read.
   */
  async function catchUp(stale: W, pos: Pos): Promise<{ started: boolean; complete: boolean }> {
    let input = await inputFor(stale);
    const work = input.work;
    let w = work;
    if (pos.group > 0) {
      w = await adoptIntoFirstGroup(work, input);
      input = { ...input, work: w };
    }
    const res = await afterRead(w, input, pos, { caughtUpGroup: pos.group, caughtUpPart: pos.number } as Partial<W>);
    return { started: res.started, complete: runComplete(await inputFor(res.work)) };
  }

  async function clearCatchUp(work: W): Promise<void> {
    await patchFresh(work, { caughtUpGroup: 0, caughtUpPart: 0 } as Partial<W>);
  }

  async function patchPart(stale: W, pos: Pos, patch: PartPatch): Promise<void> {
    const input = await inputFor(stale);
    const work = input.work;
    await writePart(work, input.medium, input.parts, pos, patch);
    if (!work.partsTracked) await patchFresh(work, { partsTracked: true } as Partial<W>);
  }

  /** Declare, mark, review or rename a Group. A restarting work's first Group takes the Parts that had none. */
  async function patchGroup(stale: W, number: number, patch: GroupPatch): Promise<void> {
    const input = await inputFor(stale);
    const work = input.work;
    let w = work;
    if (input.medium.numbering === "restart") w = await adoptIntoFirstGroup(work, input);
    await writeGroup(w, input.medium, input.groups, number, patch);
    const sizePatch: Partial<PartsHolder> = {};
    // A declared Season longer than the run so far raises a known end (never a blank one).
    if (patch.size && input.medium.numbering === "restart") {
      const total = input.groups.filter((g) => g.number !== number).reduce((s, g) => s + g.size, 0) + patch.size;
      const known = runSize(input.medium, w);
      if (known && total > known) (sizePatch as Record<string, unknown>)[input.medium.sizeKey ?? "size"] = total;
    }
    if (!w.partsTracked) sizePatch.partsTracked = true;
    if (Object.keys(sizePatch).length) await patchFresh(w, sizePatch as Partial<W>);
  }

  /** Remove a Group: its Marks and Review go; its Parts stay. */
  async function removeGroup(work: W, number: number): Promise<void> {
    const groups = await groupsOf(work.id);
    const cur = groups.find((g) => g.number === number);
    if (cur) await removeDocument(cur.id);
  }

  /** Stop tracking: the Parts and Groups go with what they said. */
  async function untrack(work: W): Promise<void> {
    await cascade(work);
    await patchFresh(work, { partsTracked: false, caughtUpGroup: 0, caughtUpPart: 0 } as Partial<W>);
  }

  /** Parts and Groups die with their work (ADR 0045's cascade). */
  async function cascade(work: Document): Promise<void> {
    const [parts, groups] = await Promise.all([partsOf(work.id), groupsOf(work.id)]);
    for (const d of [...parts, ...groups]) await removeDocument(d.id);
  }

  /** …and follow it to another Workspace (ADR 0048). */
  async function followers(work: Document): Promise<string[]> {
    const [parts, groups] = await Promise.all([partsOf(work.id), groupsOf(work.id)]);
    return [...parts, ...groups].map((d) => d.id);
  }

  /** React: one work's Parts and Groups, live. */
  function useWorkParts(workId: string | undefined): { parts: Part[]; groups: Group[] } {
    const parts = useLiveQuery(async () => (workId ? partsOf(workId) : []), [workId], [] as Part[]);
    const groups = useLiveQuery(async () => (workId ? groupsOf(workId) : []), [workId], [] as Group[]);
    return { parts, groups };
  }

  /** React: every Part and Group of this App, for the Cards' "+1" (one shared query). */
  function useAllParts(): { parts: Part[]; groups: Group[] } {
    return { parts: allPartsLive.use(), groups: allGroupsLive.use() };
  }

  /** Next part of a work, from already-loaded rows. */
  function nextOf(work: W, parts: Part[], groups: Group[]): Pos | null {
    const medium = cfg.mediumOf(work);
    if (!medium) return null;
    return nextPart({ medium, work, parts: parts.filter((p) => p.work === work.id), groups: groups.filter((g) => g.work === work.id) });
  }

  /** The Daylog: one line per work per day ("Read · One Piece · Chapters 1046–1048"). Days of catch-up never show. */
  function useDaylogItems(date: DateStr, works: W[]): DaylogItem[] {
    const read = useLiveQuery(async () => (await documentsWhere<Part>(partType, "readOn", date)).map(normalizePart), [date], [] as Part[]);
    return useMemo(() => {
      const byWork = new Map<string, Part[]>();
      for (const p of read) byWork.set(p.work, [...(byWork.get(p.work) ?? []), p]);
      const out: DaylogItem[] = [];
      for (const [workId, parts] of byWork) {
        const work = works.find((w) => w.id === workId);
        const medium = work && cfg.mediumOf(work);
        if (!work || !medium) continue;
        out.push({
          key: `${cfg.appId}/parts/${workId}`,
          appId: cfg.appId,
          itemId: workId,
          kind: medium.verb,
          title: work.title,
          subtitle: daySummary(medium, parts.map(posOf)),
          time: null,
          href: cfg.href(work),
          tags: work.tags ?? [],
        });
      }
      return out;
    }, [read, works]);
  }

  /** The run's length as the user knows it; 0 = ongoing (CONTEXT.md, Part). */
  async function setRunSize(work: W, n: number): Promise<void> {
    const medium = cfg.mediumOf(work);
    if (!medium) return;
    await patchFresh(work, { [medium.sizeKey ?? "size"]: n } as Partial<W>);
  }

  /** Track this work's Parts (CONTEXT.md: optional — only once the user does). */
  async function track(work: W): Promise<void> {
    await patchFresh(work, { partsTracked: true } as Partial<W>);
  }

  /** The App's Done, on the work as stored now. */
  async function finish(work: W): Promise<void> {
    await cfg.finish(await fresh(work));
  }

  return {
    config: cfg,
    track,
    setRunSize,
    finish,
    fresh,
    typeDefs: [partTypeDef, groupTypeDef],
    /** Spread into the work types' defs: the cascade and the Workspace move. */
    workTypeHooks: { onDelete: cascade, followers } satisfies Pick<DocumentTypeDef, "onDelete" | "followers">,
    partsOf,
    groupsOf,
    inputFor,
    markRead,
    markUnread,
    readNext,
    catchUp,
    clearCatchUp,
    patchPart,
    patchGroup,
    removeGroup,
    untrack,
    useWorkParts,
    useAllParts,
    nextOf,
    useDaylogItems,
  };
}

