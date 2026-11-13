import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A clip on a Word or Sentence (ADR 0116): attached in its dialog, played once
 * on the reveal of any of its Prompts, replayable, and removable. An item
 * without one reveals as before.
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

test("a Word's clip plays on reveal and can be replayed", async ({ page }) => {
  const name = `Clip word ${Date.now()}`;
  await newTopic(page, name);
  await openAdd(page, "Word");
  await page.getByLabel("Word", { exact: true }).fill("nonno");
  await page.getByLabel("Meaning").fill("grandfather");
  await attach(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await practise(page, name);
  // Nothing plays or shows before the reveal.
  await expect(page.getByTestId("clip-replay")).toHaveCount(0);
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByTestId("clip-replay")).toBeEnabled();
  await played(page);
  // The replay starts a new play, so let the first one end (it is a quarter-second long).
  await expect.poll(() => page.getByTestId("clip-audio").evaluate((a: HTMLAudioElement) => a.ended)).toBe(true);
  await page.getByTestId("clip-replay").click();
  await expect.poll(() => page.getByTestId("clip-replay").getAttribute("data-plays")).toBe("2");
});

test("a Sentence's clip plays on reveal", async ({ page }) => {
  const name = `Clip sentence ${Date.now()}`;
  await newTopic(page, name);
  await openAdd(page, "Sentence");
  await page.getByLabel("Sentence", { exact: true }).fill("Mio {{nonno}} dorme");
  await attach(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await practise(page, name);
  await page.getByRole("button", { name: "Show answer" }).click();
  await played(page);
});

test("removing a clip leaves the item revealing without one; items without a clip are unchanged", async ({ page }) => {
  const name = `Clip removed ${Date.now()}`;
  await newTopic(page, name);
  await openAdd(page, "Word");
  await page.getByLabel("Word", { exact: true }).fill("ciao");
  await page.getByLabel("Meaning").fill("hi");
  await attach(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("button", { name: /ciao/ }).first().click();
  await expect(page.getByTestId("clip-preview")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("clip-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await practise(page, name);
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByRole("button", { name: "Pass" })).toBeVisible();
  await expect(page.getByTestId("clip-replay")).toHaveCount(0);
});

test("recording announces when it starts and stops, not every second, while the button counts", async ({ page }) => {
  // A microphone made of silence: the page asks for one only when Record is pressed.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const out = ctx.createMediaStreamDestination();
      osc.connect(out);
      osc.start();
      return out.stream;
    };
  });
  const name = `Clip record ${Date.now()}`;
  await newTopic(page, name);
  await openAdd(page, "Word");
  await page.getByRole("button", { name: "Record" }).click();
  const status = page.getByRole("status").filter({ hasText: /^Recording/ });
  await expect(status).toHaveText("Recording");
  await expect(page.getByRole("button", { name: "Stop recording" })).toContainText("2s", { timeout: 5000 });
  await expect(status).toHaveText("Recording");
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(status).toHaveText("Recording stopped");
});
