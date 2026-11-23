import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AppManifest } from "@lifeline/core";

/**
 * A Command's arguments are not a Form, but they must not drift from it (#530):
 * a Field added to a type reaches an agent (MCP) and the palette only if its add
 * Command takes it. So for every built-in type with an add Command, each of the
 * type's own Fields is an argument of that Command, or is in `LEFT_OUT` with the
 * reason it is not. Built the way the Guide test (guide/guide.test.ts) reads the
 * registry: the Apps as the browser loads them.
 *
 * A Field hidden from forms (`hidden`: ids, ranks, bookkeeping) is out of scope:
 * no Form draws it, so there is no Form for the Command to drift from, and its
 * App sets it itself (a link id an argument resolves, a rank, a stamp).
 */

/** The add Command of each built-in type, and the argument that carries a Field whose key differs from its own (one argument, or several). */
const ADDS: Record<string, { command: string; as?: Record<string, string | string[]> }> = {
  chore: { command: "chores.add" },
  provision: { command: "pantry.add", as: { storageId: "storage" } },
  need: { command: "shopping.add", as: { aisleId: "aisle" } },
  task: { command: "tasks.add" },
  project: { command: "projects.new" },
  project_milestone: { command: "projects.milestone.add" },
  project_lane: { command: "projects.lane.add" },
  event: { command: "calendar.add-event" },
  stat_entry: { command: "stats.log", as: { statId: "stat", ts: ["date", "time"] } },
  habit_completion: { command: "lifelevel.complete", as: { habitId: "habit", occurredAt: ["date", "time"] } },
  negative_completion: { command: "lifelevel.log-negative", as: { negativeId: "negative", occurredAt: ["date", "time"] } },
  book: { command: "library.add" },
  comic: { command: "library.add" },
  manga: { command: "library.add" },
  movie: { command: "cinema.quick-add" },
  series: { command: "cinema.quick-add" },
  music: { command: "discotheque.quick-add" },
  game: { command: "arcade.quick-add" },
  source: { command: "commonplace.source-add" },
  note: { command: "commonplace.note-add", as: { source: "source" } },
  quote: { command: "commonplace.quote-add" },
  painting: { command: "museum.add", as: { artistId: "artist" } },
  drawing: { command: "museum.add", as: { artistId: "artist" } },
  photography: { command: "museum.add", as: { artistId: "artist" } },
  sculpture: { command: "museum.add", as: { artistId: "artist" } },
  architecture: { command: "museum.add", as: { artistId: "artist" } },
  contacts_person: { command: "people.add" },
  contacts_exchange: { command: "people.exchange-add" },
  atlas_place: { command: "places.add" },
  thought: { command: "thoughts.capture" },
  memories_memory: { command: "memories.add" },
  ledger_transaction: { command: "ledger.add", as: { accountId: "account", categoryId: "category" } },
  pocket_spend: { command: "pocket.spend", as: { allowanceId: "allowance" } },
  price_product: { command: "prices.product-add", as: { countName: "count_name", secondaryDimension: "secondary_dimension", secondaryUnit: "secondary_unit", compareBy: "compare_by" } },
  price_shop: { command: "prices.shop-add" },
  price_receipt: { command: "prices.receipt", as: { shopId: "shop" } },
  swearjar_fine: { command: "swearjar.fine", as: { offenceId: "offence", occurredAt: ["date", "time"] } },
  mood: { command: "mood.set", as: { level: "mood" } },
  language_word: { command: "knowledge.word", as: { languageId: "topic" } },
  language_sentence: { command: "knowledge.sentence", as: { languageId: "topic" } },
  knowledge_fact: { command: "knowledge.fact", as: { languageId: "topic" } },
};

/**
 * Commands that make a Document but are not "the add Command of a type" — a
 * second way in (a template, a quick-add that takes a handful of the Fields), or
 * a Command whose Document is a record of something else. Every Command that
 * returns a Document, whatever its id, is in `ADDS` or here, or the test below
 * fails: decide which it is.
 */
const NOT_THE_TYPES_ADD: Record<string, string> = {
  "calendar.add-from-template": "makes an Event from a template: the template supplies the Fields",
  "library.quick-add": "the one-line capture of a Work (title, author, type); library.add is the type's add Command",
  "notes.capture": "appends a line to the day's Daily note: a body, not a Document's Fields",
  "projects.task.place": "places an existing Task; makes nothing",
  "prices.add": "records a price: makes a one-line Receipt with its line (and a Product or Shop it names), so it fits no one type",
  // Commands that change an existing Document and return it: they add nothing, so no type's Form is theirs to follow.
  "projects.edit": "edits an existing Project (its Peek is the Form); returns it",
  "projects.stage": "moves an existing Project's stage, a transition; returns it",
  "projects.milestone.edit": "edits an existing Milestone; returns it",
  "projects.milestone.reach": "declares an existing Milestone reached, a transition; returns it",
  "projects.lane.edit": "edits an existing Lane; returns it",
  "library.next-part": "moves an existing Work on to its next part (episode, volume, disc), a transition; returns it",
  "library.shelf": "moves an existing Work along the shelf, a transition; returns it",
  "library.acquisition": "sets an existing Work's acquisition; returns it",
  "library.nightstand": "puts an existing Work on or off the nightstand; returns it",
  "library.catch-up": "marks an existing Work caught up to a part; returns it",
  "library.get": "reads an existing Work; changes nothing",
  "cinema.mark-watched": "marks an existing Movie or Series watched, a transition; returns it",
  "cinema.next-part": "moves an existing Work on to its next part (episode, volume, disc), a transition; returns it",
  "discotheque.mark-listened": "marks an existing Album listened, a transition; returns it",
  "discotheque.next-part": "moves an existing Work on to its next part (episode, volume, disc), a transition; returns it",
  "knowledge.draft-change": "drafts a change to an existing Word, Sentence or Fact for the user to accept; adds nothing",
};

/**
 * Built-in types with user-visible Fields that have no add Command to check: each
 * is made only through a dialog, a Form, or another type's operation. A type that
 * is in neither `ADDS` nor here fails the test below: decide which it is.
 */
const DIALOG_ONLY: Record<string, string> = {};

/** Leave one reason against many types of `DIALOG_ONLY`. */
function dialogOnly(reason: string, types: string[]) {
  for (const t of types) DIALOG_ONLY[t] = reason;
}

dialogOnly("made only through a dialog on the Calendar (a template, a Time blocker): no Command takes its Fields yet", ["event_template", "time_blocker", "blocker_template"]);
dialogOnly("a record an operation makes (a completion, an occurrence, a log line, a session, a version), not a Document a person adds", ["chore_completion", "task_occurrence", "library_part", "cinema_part", "discotheque_part", "price_line", "workout_session", "writing_version", "language_recall"]);
dialogOnly("a setting or list the App keeps for itself, edited in the App's own settings or Form: not something an agent adds", ["library_settings", "cinema_settings", "arcade_settings", "storage", "aisle", "window", "template"]);
dialogOnly("a grouping or playlist made and arranged in the App's own screen, not by a Command", ["library_group", "cinema_group", "cinema_playlist", "discotheque_group", "discotheque_playlist", "exhibition", "room"]);
dialogOnly("added through the App's own dialog or Form, with no add Command yet", ["stat", "habit", "negative", "author", "artist", "contacts_tie", "contacts_household", "ledger_account", "ledger_category", "ledger_series", "ledger_allocation", "ledger_rule", "pocket_allowance", "swearjar_offence", "language", "language_deck", "knowledge_puzzle", "workout", "exercise", "essay", "manuscript", "chapter", "outtake"]);

/**
 * "<type>.<field>" → why no add Command argument takes it. Every entry says why;
 * most are Fields only an operation sets (a status that moves, a day it is
 * stamped), or ones judged after the fact (a rating).
 */
const LEFT_OUT: Record<string, string> = {};

/** Leave one reason against many "<type>.<field>" keys (every type in `types` × every field in `fields`). */
function leave(reason: string, types: string[], fields: string[]) {
  for (const t of types) for (const f of fields) LEFT_OUT[`${t}.${f}`] = reason;
}

const WORKS = ["book", "comic", "manga", "movie", "series", "music", "game"];
const LIBRARY = ["book", "comic", "manga"];
const MUSEUM = ["painting", "drawing", "photography", "sculpture", "architecture"];

// A Field only a transition sets: the add Command makes the Document in its first state.
const SCREEN_WORKS = ["movie", "series", "music"];
leave("a new Work is a Wish: the shelf Commands (library.shelf, cinema.mark-watched…) move it and stamp it", WORKS, ["engagement", "startedOn"]);
leave("a new Work is a Wish: the shelf Commands (library.shelf, cinema.mark-watched…) move it and stamp it", [...LIBRARY, ...SCREEN_WORKS], ["partsTracked", "caughtUpPart"]);
leave("a new Work is a Wish: the shelf Commands (library.shelf, cinema.mark-watched…) move it and stamp it", LIBRARY, ["slot", "slottedOn"]);
leave("a new Work is a Wish: the shelf Commands (library.shelf, cinema.mark-watched…) move it and stamp it", [...SCREEN_WORKS, "game"], ["finishedOn"]);
leave("stamped with today by the App when the Work is added", WORKS, ["addedOn"]);
leave("stamped when the acquisition moves (library.acquisition), not chosen at adding", [...LIBRARY, "game"], ["acquiredOn"]);
leave("a Work is liked and rated once seen or read: library.shelf and the mark-watched Commands take them with the finish", [...LIBRARY, ...SCREEN_WORKS], ["liked", "rating"]);
leave("the parts of a Work are counted when its parts are tracked, from the Peek", LIBRARY, ["partCount"]);
// The one-line capture Commands: no fuller add Command exists for these Apps yet.
leave("the quick-add is the one-line capture (title, creator, type); the Peek fills the rest", SCREEN_WORKS, ["year", "size", "reason", "coverUrl"]);
leave("arcade.quick-add is the one-line capture (title, creator, type); the Peek fills the rest", ["game"], ["year", "size", "acquisition", "reason", "coverUrl"]);
leave("a Game starts as a Wish: engagement moves with its own Commands", ["game"], ["engagement"]);
leave("a Game starts unplayed: set by the Peek's transitions", ["game"], ["startedOn"]);

leave("a new Chore is active; pausing it is the Chore's own transition", ["chore"], ["status"]);
leave("stamped with today when the Need is bought", ["need"], ["boughtOn"]);
leave("a new Task is open: status moves by completing, reopening or dropping it (complete_item)", ["task"], ["status"]);
leave("stamped when the Task is completed (complete_item), never chosen", ["task"], ["completedOn"]);
leave("stamped when the Project's stage moves (projects.stage)", ["project"], ["startedOn", "endedOn"]);
leave("stamped when the Milestone is reached (projects.milestone.reach)", ["project_milestone"], ["reachedOn"]);
leave("a new Lane is open; done is set by projects.lane.edit", ["project_lane"], ["done"]);
leave("the Habit a Negative hits is the Negative's own affectsHabitId, filled by the App when logging", ["negative_completion"], ["affectedHabitId"]);

leave("stamped with today by the App when the Quote is captured", ["quote"], ["capturedOn"]);
leave("kept is decided when the Quote is reviewed, from its Peek", ["quote"], ["kept"]);
leave("the topic is filled by the App when a Quote is filed under one, not chosen at adding", ["quote"], ["topic"]);
leave("other names are added from the Peek once the Source is known", ["source", "note", "thought"], ["aliases"]);
leave("the publication day is filled from the Peek or a lookup, not at capture", ["source"], ["publishedOn"]);
leave("the image is filled from the Peek or a lookup, not at capture", MUSEUM, ["imageUrl"]);
leave("stamped with today by the App when the Artwork is added", MUSEUM, ["addedOn"]);
leave("the place is pinned from the Peek's map, not typed at capture", ["architecture"], ["geo"]);
leave("whether a Person is left out of drifting is a choice made from their Peek", ["contacts_person"], ["excludedFromDrifting"]);
leave("a Place's coordinates come from its address, looked up once (places.add's address), or from Here on the Add place dialog", ["atlas_place"], ["geo"]);
leave("a new Place is open; closing it is done from its Peek", ["atlas_place"], ["closed"]);
leave("a Shop's note is written from its Peek", ["price_shop"], ["note"]);
leave("noticed is set when the Receipt is checked against its prices, from the Peek", ["price_receipt"], ["noticed"]);
leave("the amount is the Offence's price, which swearjar.fine reads; a fine is never typed", ["swearjar_fine"], ["amount"]);
leave("the origin link is set by the Handoff that makes the item, not by an agent", ["language_word", "language_sentence", "knowledge_fact"], ["originId"]);
leave("a new item is practised at once: pausing it is done from its Peek", ["language_word", "language_sentence", "knowledge_fact"], ["paused"]);
leave("an item an agent adds becomes a draft by the App (ADR 0115); the argument is not the agent's to set", ["language_word", "language_sentence", "knowledge_fact"], ["draft"]);

let APPS: AppManifest[] = [];

// The registry as the browser loads it, views and all: a DOM first, so the
// browser-only libraries load (as guide/guide.test.ts does).
beforeAll(async () => {
  const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element"] as const) vi.stubGlobal(name, name === "window" ? window : window[name]);
  ({ APPS } = await import("./apps"));
}, 180_000);

const asList = (v: string | string[]) => (Array.isArray(v) ? v : [v]);

describe("a type's add Command", () => {
  it("takes every Field of the type, or the Field is left out with a reason", () => {
    const commands = new Map(APPS.flatMap((a) => a.commands).map((c) => [c.id, c]));
    const types = new Map(APPS.flatMap((a) => a.types).map((t) => [t.id, t]));
    const problems: string[] = [];
    for (const [typeId, { command, as = {} }] of Object.entries(ADDS)) {
      const type = types.get(typeId);
      const cmd = commands.get(command);
      if (!type) { problems.push(`ADDS names a type that does not exist: ${typeId}`); continue; }
      if (!cmd?.args) { problems.push(`${typeId}: ${command} does not exist or has no args`); continue; }
      const taken = new Set(cmd.args.map((a) => a.key));
      for (const f of type.fields) {
        if (f.hidden) continue;
        const wanted = asList(as[f.key] ?? f.key);
        if (wanted.every((k) => taken.has(k))) continue;
        if (`${typeId}.${f.key}` in LEFT_OUT) continue;
        problems.push(`${typeId}.${f.key}: ${command} takes no "${wanted.join('" / "')}" argument — add it, or list "${typeId}.${f.key}" in LEFT_OUT with the reason`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("has a reason for every left-out Field, and no entry that is no longer needed", () => {
    const types = new Map(APPS.flatMap((a) => a.types).map((t) => [t.id, t]));
    const commands = new Map(APPS.flatMap((a) => a.commands).map((c) => [c.id, c]));
    const stale: string[] = [];
    for (const [key, reason] of Object.entries(LEFT_OUT)) {
      expect(reason.trim().length, `${key} has no reason`).toBeGreaterThan(10);
      const [typeId, field] = [key.slice(0, key.indexOf(".")), key.slice(key.indexOf(".") + 1)];
      const f = types.get(typeId)?.fields.find((x) => x.key === field);
      if (!f) { stale.push(`${key}: no such Field`); continue; }
      const add = ADDS[typeId];
      const taken = new Set((commands.get(add?.command ?? "")?.args ?? []).map((a) => a.key));
      if (add && asList(add.as?.[field] ?? field).every((k) => taken.has(k))) stale.push(`${key}: the Command takes it now; drop the entry`);
    }
    for (const [id, reason] of Object.entries(NOT_THE_TYPES_ADD)) expect(reason.trim().length, `${id} has no reason`).toBeGreaterThan(10);
    expect(stale).toEqual([]);
  });

  it("is named for every Command that returns a Document: a new one joins ADDS or says why not", () => {
    const named = new Set([...Object.values(ADDS).map((a) => a.command), ...Object.keys(NOT_THE_TYPES_ADD)]);
    const unnamed = APPS.flatMap((a) => a.commands)
      .filter((c) => c.returnsDocument && !named.has(c.id))
      .map((c) => c.id);
    expect(unnamed, "These Commands return Documents but no type's Fields are checked against them: put the type in ADDS (shell/src/commandFields.test.ts), or the Command in NOT_THE_TYPES_ADD with the reason").toEqual([]);
  });

  it("checks every type with user-visible Fields, or lists it in DIALOG_ONLY with a reason", () => {
    const types = APPS.flatMap((a) => a.types).filter((t) => t.fields.some((f) => !f.hidden));
    const ids = new Set(types.map((t) => t.id));
    const unlisted = types.map((t) => t.id).filter((id) => !(id in ADDS) && !(id in DIALOG_ONLY));
    expect(unlisted, "These types have Fields but no add Command is checked against them: put the type in ADDS, or in DIALOG_ONLY (shell/src/commandFields.test.ts) with the reason").toEqual([]);
    const stale = Object.keys(DIALOG_ONLY).filter((id) => !ids.has(id) || id in ADDS);
    expect(stale, "DIALOG_ONLY names a type that is gone, has no visible Fields, or is in ADDS now").toEqual([]);
    for (const [id, reason] of Object.entries(DIALOG_ONLY)) expect(reason.trim().length, `${id} has no reason`).toBeGreaterThan(10);
  });

  it("names no Command in NOT_THE_TYPES_ADD that is gone or returns no Document", () => {
    const returning = new Set(APPS.flatMap((a) => a.commands).filter((c) => c.returnsDocument).map((c) => c.id));
    expect(Object.keys(NOT_THE_TYPES_ADD).filter((id) => !returning.has(id))).toEqual([]);
  });
});
