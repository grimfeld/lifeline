import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * The listening Prompt (ADR 0116): an item with a clip yields it in Practice, played as it
 * appears, replayable, typeable, and kept like any other Recall.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A quarter-second of 8 kHz silence as a WAV file. */
function wav(): Buffer {
  const samples = 2000;
  const b = Buffer.alloc(44 + samples);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples, 40);
  b.fill(128, 44);
  return b;
}

async function newTopic(page: Page, name: string) {
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(page, async (core, name: string) => void (await core.putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], tags: [] })), name);
  await page.reload();
  await workLocally(page);
}

/** A tab at the desk, the View picker on a phone. */
async function openView(page: Page, name: RegExp | string) {
  const tab = page.getByRole("tab", { name });
  const picker = page.getByRole("combobox", { name: "View" });
  await expect(tab.or(picker)).toBeVisible();
  if (await tab.isVisible()) return void (await tab.click());
  await picker.click();
  await page.getByRole("option", { name }).click();
}

async function openAdd(page: Page, kind: "Word" | "Sentence") {
  await openView(page, /^Kept/);
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("menuitem", { name: kind }).click();
}

async function attach(page: Page) {
  await page.getByTestId("clip-file").setInputFiles({ name: "nonno.wav", mimeType: "audio/wav", buffer: wav() });
  await expect(page.getByTestId("clip-preview")).toBeVisible();
}

async function practise(page: Page, name: string) {
  await openView(page, "Practice");
  await page.getByRole("button", { name: `Practise ${name}` }).click();
}

const played = (page: Page) => expect.poll(() => page.getByTestId("clip-audio").evaluate((a: HTMLAudioElement) => a.currentTime > 0 || a.ended || !a.paused));


test("an item with a clip produces a listening Prompt: it plays at once, takes a typed attempt, and the Recall keeps it", async ({ page }) => {
  const name = `Listening ${Date.now()}`;
  await newTopic(page, name);
  await openAdd(page, "Word");
  await page.getByLabel("Word", { exact: true }).fill("nonno");
  await page.getByLabel("Meaning").fill("grandfather");
  await attach(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Meet the written Prompts just now (so they are not due), so the listening one is all that is left.
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const w = (await core.documentsOf("language_word")).find((d) => (d as { languageId?: string }).languageId === t.id) as { id: string };
      const at = new Date().toISOString();
      for (const slot of ["forward", "reverse"]) await core.putDocument({ type: "language_recall", title: "", languageId: t.id, itemId: w.id, slot, grade: "pass", at, folder: "", tags: [] });
    },
    name,
  );
  await page.reload();
  await workLocally(page);

  await practise(page, name);
  await expect(page.getByText("What did you hear?")).toBeVisible();
  // Heard before any reveal, and replayable.
  await expect(page.getByTestId("clip-replay")).toBeEnabled();
  await played(page);
  const field = page.getByLabel("Your answer");
  await field.fill("nono");
  await field.press("Enter");
  const both = page.getByTestId("attempt-vs-answer");
  await expect(both).toContainText("nono");
  await expect(both).toContainText("nonno");
  await expect(page.getByText("grandfather")).toBeVisible();
  await page.getByRole("button", { name: "Fail" }).click();

  const kept = await inCore(page, async (core, name: string) => {
    const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
    return (await core.documentsOf("language_recall")).filter((r) => (r as { slot?: string }).slot === "listen" && (r as { languageId?: string }).languageId === t.id).map((r) => (r as { typed?: string }).typed);
  }, name);
  expect(kept).toEqual(["nono"]);
});

test("two listening Prompts in a row: the second clip plays as it appears too", async ({ page }) => {
  const name = `Listening twice ${Date.now()}`;
  await newTopic(page, name);
  for (const { term, meaning } of [{ term: "nonno", meaning: "grandfather" }, { term: "nonna", meaning: "grandmother" }]) {
    await openAdd(page, "Word");
    await page.getByLabel("Word", { exact: true }).fill(term);
    await page.getByLabel("Meaning").fill(meaning);
    await attach(page);
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  // Meet the written Prompts just now, so the two listening ones are all that is left.
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const words = (await core.documentsOf("language_word")).filter((d) => (d as { languageId?: string }).languageId === t.id) as { id: string }[];
      const at = new Date().toISOString();
      for (const w of words) for (const slot of ["forward", "reverse"]) await core.putDocument({ type: "language_recall", title: "", languageId: t.id, itemId: w.id, slot, grade: "pass", at, folder: "", tags: [] });
    },
    name,
  );
  await page.reload();
  await workLocally(page);

  await practise(page, name);
  await expect(page.getByText("What did you hear?")).toBeVisible();
  await played(page);
  const firstClip = await page.getByTestId("clip-audio").getAttribute("src");
  const field = page.getByLabel("Your answer");
  await field.fill("x");
  await field.press("Enter");
  await page.getByRole("button", { name: "Pass" }).click();

  // The next Prompt is a fresh one (unrevealed, empty field), and its own clip plays.
  await expect(page.getByLabel("Your answer")).toHaveValue("");
  await expect(page.getByTestId("attempt-vs-answer")).toHaveCount(0);
  await expect(page.getByTestId("clip-audio")).not.toHaveAttribute("src", firstClip ?? "");
  await played(page);
});

test("a Sentence with a clip is heard and recalled whole", async ({ page }) => {
  const name = `Listening sentence ${Date.now()}`;
  await newTopic(page, name);
  await openAdd(page, "Sentence");
  await page.getByLabel("Sentence", { exact: true }).fill("Mio {{nonno}} dorme");
  await attach(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const s = (await core.documentsOf("language_sentence")).find((d) => (d as { languageId?: string }).languageId === t.id) as { id: string };
      await core.putDocument({ type: "language_recall", title: "", languageId: t.id, itemId: s.id, slot: "blank:nonno", grade: "pass", at: new Date().toISOString(), folder: "", tags: [] });
    },
    name,
  );
  await page.reload();
  await workLocally(page);
  await practise(page, name);
  await expect(page.getByText("What did you hear?")).toBeVisible();
  await played(page);
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByText("Mio nonno dorme")).toBeVisible();
  await page.getByRole("button", { name: "Pass" }).click();
});
