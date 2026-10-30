import { pickLinked, type CommandDef } from "@lifeline/core";
import { caughtUpOf, nextPart, partName, progressOf } from "@lifeline/parts";
import { allAuthors, allWorks, patchWork } from "./data/repo";
import { libraryParts } from "./parts";
import { acquisitionPatch, evict, freeSlots, nightstand, promote, shelfMove } from "./domain/rules";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { shelfLabel } from "./domain/cardQueries";
import { ACQ_LABEL, ACQUISITION, ENGAGEMENT, type Acquisition, type Engagement, type Work } from "./domain/types";

const WORK_ARG = { key: "work", label: "Work", kind: "text", required: true, hint: "Id or exact title of a book, comic or manga already on the shelf." } as const;

/** The Work a Command names, by id or exact title (as next-part does). */
async function pickWork(raw: unknown): Promise<Work> {
  const works = await allWorks();
  const id = pickLinked({ key: "work", label: "Work", kind: "link" }, String(raw ?? ""), works);
  return works.find((w) => w.id === id)!;
}

/** The Shelves and Acquisitions as Command options, in the Library's own words (shared with `library.add`). */
export const SHELF_OPTIONS = ENGAGEMENT.map((v) => ({ value: v, label: shelfLabel(v, WORK_TYPES[0]!.id) }));
export const ACQUISITION_OPTIONS = ACQUISITION.map((v) => ({ value: v, label: ACQ_LABEL[v] }));

export const libraryStateCommands: CommandDef[] = [
  {
    id: "library.shelf",
    title: "Move on the shelf",
    keywords: ["shelf", "start", "finish", "done", "drop", "abandon", "to read", "reading", "library"],
    args: [
      WORK_ARG,
      { key: "shelf", label: "Shelf", kind: "select", required: true, options: SHELF_OPTIONS, hint: "To read, In progress, Done or Dropped. Done and Dropped free the Nightstand slot." },
      { key: "finishedOn", label: "Finished on", kind: "date", hint: "Only for Done; defaults to today." },
    ],
    returnsDocument: true,
    async invoke(a) {
      const w = await pickWork(a.work);
      const shelf = String(a.shelf) as Engagement;
      if (!ENGAGEMENT.includes(shelf)) throw new Error("Shelf: To read, In progress, Done or Dropped");
      if (a.finishedOn && shelf !== "DONE") throw new Error("Finished on: only with the Done shelf");
      const label = shelfLabel(shelf, w.type as WorkTypeId);
      if (w.engagement === shelf) throw new Error(`“${w.title}” is already ${label}; nothing was changed`);
      await patchWork(w, shelfMove(w, shelf, undefined, a.finishedOn as string | undefined));
      const freed = w.slot > 0 && (shelf === "DONE" || shelf === "ABANDONED");
      return { id: w.id, message: `${w.title}: ${label}${freed ? " · Nightstand slot freed" : ""}` };
    },
  },
  {
    id: "library.acquisition",
    title: "Set acquisition",
    keywords: ["acquisition", "wanted", "owned", "borrowed", "gone", "bought", "sold", "library"],
    args: [WORK_ARG, { key: "acquisition", label: "Acquisition", kind: "select", required: true, options: ACQUISITION_OPTIONS, hint: "Wanted, Owned, Borrowed or Gone (sold, returned, given away)." }],
    returnsDocument: true,
    async invoke(a) {
      const w = await pickWork(a.work);
      const to = String(a.acquisition) as Acquisition;
      if (!ACQUISITION.includes(to)) throw new Error("Acquisition: Wanted, Owned, Borrowed or Gone");
      const label = ACQ_LABEL[to];
      if (w.acquisition === to) throw new Error(`“${w.title}” is already ${label}; nothing was changed`);
      await patchWork(w, acquisitionPatch(to));
      return { id: w.id, message: `${w.title}: ${label}` };
    },
  },
  {
    id: "library.nightstand",
    title: "Nightstand on or off",
    keywords: ["nightstand", "slot", "next up", "attention", "library"],
    args: [WORK_ARG, { key: "on", label: "On the Nightstand", kind: "boolean", required: true, hint: "true to take a slot, false to free it." }],
    returnsDocument: true,
    async invoke(a) {
      const w = await pickWork(a.work);
      const type = workType(w.type);
      if (!a.on) {
        if (w.slot === 0) throw new Error(`“${w.title}” is not on the Nightstand; nothing was changed`);
        await patchWork(w, evict());
        return { id: w.id, message: `${w.title}: off the Nightstand` };
      }
      if (w.slot > 0) throw new Error(`“${w.title}” is already on the Nightstand; nothing was changed`);
      const works = await allWorks();
      const free = freeSlots(works, w.type);
      if (free.length === 0) {
        const holders = nightstand(works, w.type).map((h) => `“${h.title}”`).join(", ");
        throw new Error(`The ${type.label.toLowerCase()} Nightstand is full (${type.slotCount} slots), held by ${holders}; free one first — nothing was changed`);
      }
      await patchWork(w, promote(free[0]!));
      return { id: w.id, message: `${w.title}: on the Nightstand (slot ${free[0]})` };
    },
  },
  {
    id: "library.catch-up",
    title: "Catch up to a part",
    keywords: ["catch up", "caught up", "chapter", "issue", "progress", "parts", "library"],
    args: [
      WORK_ARG,
      { key: "part", label: "Part", kind: "number", required: true, hint: "The chapter or issue number read up to, everything before it counts as read with no day. 0 clears the catch-up." },
      { key: "group", label: "Group", kind: "number", hint: "The Section or Volume, for works whose parts restart in each; ignored when numbering runs on." },
    ],
    returnsDocument: true,
    async invoke(a) {
      const w = await pickWork(a.work);
      const medium = workType(w.type).parts;
      const number = a.part as number;
      if (!Number.isInteger(number) || number < 0) throw new Error(`${medium.part}: a whole number`);
      const group = medium.numbering === "restart" ? (a.group as number | undefined) ?? 0 : 0;
      if (!Number.isInteger(group) || group < 0) throw new Error(`${medium.group}: a whole number`);
      if (number === 0) {
        await libraryParts.clearCatchUp(w);
        return { id: w.id, message: `${w.title}: catch-up cleared` };
      }
      const out = await libraryParts.catchUp(w, { group, number });
      return { id: w.id, message: `${w.title}: caught up to ${partName(medium, { group, number })}${out.started ? " · started" : ""}${out.complete ? " · that was the last one — offer to mark it done" : ""}` };
    },
  },
  {
    id: "library.get",
    title: "Show a work",
    keywords: ["get", "show", "work", "details", "progress", "library"],
    args: [WORK_ARG],
    returnsDocument: true,
    async invoke(a) {
      const w = await pickWork(a.work);
      const type = workType(w.type);
      const names = new Map((await allAuthors()).map((x) => [x.id, x.title]));
      const input = await libraryParts.inputFor(w);
      const { read, total } = progressOf(input);
      const next = nextPart(input);
      const caught = caughtUpOf(input.work);
      const line = (k: string, v: unknown) => (v === "" || v === 0 || v === false || v == null ? [] : [`${k}: ${v}`]);
      const lines = [
        `${w.title} (${type.label.toLowerCase()}) id ${w.id}`,
        ...line("Authors", w.authors.map((id) => names.get(id)).filter(Boolean).join(", ")),
        `Shelf: ${shelfLabel(w.engagement, w.type as WorkTypeId)}`,
        `Acquisition: ${ACQ_LABEL[w.acquisition] ?? w.acquisition}`,
        `Nightstand: ${w.slot > 0 ? `slot ${w.slot}` : "off"}`,
        ...line("Year", w.year),
        ...line(`Size (${type.sizeUnit})`, w.size),
        ...line("Added on", w.addedOn),
        ...line("Acquired on", w.acquiredOn),
        ...line("Started on", w.startedOn),
        ...line("Finished on", w.finishedOn),
        ...line("Reason", w.reason),
        ...line("Liked", w.liked),
        ...line("Rating", w.rating),
        ...line("Tags", w.tags.join(", ")),
        `Progress: ${read}${total ? ` of ${total}` : ""} ${type.parts.parts} read${caught.number ? ` (caught up to ${partName(type.parts, caught)})` : ""}${next ? `; next ${partName(type.parts, next)}` : ""}`,
      ];
      return { id: w.id, message: lines.join("\n") };
    },
  },
];
