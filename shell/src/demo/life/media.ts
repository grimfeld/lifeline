import { getDocument, patchDocument, type Document } from "@lifeline/core";
import { normalize as normalizeBook, patchWork as patchBook } from "@lifeline/app-library/src/data/repo";
import { acquire as acquireBook, finish as finishBook, promote, start as startBook } from "@lifeline/app-library/src/domain/rules";
import type { Work as Book } from "@lifeline/app-library/src/domain/types";
import { libraryParts } from "@lifeline/app-library/src/parts";
import { addPlaylist, normalize as normalizeScreen, patchWork as patchScreen } from "@lifeline/app-cinema/src/data/repo";
import { finish as finishScreen, start as startScreen } from "@lifeline/app-cinema/src/domain/rules";
import type { Work as Screened } from "@lifeline/app-cinema/src/domain/types";
import { cinemaParts } from "@lifeline/app-cinema/src/parts";
import { normalize as normalizeAlbum, patchWork as patchAlbum } from "@lifeline/app-discotheque/src/data/repo";
import { finish as finishAlbum, start as startAlbum } from "@lifeline/app-discotheque/src/domain/rules";
import type { Work as Album } from "@lifeline/app-discotheque/src/domain/types";
import { discothequeParts } from "@lifeline/app-discotheque/src/parts";
import { normalize as normalizeGame, patchWork as patchGame } from "@lifeline/app-arcade/src/data/repo";
import { acquire as acquireGame, finish as finishGame, start as startGame } from "@lifeline/app-arcade/src/domain/rules";
import type { Work as Game } from "@lifeline/app-arcade/src/domain/types";
import { addRoom, addExhibition, setRoomArtworks } from "@lifeline/app-museum/src/data/repo";
import { hang, takeDown } from "@lifeline/app-museum/src/domain/rules";
import { PEOPLE, type LifeClock } from "../persona";
import { run } from "./act";

const first = (name: string) => name.split(" ")[0];

/**
 * The culture slice of the Demo life (#112): what Iris reads, watches, listens
 * to and plays, and the art she has stood before — real, well-known works, in
 * every state, with a series mid-season and a book half-read.
 *
 * Added through each App's quick-add Command, then moved along its Shelf with
 * the App's own rules, backdated from the visit day. No lookup ever runs:
 * covers and images stay empty and Authors carry no external key, so first
 * open asks nothing of Open Library, TMDB, MusicBrainz, RAWG or Wikidata.
 */
export async function seedMedia(c: LifeClock): Promise<void> {
  await seedLibrary(c);
  await seedCinema(c);
  await seedDiscotheque(c);
  await seedArcade(c);
  await seedMuseum(c);
}

/** Re-read a work the App just wrote, in its App's own shape. */
async function fresh<W extends Document>(id: string, normalize: (w: W) => W): Promise<W> {
  const row = await getDocument<W>(id);
  if (!row) throw new Error(`Demo life: no work ${id}`);
  return normalize(row);
}

/** Quick-add a work (it lands unstarted, added today) and date its adding back. */
async function quickAdd(command: string, args: Record<string, unknown>, addedOn: string): Promise<string> {
  const id = await run(command, args);
  if (!id) throw new Error(`Demo life: ${command} made nothing`);
  await patchDocument(id, { addedOn });
  return id;
}

async function seedLibrary(c: LifeClock): Promise<void> {
  const book = (title: string, author: string, added: number, type = "book") =>
    quickAdd("library.quick-add", { title, author, type }, c.day(added));
  const get = (id: string) => fresh<Book>(id, normalizeBook);
  const step = async (id: string, patch: Partial<Book>) => patchBook(await get(id), patch);

  // On the nightstand, half-read: Chapters 1–9 caught up, 10 and 11 this week. Next up: Chapter 12.
  const normal = await book("Normal People", "Sally Rooney", -30);
  await step(normal, { year: 2018, ...acquireBook("OWNED", c.day(-30)) });
  await step(normal, { ...promote(1, c.day(-16)), ...startBook(c.day(-16)) });
  await libraryParts.setRunSize(await get(normal), 18);
  await libraryParts.catchUp(await get(normal), { group: 0, number: 9 });
  await libraryParts.markRead(await get(normal), { group: 0, number: 10 }, c.day(-3));
  await libraryParts.markRead(await get(normal), { group: 0, number: 11 }, c.day(-1));

  // Finished, and loved.
  const keegan = await book("Small Things Like These", "Claire Keegan", -26);
  await step(keegan, { year: 2021, ...acquireBook("BORROWED", c.day(-26)) });
  await step(keegan, startBook(c.day(-24)));
  await step(keegan, { ...finishBook(c.day(-19)), rating: 5, liked: true, body: "Read it in two evenings. Bill Furlong at the convent gate will stay with me a long time." });

  // Owned and waiting: the shelf of shame.
  const bornToRun = await book("Born to Run", "Christopher McDougall", -20);
  await step(bornToRun, { year: 2009, reason: "Half the clinic's runners quote it at me.", ...acquireBook("OWNED", c.day(-20)) });

  // Wanted, for Lisbon.
  const blind = await book("Blindness", "José Saramago", -8);
  await step(blind, { year: 1995, reason: `${first(PEOPLE.luis.name)} says read it in English first, then try the Portuguese.` });

  // A manga mid-run, ongoing.
  const vinland = await book("Vinland Saga", "Makoto Yukimura", -60, "manga");
  await step(vinland, { year: 2005, ...acquireBook("OWNED", c.day(-60)) });
  await step(vinland, startBook(c.day(-55)));
  await libraryParts.catchUp(await get(vinland), { group: 0, number: 54 });
  await libraryParts.markRead(await get(vinland), { group: 0, number: 55 }, c.day(-5));
}

async function seedCinema(c: LifeClock): Promise<void> {
  const add = (title: string, creator: string, type: "movie" | "series", added: number) =>
    quickAdd("cinema.quick-add", { title, creator, type }, c.day(added));
  const get = (id: string) => fresh<Screened>(id, normalizeScreen);
  const step = async (id: string, patch: Partial<Screened>) => patchScreen(await get(id), patch);

  // A series mid-season: all of Season 1, then S2E1 and S2E2 this week. Next up: S2E3.
  const derry = await add("Derry Girls", "Lisa McGee", "series", -14);
  await step(derry, { year: 2018, ...startScreen(c.day(-12)) });
  await cinemaParts.setRunSize(await get(derry), 19);
  await cinemaParts.patchGroup(await get(derry), 1, { size: 6 });
  await cinemaParts.patchGroup(await get(derry), 2, { size: 6 });
  await cinemaParts.patchGroup(await get(derry), 3, { size: 7 });
  await cinemaParts.catchUp(await get(derry), { group: 1, number: 6 });
  await cinemaParts.markRead(await get(derry), { group: 2, number: 1 }, c.day(-6));
  await cinemaParts.markRead(await get(derry), { group: 2, number: 2 }, c.day(-2));
  await cinemaParts.patchPart(await get(derry), { group: 1, number: 6 }, { rating: 5, liked: true });

  // Watched last weekend.
  const banshees = await add("The Banshees of Inisherin", "Martin McDonagh", "movie", -10);
  await step(banshees, { year: 2022, size: 114, ...startScreen(c.day(-4)) });
  await step(banshees, { ...finishScreen(c.day(-4)), rating: 4, liked: true, body: `Watched with ${first(PEOPLE.aoife.name)}. Funny for an hour, then not at all.` });

  const pastLives = await add("Past Lives", "Celine Song", "movie", -9);
  await step(pastLives, { year: 2023, size: 106 });
  const aftersun = await add("Aftersun", "Charlotte Wells", "movie", -3);
  await step(aftersun, { year: 2022, size: 102, reason: "Everyone at work says bring tissues." });

  await addPlaylist({ title: "For a rainy Sunday", body: "Quiet films for the sofa.", ranked: false, workIds: [pastLives, aftersun] });
}

async function seedDiscotheque(c: LifeClock): Promise<void> {
  const add = (title: string, creator: string, added: number) =>
    quickAdd("discotheque.quick-add", { title, creator, type: "music" }, c.day(added));
  const get = (id: string) => fresh<Album>(id, normalizeAlbum);
  const step = async (id: string, patch: Partial<Album>) => patchAlbum(await get(id), patch);

  // Listening through track by track on the walk to work. Next up: Track 4.
  const blue = await add("Blue", "Joni Mitchell", -7);
  await step(blue, { year: 1971, ...startAlbum(c.day(-5)) });
  await discothequeParts.patchGroup(await get(blue), 1, { size: 10 });
  await discothequeParts.markRead(await get(blue), { group: 1, number: 1 }, c.day(-5));
  await discothequeParts.markRead(await get(blue), { group: 1, number: 2 }, c.day(-5));
  await discothequeParts.markRead(await get(blue), { group: 1, number: 3 }, c.day(-2));

  const rumours = await add("Rumours", "Fleetwood Mac", -21);
  await step(rumours, { year: 1977, size: 11, ...startAlbum(c.day(-20)) });
  await step(rumours, { ...finishAlbum(c.day(-15)), rating: 5, liked: true, body: "The car album for the drive to Kilkenny." });

  const amalia = await add("Com Que Voz", "Amália Rodrigues", -4);
  await step(amalia, { year: 1970, reason: "Fado, for the Portuguese ear." });
}

async function seedArcade(c: LifeClock): Promise<void> {
  const add = (title: string, creator: string, added: number) =>
    quickAdd("arcade.quick-add", { title, creator, type: "game" }, c.day(added));
  const get = (id: string) => fresh<Game>(id, normalizeGame);
  const step = async (id: string, patch: Partial<Game>) => patchGame(await get(id), patch);

  const stardew = await add("Stardew Valley", "ConcernedApe", -40);
  await step(stardew, { year: 2016, ...acquireGame("OWNED", c.day(-40)) });
  await step(stardew, { ...startGame(c.day(-18)), body: "Year two on the farm. The greenhouse is finally fixed." });

  const celeste = await add("Celeste", "Maddy Makes Games", -50);
  await step(celeste, { year: 2018, size: 10, ...acquireGame("OWNED", c.day(-50)) });
  await step(celeste, startGame(c.day(-45)));
  await step(celeste, { ...finishGame(c.day(-17)), body: "Summit reached. Feels a lot like a hard route at the Crag." });

  const outer = await add("Outer Wilds", "Mobius Digital", -6);
  await step(outer, { year: 2019, reason: `${first(PEOPLE.marcus.name)} won't stop talking about it.` });
}

async function seedMuseum(c: LifeClock): Promise<void> {
  const art = async (args: Record<string, unknown>) => {
    const id = await run("museum.add", args);
    if (!id) throw new Error(`Demo life: museum.add made nothing`);
    return id;
  };

  const taking = await art({
    title: "The Taking of Christ",
    form: "painting",
    artist: "Caravaggio",
    year: "1602",
    location: "National Gallery of Ireland, Dublin",
    materials: "Oil on canvas",
    seen: true,
    comment: "The lantern held up at the edge. You find yourself looking for whoever holds it.",
  });
  const liffey = await art({
    title: "The Liffey Swim",
    form: "painting",
    artist: "Jack B. Yeats",
    year: "1923",
    location: "National Gallery of Ireland, Dublin",
    materials: "Oil on canvas",
    seen: true,
    comment: "All crowd and river. Makes me want to get back in the sea.",
  });
  const pearl = await art({
    title: "Girl with a Pearl Earring",
    form: "painting",
    artist: "Johannes Vermeer",
    year: "c. 1665",
    location: "Mauritshuis, The Hague",
    materials: "Oil on canvas",
    seen: true,
  });
  const thinker = await art({
    title: "The Thinker",
    form: "sculpture",
    artist: "Auguste Rodin",
    year: "1904",
    location: "Musée Rodin, Paris",
    materials: "Bronze",
    seen: true,
  });
  await art({
    title: "Vitruvian Man",
    form: "drawing",
    artist: "Leonardo da Vinci",
    year: "c. 1490",
    location: "Gallerie dell'Accademia, Venice",
    materials: "Pen and ink on paper",
    seen: false,
  });
  // A building on Iris's own map, placed by hand rather than geocoded.
  const finbarre = await art({
    title: "Saint Fin Barre's Cathedral",
    form: "architecture",
    artist: "William Burges",
    year: "1879",
    location: "Cork",
    seen: true,
    comment: "Passed on the way to the market every Saturday. The gold angel on the roof catches the evening sun.",
  });
  await patchDocument(finbarre, { geo: [51.8945, -8.4806] });

  // Hanging now: the paintings she has stood in front of, in two rooms.
  const stood = await addExhibition("Stood before");
  const dublin = await addRoom(stood, "Dublin");
  await setRoomArtworks(dublin, [taking, liffey]);
  const away = await addRoom(stood, "Away");
  await setRoomArtworks(away, [pearl, thinker]);
  await patchDocument(stood, hang(c.day(-12)));

  // An earlier show, taken down.
  const cork = await addExhibition("Close to home");
  const city = await addRoom(cork, "The city");
  await setRoomArtworks(city, [finbarre]);
  await patchDocument(cork, { ...hang(c.day(-60)), ...takeDown(c.day(-13)) });
}
