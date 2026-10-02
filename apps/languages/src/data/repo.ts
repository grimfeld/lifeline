import { useMemo, useSyncExternalStore } from "react";
import { documentsOf, documentsWhere, fireTallies, getDocument, normalizeTags, patchDocument, putDocument, removeDocument, removeDocumentsWhere, talliesOf, useDocuments, type Document, type Tally } from "@lifeline/core";
import { plainSentence } from "../domain/cloze";
import { dayOf } from "../domain/practice";
import { DECK, DEFAULT_NEW_CAP, LANGUAGE, RECALL, SENTENCE, WORD, type Deck, type Grade, type Item, type Language, type Recall, type Sentence, type Word } from "../domain/types";

// ---- Shapes on read: PocketBase returns absent fields as "" / undefined ----

function normalizeLanguage(l: Language): Language {
  const cap = Number(l.newCap);
  return { ...l, name: l.name || l.title || "", newCap: Number.isFinite(cap) && cap >= 0 ? Math.round(cap) : DEFAULT_NEW_CAP, archived: !!l.archived, tallies: talliesOf(l), tags: l.tags ?? [] };
}

function normalizeWord(w: Word): Word {
  return { ...w, languageId: w.languageId ?? "", term: w.term || w.title || "", meaning: w.meaning ?? "", notes: w.notes ?? "", origin: w.origin ?? "", paused: !!w.paused, addedAt: w.addedAt || w.createdAt || "", tags: w.tags ?? [] };
}

function normalizeSentence(s: Sentence): Sentence {
  return { ...s, languageId: s.languageId ?? "", text: s.text ?? "", translation: s.translation ?? "", origin: s.origin ?? "", paused: !!s.paused, addedAt: s.addedAt || s.createdAt || "", tags: s.tags ?? [] };
}

function normalizeDeck(d: Deck): Deck {
  return { ...d, languageId: d.languageId ?? "", name: d.name || d.title || "", members: Array.isArray(d.members) ? d.members.filter((x): x is string => typeof x === "string") : [], tags: d.tags ?? [] };
}

function normalizeRecall(r: Recall): Recall {
  return { ...r, languageId: r.languageId ?? "", itemId: r.itemId ?? "", slot: r.slot ?? "", grade: r.grade === "pass" ? "pass" : "fail", at: r.at || "" };
}

// ---- Reads ----

export function useLanguages(): Language[] {
  const rows = useDocuments<Language>(LANGUAGE);
  return useMemo(() => rows.map(normalizeLanguage).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
}

export function useWords(): Word[] {
  const rows = useDocuments<Word>(WORD);
  return useMemo(() => rows.map(normalizeWord), [rows]);
}

export function useSentences(): Sentence[] {
  const rows = useDocuments<Sentence>(SENTENCE);
  return useMemo(() => rows.map(normalizeSentence), [rows]);
}

export function useDecks(): Deck[] {
  const rows = useDocuments<Deck>(DECK);
  return useMemo(() => rows.map(normalizeDeck).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
}

export function useRecalls(): Recall[] {
  const rows = useDocuments<Recall>(RECALL);
  return useMemo(() => rows.map(normalizeRecall), [rows]);
}

/** Words and Sentences of one Language, together — what Prompts come from. */
export function useItems(languageId: string | undefined): Item[] {
  const words = useWords();
  const sentences = useSentences();
  return useMemo(() => (languageId ? [...words, ...sentences].filter((i) => i.languageId === languageId) : []), [words, sentences, languageId]);
}

export function useLanguageRecalls(languageId: string | undefined): Recall[] {
  const recalls = useRecalls();
  return useMemo(() => (languageId ? recalls.filter((r) => r.languageId === languageId) : []), [recalls, languageId]);
}

// ---- The active Language (per device, never synced) ----

const ACTIVE_KEY = "lifeline.languages.active";
const listeners = new Set<() => void>();

function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setActiveLanguage(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // storage blocked: the choice lasts until reload
  }
  for (const l of listeners) l();
}

/**
 * The Language the Module shows (CONTEXT.md "Language"): the one remembered on
 * this device, else the first unarchived one. Undefined when there is none.
 */
export function useActiveLanguage(): Language | undefined {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readActive,
    () => "",
  );
  const live = useLanguages().filter((l) => !l.archived);
  return live.find((l) => l.id === id) ?? live[0];
}

// ---- Languages ----

export interface LanguageInput {
  name: string;
  newCap: number;
  tallies: Tally[];
}

function languageRowOf(input: LanguageInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Give the language a name");
  const newCap = Math.max(0, Math.round(input.newCap));
  if (!Number.isFinite(newCap)) throw new Error("The daily new cap must be a number");
  return { type: LANGUAGE, title: name, name, newCap, tallies: input.tallies, folder: "" } as const;
}

export async function addLanguage(input: LanguageInput): Promise<string> {
  const row = await putDocument<Language>({ ...languageRowOf(input), archived: false, tags: [] } as unknown as Language);
  return row.id;
}

export async function updateLanguage(l: Language, input: LanguageInput): Promise<void> {
  await putDocument<Language>({ ...l, ...languageRowOf(input) });
}

/** Archived: out of the switcher, no Practice, its Tallies silent — everything kept (CONTEXT.md "Language"). */
export async function setLanguageArchived(id: string, archived: boolean): Promise<void> {
  await patchDocument(id, { archived });
}

export async function deleteLanguage(id: string): Promise<void> {
  await removeDocument(id);
}

/** The `onDelete` guard: a Language that still holds anything is archived, never deleted. */
export async function refuseDeletingUsedLanguage(doc: Document): Promise<void> {
  for (const type of [WORD, SENTENCE, DECK]) {
    if ((await documentsWhere(type, "languageId", doc.id)).length) throw new Error("This language still holds words, sentences or decks — archive it instead");
  }
}

// ---- Words and Sentences ----

export interface WordInput {
  languageId: string;
  term: string;
  meaning: string;
  notes?: string;
  origin?: string;
  tags?: string[];
}

function wordRowOf(input: WordInput) {
  const term = input.term.trim();
  if (!input.languageId) throw new Error("Pick a language");
  if (!term) throw new Error("The word needs its term");
  if (!input.meaning.trim()) throw new Error("Write what it means");
  return { type: WORD, title: term, languageId: input.languageId, term, meaning: input.meaning.trim(), notes: input.notes?.trim() ?? "", origin: input.origin?.trim() ?? "", tags: normalizeTags(input.tags ?? []), folder: "" } as const;
}

/** Every Language, Word and Sentence, read once — what headless adds check against. */
export async function allLanguages(): Promise<Language[]> {
  return documentsOf<Language>(LANGUAGE);
}

export async function allWords(): Promise<Word[]> {
  return documentsOf<Word>(WORD);
}

export async function allSentences(): Promise<Sentence[]> {
  return documentsOf<Sentence>(SENTENCE);
}

export async function addWord(input: WordInput): Promise<string> {
  const row = await putDocument<Word>({ ...wordRowOf(input), paused: false, addedAt: new Date().toISOString() } as unknown as Word);
  return row.id;
}

/** Editing never resets a Word: its forward and reverse stay the same Prompts (ADR 0058). */
export async function updateWord(w: Word, input: WordInput): Promise<void> {
  await putDocument<Word>({ ...w, ...wordRowOf(input) });
}

export interface SentenceInput {
  languageId: string;
  text: string;
  translation?: string;
  origin?: string;
  tags?: string[];
}

function sentenceRowOf(input: SentenceInput) {
  const text = input.text.trim();
  if (!input.languageId) throw new Error("Pick a language");
  if (!/\{\{\s*\S.*?\}\}/.test(text)) throw new Error("Mark at least one blank with {{ }}");
  return { type: SENTENCE, title: plainSentence(text), languageId: input.languageId, text, translation: input.translation?.trim() ?? "", origin: input.origin?.trim() ?? "", tags: normalizeTags(input.tags ?? []), folder: "" } as const;
}

export async function addSentence(input: SentenceInput): Promise<string> {
  const row = await putDocument<Sentence>({ ...sentenceRowOf(input), paused: false, addedAt: new Date().toISOString() } as unknown as Sentence);
  return row.id;
}

/** A blank whose text changed becomes a new Prompt; the others keep their Recalls (ADR 0058). */
export async function updateSentence(s: Sentence, input: SentenceInput): Promise<void> {
  await putDocument<Sentence>({ ...s, ...sentenceRowOf(input) });
}

/** Paused: listed, Recalls kept, out of every Practice until unpaused. */
export async function setPaused(id: string, paused: boolean): Promise<void> {
  await patchDocument(id, { paused });
}

export async function deleteItem(id: string): Promise<void> {
  await removeDocument(id);
}

/** The cascade: an item's Recalls mean nothing without its Prompts. Decks simply stop listing it on read. */
export async function removeItemRecalls(doc: Document): Promise<void> {
  await removeDocumentsWhere(RECALL, (r) => r.itemId === doc.id);
}

// ---- Decks ----

export async function addDeck(languageId: string, name: string): Promise<string> {
  const n = name.trim();
  if (!n) throw new Error("Give the deck a name");
  const row = await putDocument<Deck>({ type: DECK, title: n, name: n, languageId, members: [], folder: "", tags: [] } as unknown as Deck);
  return row.id;
}

export async function renameDeck(d: Deck, name: string): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Give the deck a name");
  await putDocument<Deck>({ ...d, name: n, title: n });
}

/** Membership is the Deck's: a Word goes in or out of one Deck, and only items of the Deck's Language go in. */
export async function setMembership(deck: Deck, item: Item, member: boolean): Promise<void> {
  if (item.languageId !== deck.languageId) throw new Error("A deck holds one language only");
  const has = deck.members.includes(item.id);
  if (has === member) return;
  await patchDocument(deck.id, { members: member ? [...deck.members, item.id] : deck.members.filter((x) => x !== item.id) });
}

export async function deleteDeck(id: string): Promise<void> {
  await removeDocument(id);
}

// ---- Recalls ----

/**
 * Record one Recall (ADR 0058) — and, when it is the Language's first of the
 * day, report the day as the Language's occurrence (ADR 0059), so its Tallies
 * fire. A failing Tally never loses the Recall.
 */
export async function recordRecall(item: Item, slot: string, grade: Grade): Promise<{ id: string; tallyError?: string }> {
  const at = new Date().toISOString();
  const day = dayOf(at);
  const earlier = (await documentsWhere<Recall>(RECALL, "languageId", item.languageId)).some((r) => r.at && dayOf(r.at) === day);
  const row = await putDocument<Recall>({ type: RECALL, title: `${grade === "pass" ? "✓" : "✗"} ${item.title} · ${day}`, languageId: item.languageId, itemId: item.id, slot, grade, at, folder: "", tags: [] } as unknown as Recall);
  if (earlier) return { id: row.id };
  const language = await getDocument<Language>(item.languageId);
  if (!language || language.archived) return { id: row.id };
  try {
    await fireTallies(language, { key: day, at, note: `Practised ${language.title}` });
    return { id: row.id };
  } catch (err) {
    return { id: row.id, tallyError: (err as Error).message };
  }
}

/** A mis-tapped Recall is struck out; everything re-derives without it. */
export async function strikeRecall(id: string): Promise<void> {
  await removeDocument(id);
}

