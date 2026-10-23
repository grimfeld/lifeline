import {
  createDocument,
  documentType,
  getDocument,
  patchDocument,
  putDocument,
  saveDocumentType,
  writeGeo,
  type DocumentTypeRecord,
} from "@lifeline/core";
import { snapshot } from "@lifeline/app-writer";
import { newEssay, setPinned, setStatus } from "@lifeline/app-writer/src/data";
import { addQuote } from "@lifeline/app-commonplace/src/data/quotes";
import { addChapter, cutToOuttake, newManuscript } from "@lifeline/app-manuscript/src/data/repo";
import { addDeck, addTopic, setMembership } from "@lifeline/app-languages/src/data/repo";
import type { Deck, Item } from "@lifeline/app-languages/src/domain/types";
import { dailyNote, ensureDailyNote, ensurePeriod } from "@lifeline/app-notes/src/data/repo";
import { periodKey } from "@lifeline/app-notes/src/domain/periods";
import { PEOPLE, PLACES, type LifeClock, type PersonKey, type PlaceKey } from "../persona";
import { madeOn, run } from "./act";

/**
 * The writing side of the Demo life: the Journal (Days linking the persona's
 * people and places, so backlinks and Reports show), Notes and Quotes on
 * Sources, Research Essays with Versions, a Manuscript, Thoughts and
 * Knowledge. Dated by offsets from the visit day.
 */
export async function seedWriting(c: LifeClock): Promise<void> {
  await seedPeopleAndPlaces();
  await seedJournal(c);
  const notes = await seedNotes(c);
  await seedResearch(c, notes);
  await seedManuscript(c);
  await seedThoughts(c);
  await seedKnowledge(c);
}

const first = (name: string) => name.split(" ")[0];

/** A wikilink to a person, by the first name they go by in the Journal (an alias). */
const who = (k: PersonKey) => `[[${first(PEOPLE[k].name)}]]`;
/** A wikilink to a place, shown as `shown` when the prose calls it something shorter. */
const at = (k: PlaceKey, shown?: string) => (shown ? `[[${PLACES[k].name}|${shown}]]` : `[[${PLACES[k].name}]]`);

// ---- People and places -------------------------------------------------------

/**
 * The user-defined types the Journal homes. The type registry is a live cache
 * (`documentType` starts its watch, nothing else has before the first render),
 * so wait for it to carry the type before writing any of its Documents.
 */
async function ensureType(rec: Omit<DocumentTypeRecord, "id" | "updatedAt" | "deleted">): Promise<void> {
  if (documentType(rec.typeId)) return;
  await saveDocumentType(rec);
  for (let i = 0; i < 200 && !documentType(rec.typeId); i++) await new Promise((r) => setTimeout(r, 20));
  if (!documentType(rec.typeId)) throw new Error(`Demo life: the type "${rec.typeId}" never arrived`);
}

async function seedPeopleAndPlaces(): Promise<void> {
  await ensureType({
    typeId: "person",
    label: "People",
    icon: "user",
    folder: "People",
    body: "optional",
    linkable: true,
    module: "journal",
    order: 0,
    fields: [
      { key: "role", label: "Who", kind: "text" },
      { key: "aliases", label: "Aliases", kind: "list" },
    ],
    reports: [{ kind: "top", n: 5 }, { kind: "quiet", n: 5, days: 14 }, { kind: "last" }, { kind: "count" }, { kind: "heatmap" }],
  });
  await ensureType({
    typeId: "place",
    label: "Places",
    icon: "map-pin",
    folder: "Places",
    body: "optional",
    linkable: true,
    module: "journal",
    order: 1,
    locatableField: "where",
    fields: [
      { key: "kind", label: "Kind", kind: "text" },
      { key: "where", label: "Where", kind: "geo" },
      { key: "aliases", label: "Aliases", kind: "list" },
    ],
    reports: [{ kind: "top", n: 5 }, { kind: "last" }, { kind: "count" }, { kind: "heatmap" }],
  });

  for (const p of Object.values(PEOPLE)) {
    await createDocument({ type: "person", title: p.name, body: `${p.note}\n`, fields: { role: p.role, aliases: [first(p.name)] } });
  }
  for (const p of Object.values(PLACES)) {
    await createDocument({ type: "place", title: p.name, body: `${p.note}\n`, fields: { kind: p.kind, where: writeGeo({ lat: p.lat, lon: p.lng }), aliases: [] } });
  }
}

// ---- Journal -----------------------------------------------------------------

/** The Day's cross-App log, then the words. */
const day = (text: string) => "```daylog\n```\n\n" + text.trim() + "\n";

/** Days back from the visit day, each linking one to three people or places — unevenly, so the Reports rank. */
function journalDays(): [number, string][] {
  return [
    [
      0,
      `Huddle with ${who("sam")} at ${at("clinic", "the clinic")} first thing, lunch with ${who("aoife")}, then ${at("crag")} with ${who("marcus")} tonight. ` +
        `Full day, but a good shape to it.\n\n- Pack the climbing bag before work\n- Ask ${who("aoife")} which weekend suits for Kinsale`,
    ],
    [
      -1,
      `Long clinic day. Mr Doyle's knee is finally bending past ninety and he nearly cried — so did I, a bit. ` +
        `Wrote half his plan on the bus home and the rest is still waiting.\n\n${who("priya")} left banana bread on the landing with a note: *for the drill*. Fair trade.`,
    ],
    [
      -2,
      `Ran the loop at ${at("park")} before work, into the wind both ways somehow. ` +
        `Returned ${who("priya")}'s drill at last. Evening on the balcony with the herbs, which are thriving out of spite.`,
    ],
    [
      -3,
      `${at("crag")} with ${who("marcus")}. I finally sent the orange overhang that's been beating me for a month. ` +
        `He said "told you" four times on the walk to the car. Earned.`,
    ],
    [
      -4,
      `${who("aoife")} came over with takeaway and a spreadsheet of B&Bs in Kinsale. We picked nothing and laughed a lot. ` +
        `She's producing a series on lighthouses and wants to drag me to every one of them.`,
    ],
    [
      -6,
      `Swim at ${at("myrtleville", "Myrtleville")} with ${who("aoife")}. Eleven degrees, maybe less. ` +
        `Five minutes in, ten minutes of shrieking, an hour of feeling invincible. Tea from the flask on the rocks.`,
    ],
    [
      -7,
      `Call with ${who("helen")}. The dahlias are "coming along", which means they're magnificent. ` +
        `She wants a frame for the photo of Dad's boat for her birthday — must sort that this week.`,
    ],
    [
      -8,
      `Coffee and a wander through ${at("market", "the English Market")}. Bought far too much cheese. ` +
        `Read on the balcony after; the light lasts longer than I expect every single evening.`,
    ],
    [
      -9,
      `Portuguese with ${who("luis")}: past tense, and my genders are still a coin toss. ` +
        `He says I sound like a tourist from the north. I'm choosing to take that as a compliment.`,
    ],
    [
      -10,
      `${at("crag")} with ${who("marcus")}, short session — my fingers were done after an hour. ` +
        `We talked about a trip to the Burren in spring if the weather is kind.`,
    ],
    [
      -11,
      `Team meeting with ${who("sam")} at ${at("clinic", "the clinic")} about the new booking system. ` +
        `Everyone nodded at the spreadsheet. I think it might actually help.`,
    ],
    [
      -13,
      `Wet, slow day at home in ${at("home", "the flat")}. Cleaned, cooked a big pot of soup, sent ${who("helen")} photos of it. ` +
        `She replied with a photo of her soup. We are the same person.`,
    ],
    [
      -14,
      `Brunch with ${who("aoife")} near ${at("market", "the market")}. She's thinking of leaving radio for podcasts; ` +
        `I told her she'd be brilliant at either, which is true and also unhelpful.`,
    ],
    [
      -16,
      `${at("crag")} after work. ${who("marcus")} warmed up for once, so it's a day for the history books. ` +
        `Shoulder felt fine on the overhangs.`,
    ],
    [
      -18,
      `First lesson after the break with ${who("luis")}. We went through Lisbon place names and he laughed at my "Alfama". ` +
        `Summer feels closer.`,
    ],
    [
      -20,
      `Ran along ${at("park")} in the drizzle, then called ${who("helen")} from the car. ` +
        `${who("priya")}'s cats watched me stretch on the landing like a pair of judges.`,
    ],
  ];
}

const DAY_TEMPLATE = "```daylog\n```\n\n### What happened\n\n### Who I saw\n\n### Grateful for\n\n";

/**
 * The Journal's Day Template, in English, so the visitor's own new Days start
 * from it too (the built-in one is not). Written with the first screen, before
 * the visitor can open a Day (seed.ts).
 */
export async function seedDayTemplate(): Promise<void> {
  await createDocument({ type: "template", title: "daily", folder: "Templates", body: DAY_TEMPLATE, fields: { forType: "daily" } });
}

async function seedJournal(c: LifeClock): Promise<void> {
  for (const [offset, text] of journalDays()) {
    // Got or made as the Journal does: the visitor may already have opened
    // today's Day while this slice was written behind Home. Anything they
    // typed there stays, under the seeded entry.
    const before = await dailyNote(c.day(offset));
    const typed = before && before.body.trim() !== DAY_TEMPLATE.trim() ? before.body : "";
    const d = await ensureDailyNote(c.day(offset));
    await patchDocument(d.id, { body: typed ? `${day(text)}\n${typed}` : day(text) });
    await madeOn(d.id, c.day(offset));
  }

  const week = await ensurePeriod(periodKey("week", c.today));
  await patchDocument(week.id, {
    body:
      `## How the week went\n\nBusy at ${at("clinic", "the clinic")}, but the evenings were mine. ` +
      `Sent the overhang at ${at("crag")}.\n\n## What mattered\n\nTime with ${who("aoife")}: the swim, the B&B spreadsheet, the laughing.\n\n` +
      `## Next week\n\n- Get ${who("helen")}'s frame\n- Book Kinsale\n- Portuguese homework before the lesson, not during\n`,
  });
}

// ---- Notes and Quotes --------------------------------------------------------

interface SeededNotes {
  load: string;
  tendons: string;
  pain: string;
}

async function seedNotes(c: LifeClock): Promise<SeededNotes> {
  const source = async (args: Record<string, unknown>) => (await run("commonplace.source-add", args))!;
  const podcast = await source({ title: "The Long Run", kind: "podcast", author: "Niamh Carey" });
  const episode = await source({ title: "Load, not rest", kind: "episode", author: "Niamh Carey", parent: podcast });
  const article = await source({ title: "Why tendons like slow, heavy work", kind: "article", author: "Ruth Okafor" });
  const talk = await source({ title: "Pain is an opinion", kind: "talk", author: "Tomás Reilly" });
  const paper = await source({ title: "Cold water and mood: a pilot study", kind: "paper", author: "Maeve Lynch et al." });

  const note = async (src: string, text: string, offset: number, locator = "") => {
    const id = (await run("commonplace.note-add", { source: src, text, locator }))!;
    await madeOn(id, c.day(offset));
    return id;
  };
  const load = await note(
    episode,
    "Load is a dial, not a switch\n\nPatients hear \"rest\" and stop everything. Better: turn the load down until it's tolerable, then turn it back up week by week. The tissue needs a reason to adapt.",
    -12,
    "18:40",
  );
  const tendons = await note(
    article,
    "Tendons adapt on a scale of months\n\nMuscle feels stronger in weeks; tendon catches up over three to six months. That's the gap where people get hurt — they feel ready before they are.",
    -15,
    "§3",
  );
  const pain = await note(
    talk,
    "Explain pain before treating it\n\nWhen someone understands that pain isn't the same as damage, they move more freely in the very next session. Five minutes of explaining saves weeks.",
    -9,
  );
  await note(
    paper,
    "Cold water and mood: small studies, big claims\n\nTwenty-odd swimmers, no control group. Promising, and I believe it from the rocks at Myrtleville, but I wouldn't put it on a leaflet yet.",
    -5,
  );
  await note(episode, "Isometrics before a session\n\nA few long holds before running seem to calm an irritable tendon. Worth trying with the marathon group.", -3, "31:05");

  const quote = (src: string, text: string, offset: number, locator = "", comment = "") =>
    addQuote({ source: src, text, locator, comment, capturedOn: c.day(offset) }).then((q) => madeOn(q.id, c.day(offset)));
  await quote(article, "The body keeps adapting as long as you keep asking it to, and stops the day you stop asking.", -15, "p. 2");
  await quote(episode, "Rest is not the opposite of training. It's the half of training nobody films.", -12, "22:10", "For the return-to-run guide.");
  await quote(talk, "Pain is the brain's best guess about danger, and guesses can be revised.", -9);
  await quote(talk, "Nobody was ever reassured by a scan they didn't understand.", -9, "", "Say less jargon on Mondays.");
  await quote(podcast, "Consistency beats intensity, and boredom beats both.", -6);
  await quote(paper, "Participants consistently reported feeling calmer for several hours after immersion.", -5, "Results");

  return { load, tendons, pain };
}

// ---- Research ----------------------------------------------------------------

async function seedResearch(c: LifeClock, notes: SeededNotes): Promise<void> {
  const rest = await newEssay({ title: "What rest is for", tags: ["physio"] });
  const draft1 =
    "Most of my patients think rest means stopping. It doesn't.\n\n" +
    "When we say rest we usually mean less: less load, less often, for a while. [[Load is a dial, not a switch]].\n";
  const final =
    "Most of my patients think rest means stopping. It doesn't — and the difference decides how long they stay injured.\n\n" +
    "## Less, not none\n\nRest is a reduction, not an absence. [[Load is a dial, not a switch]]: we turn it down until the tissue " +
    "tolerates it, then back up. Stopping completely takes away the very signal that makes tissue adapt.\n\n" +
    "## The slow tissues\n\n[[Tendons adapt on a scale of months]], which is why someone can feel ready at week six and break down at week eight. " +
    "The plan has to outlast the feeling.\n\n" +
    "## Telling people\n\nNone of this works if the person is afraid. [[Explain pain before treating it]] — five minutes at the start of a plan is worth more than any exercise sheet.\n";
  await patchDocument(rest.id, { body: draft1 });
  const v1 = await snapshot({ ...rest, body: draft1 }, "First draft");
  await patchDocument(v1.id, { takenAt: c.moment(-12, "21:15") });
  const draft2 = draft1 + "\n## The slow tissues\n\n[[Tendons adapt on a scale of months]].\n";
  const v2 = await snapshot({ ...rest, body: draft2 }, "Added tendons");
  await patchDocument(v2.id, { takenAt: c.moment(-4, "20:30") });
  await patchDocument(rest.id, { body: final });
  await setStatus(rest.id, "revised");
  for (const id of [notes.load, notes.tendons, notes.pain]) await setPinned(rest.id, id, true);

  const guide = await newEssay({ title: "Notes towards a return-to-run guide", tags: ["physio", "clinic"] });
  await patchDocument(guide.id, {
    body:
      "A one-page guide for runners coming back from injury, to hand out at the clinic.\n\n" +
      "- Walk-run before run. Ten minutes, then build.\n- Pain up to 3/10 is allowed if it settles by the next morning.\n" +
      "- Strength twice a week, always — [[Load is a dial, not a switch]].\n- No speed work until the long run feels boring.\n\n" +
      "Still to write: what to do on a bad day.\n",
  });
  await setPinned(guide.id, notes.load, true);
}

// ---- Manuscript --------------------------------------------------------------

async function seedManuscript(c: LifeClock): Promise<void> {
  const m = await newManuscript({ title: "The Tide Tables", form: "novel" });
  const chapter = async (title: string, body: string, status: "draft" | "revised") => {
    const ch = await addChapter(m.id, title);
    await patchDocument(ch.id, { body, status });
    return (await getDocument(ch.id))!;
  };

  const one = await chapter(
    "The Swimmer",
    "Every morning at seven, before the town was properly awake, Nora Quill walked down to the slipway with a towel over her shoulder and a tide table folded in her coat.\n\n" +
      "She didn't need the table. She had swum from the same rocks for thirty years and could feel the tide turning in her knees. But she liked to be right on paper too.\n\n" +
      "The water that morning was the colour of pewter, and there was someone already in it.\n",
    "revised",
  );
  const v = await snapshot(one, "Before the rewrite of the opening");
  await patchDocument(v.id, { takenAt: c.moment(-10, "22:05") });

  const passage = "She thought, briefly and uncharitably, about the parking.";
  const two = await chapter(
    "Low Water",
    "The stranger was a young man in a borrowed wetsuit, swimming badly and with tremendous determination.\n\n" +
      `Nora watched from the rocks until he came in, blue-lipped and grinning. ${passage}\n\n` +
      "\"Is it always this cold?\" he asked. \"Only in the months with an R in them,\" she said, \"and the others.\"\n",
    "draft",
  );
  await cutToOuttake(two.id, passage);

  await chapter(
    "Harbour Lights",
    "By the end of the week he was there every morning, a little earlier each time, as if trying to arrive before her.\n\n" +
      "Nora told herself she minded. She brought a second cup for the flask anyway.\n",
    "draft",
  );
}

// ---- Thoughts ----------------------------------------------------------------

async function seedThoughts(c: LifeClock): Promise<void> {
  const thought = async (text: string, kind: string, offset: number) => {
    const id = (await run("thoughts.capture", { text, kind }))!;
    await madeOn(id, c.day(offset));
  };
  await thought("Rehab is mostly patience\n\nThe exercises are the easy part. The hard part is believing week four when it feels like week one.", "reflection", -1);
  await thought(`A newsletter for patients\n\nOne page a month from ${at("clinic", "the clinic")}: an exercise, a myth, a story. Ask ${who("sam")} if we can.`, "idea", -2);
  await thought("Why do I only stretch when something already hurts?", "question", -3);
  await thought(`Swim more, worry less\n\nEvery time I go to ${at("myrtleville", "Myrtleville")} with ${who("aoife")} I come home a nicer person.`, "feeling", -6);
  await thought("Could Lisbon be a month instead of two weeks?\n\nWork remotely on the admin side for a fortnight? Worth a conversation.", "question", -9);
  await thought(`A running group from the clinic\n\nThursday mornings at ${at("park")}, easy pace, patients and staff together.`, "idea", -11);
  await thought("Restless after the long week\n\nToo many sessions back to back, not enough air. Next week, a proper lunch break every day.", "feeling", -13);
  await thought(`The flat in the evening light\n\nThe balcony at eight o'clock, the herbs and the rooftops. I forget how lucky I am to have ${at("home", "this place")}.`, "reflection", -17);
}

// ---- Knowledge ---------------------------------------------------------------

async function seedKnowledge(c: LifeClock): Promise<void> {
  const portuguese = await addTopic({ name: "Portuguese", newCap: 8, tallies: [] });
  // Topics list by name and the first one opens: Portuguese, the richer one, sorts first.
  const history = await addTopic({ name: "World history", newCap: 5, tallies: [] });

  const word = async (term: string, meaning: string, notes = "") => (await run("knowledge.word", { topic: portuguese, term, meaning, notes, origin: "Lessons with Luís" }))!;
  const words = [
    await word("saudade", "a longing for something or someone far away", "No real English word. Luís says every fado is about it."),
    await word("obrigada", "thank you (said by a woman)"),
    await word("devagar", "slowly"),
    await word("a praia", "the beach"),
    await word("o pequeno-almoço", "breakfast"),
    await word("amanhã", "tomorrow"),
    await word("a esplanada", "an outdoor café terrace"),
    await word("cansada", "tired (feminine)"),
  ] as const;

  for (const [text, translation] of [
    ["Eu {{moro}} em Cork.", "I live in Cork."],
    ["Vamos à {{praia}} amanhã?", "Shall we go to the beach tomorrow?"],
    ["Pode falar mais {{devagar}}, por favor?", "Could you speak more slowly, please?"],
  ]) {
    await run("knowledge.sentence", { topic: portuguese, text, translation, origin: "Lessons with Luís" });
  }

  for (const [question, answer] of [
    ["In what year did the great Lisbon earthquake strike?", "1755, on All Saints' Day (1 November)."],
    ["Which king commissioned the Tower of Belém?", "King Manuel I, in the early 1500s."],
    ["When did euro notes and coins arrive in Ireland and Portugal?", "1 January 2002."],
    ["Who read the Proclamation of the Irish Republic outside the GPO in 1916?", "Patrick Pearse, on Easter Monday."],
  ]) {
    await run("knowledge.fact", { topic: history, question, answer });
  }

  const deckId = await addDeck(portuguese, "Lisbon trip");
  for (const id of [words[3], words[4], words[6], words[0]]) {
    const deck = await getDocument<Deck>(deckId);
    const item = await getDocument<Item>(id);
    if (deck && item) await setMembership(deck, item, true);
  }

  // A few past practice sessions, so some words are due and some rest.
  const recall = (itemId: string, term: string, grade: "pass" | "fail", offset: number) =>
    putDocument({
      type: "recall",
      title: `${grade === "pass" ? "✓" : "✗"} ${term} · ${c.day(offset)}`,
      languageId: portuguese,
      itemId,
      slot: "forward",
      grade,
      at: c.moment(offset, "21:00"),
      folder: "",
      tags: [],
    });
  await recall(words[0], "saudade", "pass", -9);
  await recall(words[0], "saudade", "pass", -4);
  await recall(words[1], "obrigada", "pass", -9);
  await recall(words[2], "devagar", "fail", -9);
  await recall(words[2], "devagar", "pass", -4);
  await recall(words[7], "cansada", "fail", -4);
}
