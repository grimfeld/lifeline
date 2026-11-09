import { useMemo, useSyncExternalStore } from "react";
import { deleteAttachment, documentTypeSync, documentsOf, documentsWhere, fieldsOfDocument, fireTallies, getDocument, hasRole, normalizeTags, patchDocument, putDocument, recallableDefs, removeDocument, removeDocumentsWhere, talliesOf, useAllDocuments, useDocuments, type Document, type Tally } from "@lifeline/core";
import { plainSentence } from "../domain/cloze";
import { REWRITABLE, type DraftChange } from "../domain/draft";
import { dayOf } from "../domain/practice";
import { materialOf, type MaterialDoc } from "../domain/material";
import { sameName } from "../domain/names";
import type { ReportReads } from "../domain/report";
import { sourceChain, type SourceReading } from "../domain/sources";

export type { MaterialDoc };
import { DECK, DEFAULT_NEW_CAP, FACT, TOPIC, RECALL, SENTENCE, WORD, type Deck, type Fact, type Grade, type Item, type Material, type Topic, type Recall, type Sentence, type Word } from "../domain/types";

// ---- Shapes on read: PocketBase returns absent fields as "" / undefined ----

function normalizeTopic(l: Topic): Topic {
  const cap = Number(l.newCap);
  return { ...l, name: l.name || l.title || "", newCap: Number.isFinite(cap) && cap >= 0 ? Math.round(cap) : DEFAULT_NEW_CAP, archived: !!l.archived, enyeOwn: !!l.enyeOwn, tallies: talliesOf(l), tags: l.tags ?? [] };
}

function normalizeWord(w: Word): Word {
  return { ...w, languageId: w.languageId ?? "", term: w.term || w.title || "", meaning: w.meaning ?? "", notes: w.notes ?? "", origin: w.origin ?? "", originId: w.originId ?? "", clip: w.clip ?? "", paused: !!w.paused, draft: !!w.draft, addedAt: w.addedAt || w.createdAt || "", tags: w.tags ?? [] };
}

function normalizeSentence(s: Sentence): Sentence {
  return { ...s, languageId: s.languageId ?? "", text: s.text ?? "", translation: s.translation ?? "", notes: s.notes ?? "", origin: s.origin ?? "", originId: s.originId ?? "", clip: s.clip ?? "", paused: !!s.paused, draft: !!s.draft, addedAt: s.addedAt || s.createdAt || "", tags: s.tags ?? [] };
}

function normalizeFact(f: Fact): Fact {
  return { ...f, languageId: f.languageId ?? "", question: f.question || f.title || "", answer: f.answer ?? "", notes: f.notes ?? "", origin: f.origin ?? "", originId: f.originId ?? "", paused: !!f.paused, draft: !!f.draft, addedAt: f.addedAt || f.createdAt || "", tags: f.tags ?? [] };
}

function normalizeDeck(d: Deck): Deck {
  return { ...d, languageId: d.languageId ?? "", name: d.name || d.title || "", members: Array.isArray(d.members) ? d.members.filter((x): x is string => typeof x === "string") : [], tags: d.tags ?? [] };
}

function normalizeRecall(r: Recall): Recall {
  return { ...r, languageId: r.languageId ?? "", itemId: r.itemId ?? "", slot: r.slot ?? "", grade: r.grade === "pass" ? "pass" : "fail", at: r.at || "", ...(r.typed ? { typed: String(r.typed) } : {}) };
}

// ---- Reads ----

export function useTopics(): Topic[] {
  const rows = useDocuments<Topic>(TOPIC);
  return useMemo(() => rows.map(normalizeTopic).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
}

export function useWords(): Word[] {
  const rows = useDocuments<Word>(WORD);
  return useMemo(() => rows.map(normalizeWord), [rows]);
}

export function useSentences(): Sentence[] {
  const rows = useDocuments<Sentence>(SENTENCE);
  return useMemo(() => rows.map(normalizeSentence), [rows]);
}

export function useFacts(): Fact[] {
  const rows = useDocuments<Fact>(FACT);
  return useMemo(() => rows.map(normalizeFact), [rows]);
}

export function useDecks(): Deck[] {
  const rows = useDocuments<Deck>(DECK);
  return useMemo(() => rows.map(normalizeDeck).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
}

export function useRecalls(): Recall[] {
  const rows = useDocuments<Recall>(RECALL);
  return useMemo(() => rows.map(normalizeRecall), [rows]);
}

/** Knowledge's own Words, Sentences and Facts of one Topic, together. */
export function useItems(languageId: string | undefined): Item[] {
  const words = useWords();
  const sentences = useSentences();
  const facts = useFacts();
  return useMemo(() => (languageId ? [...words, ...sentences, ...facts].filter((i) => i.languageId === languageId) : []), [words, sentences, facts, languageId]);
}

/**
 * Every Recallable Document in a Topic, whichever App owns it, read only
 * through the Contract (ADR 0073) — Practice knows no type by name.
 */
export function useAllMaterial(): MaterialDoc[] {
  const defs = recallableDefs();
  // eslint-disable-next-line react-hooks/rules-of-hooks -- hook order is stable: the declarations are fixed at compile time (ADR 0003)
  const rows = defs.map((d) => useDocuments(d.typeId));
  return useMemo(
    () => defs.flatMap((d, i) => (rows[i] ?? []).map((doc) => materialOf(d, doc))).filter((m) => m.topicId),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rows` is the list itself: one live query per Recallable declaration, fixed in length (ADR 0003)
    rows,
  );
}

/** One Topic's material. */
export function useMaterial(topicId: string | undefined): MaterialDoc[] {
  const all = useAllMaterial();
  return useMemo(() => (topicId ? all.filter((m) => m.topicId === topicId) : []), [all, topicId]);
}

/** The Role a Document plays to be a Source — the Notes App's, and the one Core knows Sources by (CONTEXT.md "Source"). */
export const SOURCE_ROLE = "source";

/**
 * The Sources each piece of material counts toward, nearest first, read
 * through its origin's links at every read (ADR 0073): a Note's or Quote's
 * Source-Role field, then each Source's own — its parent. Material with no
 * Source on the way is left out.
 */
export function useSourceChains(material: Material[]): { chains: Map<string, string[]>; titleOf: (id: string) => string } {
  const docs = useAllDocuments();
  return useMemo(() => {
    const byId = new Map(docs.map((d) => [d.id, d]));
    const read: SourceReading = {
      get: (id) => (id ? byId.get(id) : undefined),
      isSource: (d) => hasRole(d, SOURCE_ROLE),
      linkedSource: (d) => {
        const field = fieldsOfDocument(d, documentTypeSync(d.type)).find((f) => f.kind === "link" && f.linkRole === SOURCE_ROLE);
        const v = field ? (d as Record<string, unknown>)[field.key] : "";
        return typeof v === "string" ? v : "";
      },
    };
    const chains = new Map<string, string[]>();
    for (const m of material) {
      const chain = sourceChain(m.originId, read);
      if (chain.length) chains.set(m.id, chain);
    }
    return { chains, titleOf: (id: string) => byId.get(id)?.title || "Untitled" };
  }, [docs, material]);
}

export function useTopicRecalls(languageId: string | undefined): Recall[] {
  const recalls = useRecalls();
  return useMemo(() => (languageId ? recalls.filter((r) => r.languageId === languageId) : []), [recalls, languageId]);
}

// ---- The active Topic (per device, never synced) ----

const ACTIVE_KEY = "lifeline.languages.active";
const listeners = new Set<() => void>();

function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setActiveTopic(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // storage blocked: the choice lasts until reload
  }
  for (const l of listeners) l();
}

/**
 * The Topic the Module shows (CONTEXT.md "Topic"): the one remembered on
 * this device, else the first unarchived one. Undefined when there is none.
 */
export function useActiveTopic(): Topic | undefined {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readActive,
    () => "",
  );
  const live = useTopics().filter((l) => !l.archived);
  return live.find((l) => l.id === id) ?? live[0];
}

// ---- Topics ----

export interface TopicInput {
  name: string;
  newCap: number;
  tallies: Tally[];
  /** Left out, an edit keeps the Topic's setting. */
  enyeOwn?: boolean;
}

function topicRowOf(input: TopicInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Give the topic a name");
  const newCap = Math.max(0, Math.round(input.newCap));
  if (!Number.isFinite(newCap)) throw new Error("The daily new cap must be a number");
  return { type: TOPIC, title: name, name, newCap, tallies: input.tallies, folder: "", ...(input.enyeOwn === undefined ? {} : { enyeOwn: input.enyeOwn }) } as const;
}

export async function addTopic(input: TopicInput): Promise<string> {
  const row = await putDocument<Topic>({ ...topicRowOf(input), archived: false, tags: [] });
  return row.id;
}

export async function updateTopic(l: Topic, input: TopicInput): Promise<void> {
  await putDocument<Topic>({ ...l, ...topicRowOf(input) });
}

/** Archived: out of the switcher, no Practice, its Tallies silent — everything kept (CONTEXT.md "Topic"). */
export async function setTopicArchived(id: string, archived: boolean): Promise<void> {
  await patchDocument(id, { archived });
}

export async function deleteTopic(id: string): Promise<void> {
  await removeDocument(id);
}

/**
 * The `onDelete` guard: a Topic that still holds anything is archived, never
 * deleted — its Decks, and anything Recallable kept in it, whichever App owns
 * it (a kept Quote is the Notes App's).
 */
export async function refuseDeletingUsedTopic(doc: Document): Promise<void> {
  const refuse = () => {
    throw new Error("This topic still holds things kept in it — archive it instead");
  };
  if ((await documentsWhere(DECK, "languageId", doc.id)).length) refuse();
  for (const def of recallableDefs()) {
    if ((await documentsOf(def.typeId)).some((d) => def.topicOf(d) === doc.id)) refuse();
  }
}

// ---- Words and Sentences ----

export interface WordInput {
  languageId: string;
  term: string;
  meaning: string;
  notes?: string;
  origin?: string;
  originId?: string;
  /** The id of its clip Attachment; "" removes it, left out keeps it (ADR 0116). */
  clip?: string;
  tags?: string[];
  /** Made as an agent's draft (ADR 0115): never set by the app's own dialogs. */
  draft?: boolean;
}

/** The `clip` an edit writes: only when the input says. */
const clipOf = (input: { clip?: string }) => (input.clip === undefined ? {} : { clip: input.clip });

/** A replaced or removed clip's Attachment goes with it: the clip is nobody else's. */
async function dropReplacedClip(before: string | undefined, input: { clip?: string }): Promise<void> {
  if (before && input.clip !== undefined && input.clip !== before) await deleteAttachment(before);
}

function wordRowOf(input: WordInput) {
  const term = input.term.trim();
  if (!input.languageId) throw new Error("Pick a topic");
  if (!term) throw new Error("The word needs its term");
  if (!input.meaning.trim()) throw new Error("Write what it means");
  return { type: WORD, title: term, languageId: input.languageId, term, meaning: input.meaning.trim(), notes: input.notes?.trim() ?? "", origin: input.origin?.trim() ?? "", originId: input.originId ?? "", ...clipOf(input), tags: normalizeTags(input.tags ?? []), folder: "" } as const;
}

/**
 * The reads a practice report takes (domain/report.ts), normalised as the
 * screens read them. Decks and Recalls are read by their Topic's key; the
 * Recallable Contract names no topic field (ADR 0073), so material is read
 * per type and kept by its declared Topic.
 */
export const reportReads: ReportReads = {
  topics: async () => (await documentsOf<Topic>(TOPIC)).map(normalizeTopic),
  decksOf: async (topicId) => (await documentsWhere<Deck>(DECK, "languageId", topicId)).map(normalizeDeck),
  materialOf: async (topicId) => (await Promise.all(recallableDefs().map(async (def) => (await documentsOf(def.typeId)).map((doc) => materialOf(def, doc))))).flat().filter((m) => m.topicId === topicId),
  recallsOf: async (topicId) => (await documentsWhere<Recall>(RECALL, "languageId", topicId)).map(normalizeRecall),
};

/** Every Topic, Word, Sentence and Fact, read once — what headless adds check against. */
export async function allTopics(): Promise<Topic[]> {
  return documentsOf<Topic>(TOPIC);
}

export async function allWords(): Promise<Word[]> {
  return documentsOf<Word>(WORD);
}

export async function allSentences(): Promise<Sentence[]> {
  return documentsOf<Sentence>(SENTENCE);
}

export async function addWord(input: WordInput): Promise<string> {
  const row = await putDocument<Word>({ ...wordRowOf(input), paused: false, ...(input.draft ? { draft: true } : {}), addedAt: new Date().toISOString() });
  return row.id;
}

/** Editing never resets a Word: its forward and reverse stay the same Prompts (ADR 0058). */
export async function updateWord(w: Word, input: WordInput): Promise<void> {
  await putDocument<Word>({ ...w, ...wordRowOf(input) });
  await dropReplacedClip(w.clip, input);
}

export interface SentenceInput {
  languageId: string;
  text: string;
  translation?: string;
  notes?: string;
  origin?: string;
  originId?: string;
  /** The id of its clip Attachment; "" removes it, left out keeps it (ADR 0116). */
  clip?: string;
  tags?: string[];
  /** Made as an agent's draft (ADR 0115): never set by the app's own dialogs. */
  draft?: boolean;
}

function sentenceRowOf(input: SentenceInput) {
  const text = input.text.trim();
  if (!input.languageId) throw new Error("Pick a topic");
  if (!/\{\{\s*\S.*?\}\}/.test(text)) throw new Error("Mark at least one blank with {{ }}");
  return { type: SENTENCE, title: plainSentence(text), languageId: input.languageId, text, translation: input.translation?.trim() ?? "", notes: input.notes?.trim() ?? "", origin: input.origin?.trim() ?? "", originId: input.originId ?? "", ...clipOf(input), tags: normalizeTags(input.tags ?? []), folder: "" } as const;
}

export async function addSentence(input: SentenceInput): Promise<string> {
  const row = await putDocument<Sentence>({ ...sentenceRowOf(input), paused: false, ...(input.draft ? { draft: true } : {}), addedAt: new Date().toISOString() });
  return row.id;
}

/** A blank whose text changed becomes a new Prompt; the others keep their Recalls (ADR 0058). */
export async function updateSentence(s: Sentence, input: SentenceInput): Promise<void> {
  await putDocument<Sentence>({ ...s, ...sentenceRowOf(input) });
  await dropReplacedClip(s.clip, input);
}

export interface FactInput {
  languageId: string;
  question: string;
  answer: string;
  notes?: string;
  origin?: string;
  originId?: string;
  tags?: string[];
  /** Made as an agent's draft (ADR 0115): never set by the app's own dialogs. */
  draft?: boolean;
}

/** Both sides are the user's own words (CONTEXT.md "Knowledge"): Lifeline drafts nothing; an agent's draft is the user's to accept (ADR 0115). */
function factRowOf(input: FactInput) {
  const question = input.question.trim();
  if (!input.languageId) throw new Error("Pick a topic");
  if (!question) throw new Error("Write the question");
  if (!input.answer.trim()) throw new Error("Write the answer");
  return { type: FACT, title: question, languageId: input.languageId, question, answer: input.answer.trim(), notes: input.notes?.trim() ?? "", origin: input.origin?.trim() ?? "", originId: input.originId ?? "", tags: normalizeTags(input.tags ?? []), folder: "" } as const;
}

export async function allFacts(): Promise<Fact[]> {
  return documentsOf<Fact>(FACT);
}

export async function addFact(input: FactInput): Promise<string> {
  const row = await putDocument<Fact>({ ...factRowOf(input), paused: false, ...(input.draft ? { draft: true } : {}), addedAt: new Date().toISOString() });
  return row.id;
}

/** Editing never resets a Fact: its one Prompt stays the same Prompt. */
export async function updateFact(f: Fact, input: FactInput): Promise<void> {
  await putDocument<Fact>({ ...f, ...factRowOf(input) });
}

/**
 * Accept a draft (ADR 0115): out of draft, added from this moment — so it enters
 * practice as new now, and the daily new cap counts it today. Its origin stays.
 */
export async function acceptDraft(id: string): Promise<void> {
  await patchDocument(id, { draft: false, addedAt: new Date().toISOString() });
}

/** Each kind's own edit, so whatever edits an item of unknown kind goes through the same checks and Prompt rules (ADR 0058). */
const UPDATE: Record<Item["type"], (item: Item, input: Item) => Promise<void>> = {
  [WORD]: (w, input) => updateWord(w as Word, input as Word),
  [SENTENCE]: (s, input) => updateSentence(s as Sentence, input as Sentence),
  [FACT]: (f, input) => updateFact(f as Fact, input as Fact),
};

/** Edit a Word, Sentence or Fact as its own update does: `input` is the item as it should read. */
export async function updateItem(item: Item, input: Item): Promise<void> {
  await UPDATE[item.type](item, input);
}

/** Each kind's row check: throws as its edit would when the item could not be saved so. */
const CHECK: Record<Item["type"], (item: Item) => unknown> = {
  [WORD]: (w) => wordRowOf(w as Word),
  [SENTENCE]: (s) => sentenceRowOf(s as Sentence),
  [FACT]: (f) => factRowOf(f as Fact),
};

/** The item read with the change over it — checked as an edit is, so a change that could not be saved is refused before it is stored. */
function withChange(item: Item, change: DraftChange): Item {
  const own = { ...item, ...change } as Item;
  CHECK[own.type](own);
  return own;
}

/**
 * An agent's draft change to an accepted item (ADR 0115), stored beside it as its one draft
 * change — a newer one replaces it — and never applied until the user accepts it. A draft
 * itself takes no draft change: the caller edits it directly.
 */
export async function saveDraftChange(item: Item, fields: DraftChange): Promise<void> {
  const change: DraftChange = {};
  for (const key of REWRITABLE[item.type]) if (fields[key] !== undefined) change[key] = fields[key]!.trim();
  withChange(item, change); // throws when the result is not a valid item
  await patchDocument(item.id, { draftChange: change });
}

/** Accept the draft change: applied as an ordinary edit, so Prompt identity and Recalls follow ADR 0058. */
export async function acceptDraftChange(item: Item): Promise<void> {
  if (!item.draftChange) return;
  await updateItem({ ...item, draftChange: null }, withChange(item, item.draftChange));
}

export async function discardDraftChange(id: string): Promise<void> {
  await patchDocument(id, { draftChange: null });
}

/** Accept a Deck's drafts at once: each exactly as `acceptDraft`, and only those still drafts — one deleted or accepted meanwhile is left alone. */
export async function acceptDrafts(ids: string[]): Promise<void> {
  for (const id of ids) {
    const doc = await getDocument<Item>(id);
    if (doc?.draft) await acceptDraft(id);
  }
}

/** Paused: listed, Recalls kept, out of every Practice until unpaused. */
export async function setPaused(id: string, paused: boolean): Promise<void> {
  await patchDocument(id, { paused });
}

export async function deleteItem(id: string): Promise<void> {
  await removeDocument(id);
}

/**
 * Bring a deleted item back, for Undo: under its own id, so every Deck lists it again.
 * Its clip went with it (its bytes are dropped), so it comes back without one.
 */
export async function restoreItem(item: Item): Promise<void> {
  const { clip: _gone, ...rest } = item as Word;
  await putDocument(rest);
}

/** The cascade, for any Recallable Document: its Recalls mean nothing without its Prompts, nor its clip (ADR 0116) without it. Decks simply stop listing it on read. */
export async function removeItemRecalls(doc: Document): Promise<void> {
  await removeDocumentsWhere(RECALL, (r) => r.itemId === doc.id);
  const clip = (doc as Word).clip;
  if (clip) await deleteAttachment(clip);
}

// ---- Decks ----

export async function addDeck(languageId: string, name: string): Promise<string> {
  const n = name.trim();
  if (!n) throw new Error("Give the deck a name");
  const row = await putDocument<Deck>({ type: DECK, title: n, name: n, languageId, members: [], folder: "", tags: [] });
  return row.id;
}

export async function renameDeck(d: Deck, name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Give the deck a name");
  await putDocument<Deck>({ ...d, name: n, title: n });
}

/** Membership writes per Deck, one after another: each reads the members the last one wrote. */
const membershipWrites = new Map<string, Promise<void>>();

/**
 * Membership is the Deck's: a Word goes in or out of one Deck, and only items
 * of the Deck's Topic go in. The Deck is re-read under a per-Deck queue,
 * so quick clicks made against the same (stale) Deck each keep their change.
 */
export function setMembership(deck: Deck, item: Pick<Item, "id" | "languageId">, member: boolean): Promise<void> {
  if (item.languageId !== deck.languageId) return Promise.reject(new Error("A deck holds one topic only"));
  const write = async () => {
    const current = await getDocument<Deck>(deck.id);
    if (!current) throw new Error("That deck no longer exists");
    const has = current.members.includes(item.id);
    if (has === member) return;
    await patchDocument(deck.id, { members: member ? [...current.members, item.id] : current.members.filter((x) => x !== item.id) });
  };
  const next = (membershipWrites.get(deck.id) ?? Promise.resolve()).catch(() => undefined).then(write);
  membershipWrites.set(deck.id, next);
  void next.finally(() => {
    if (membershipWrites.get(deck.id) === next) membershipWrites.delete(deck.id);
  }).catch(() => undefined);
  return next;
}

/** The Deck of that name in the Topic (case ignored), made when absent — how an agent files a lesson (ADR 0115). */
export async function deckNamed(languageId: string, name: string): Promise<Deck> {
  const n = name.trim();
  const found = (await documentsWhere<Deck>(DECK, "languageId", languageId)).map(normalizeDeck).find((d) => sameName(d.name, n));
  if (found) return found;
  return normalizeDeck((await getDocument<Deck>(await addDeck(languageId, n)))!);
}

export async function deleteDeck(id: string): Promise<void> {
  await removeDocument(id);
}

// ---- Recalls ----

/**
 * Record one Recall (ADR 0058) on a Prompt of any Recallable Material — and,
 * when it is the Topic's first of the day, report the day as the Topic's
 * occurrence (ADR 0059), so its Tallies fire. A failing Tally never loses the
 * Recall. A typed attempt (ADR 0116) is kept with it, trimmed; an empty one is not.
 */
export async function recordRecall(item: Material, slot: string, grade: Grade, typed?: string): Promise<{ id: string; tallyError?: string }> {
  const at = new Date().toISOString();
  const day = dayOf(at);
  const earlier = (await documentsWhere<Recall>(RECALL, "languageId", item.topicId)).some((r) => r.at && dayOf(r.at) === day);
  const attempt = typed?.trim();
  const row = await putDocument<Recall>({ type: RECALL, title: `${grade === "pass" ? "✓" : "✗"} ${item.title} · ${day}`, languageId: item.topicId, itemId: item.id, slot, grade, at, ...(attempt ? { typed: attempt } : {}), folder: "", tags: [] });
  if (earlier) return { id: row.id };
  const topic = await getDocument<Topic>(item.topicId);
  if (!topic || topic.archived) return { id: row.id };
  try {
    await fireTallies(topic, { key: day, at, note: `Practised ${topic.title}` });
    return { id: row.id };
  } catch (err) {
    return { id: row.id, tallyError: (err as Error).message };
  }
}

/** A mis-tapped Recall is struck out; everything re-derives without it. */
export async function strikeRecall(id: string): Promise<void> {
  await removeDocument(id);
}

