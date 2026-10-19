import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * The Progress Apps' editable Peeks (ADR 0085): a Stat, a Workout session, a
 * Habit, a Mood and a Fine are edited where they are peeked, through each
 * App's own controls, and the edit is the App's operation — it persists.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Runs in the page against the app's own Core module. */
async function inCore<A, R>(page: Page, fn: (core: any, arg: A) => Promise<R>, arg: A): Promise<R> {
  return page.evaluate(
    async ({ coreUrl, src, arg }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return new Function("core", "arg", `return (${src})(core, arg);`)(core, arg);
    },
    { coreUrl: CORE_URL, src: fn.toString(), arg },
  );
}

/** Put the Documents `make` returns the id of, then open its Peek over the Vault. */
async function peekNew(page: Page, make: (core: any, stamp: number) => Promise<string>) {
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(page, make, Date.now());
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return { id, dialog };
}

const field = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))?.[a.key], { id, key });

test("Stats: a Stat's unit is edited in its Peek; its kind stays fixed", async ({ page }) => {
  const { id, dialog } = await peekNew(page, async (core, stamp) => (await core.putDocument({ type: "stat", title: `Push-ups ${stamp}`, kind: "additive", unit: "reps", color: "blue", defaultIncrement: 10 })).id);
  await dialog.getByLabel("Unit").fill("sets");
  await page.keyboard.press("Escape");
  await expect.poll(() => field(page, id, "unit")).toBe("sets");
  expect(await field(page, id, "kind")).toBe("additive");
});

test("Workout: a Session's notes are edited in its Peek", async ({ page }) => {
  const { id, dialog } = await peekNew(page, async (core, stamp) => {
    const w = await core.putDocument({ type: "workout", title: `Fran ${stamp}`, blocks: [], tallies: [] });
    return (
      await core.putDocument({
        type: "workout_session",
        title: `Fran · 2026-10-01`,
        workoutId: w.id,
        startedAt: "2026-10-01T08:00:00.000Z",
        endedAt: "2026-10-01T08:20:00.000Z",
        date: "2026-10-01",
        start: "08:00",
        end: "08:20",
        durationMin: 20,
        results: [],
        notes: "",
      })
    ).id;
  });
  await dialog.getByLabel("Notes").fill("Felt strong");
  await page.keyboard.press("Escape");
  await expect.poll(() => field(page, id, "notes")).toBe("Felt strong");
});

test("Life Level: a Habit's difficulty is changed in its Peek", async ({ page }) => {
  const { id, dialog } = await peekNew(page, async (core, stamp) => (await core.putDocument({ type: "habit", title: `Read ${stamp}`, difficulty: "normal" })).id);
  await dialog.getByRole("combobox", { name: "Difficulty" }).click();
  await page.getByRole("option", { name: /^Hard/ }).click();
  await expect.poll(() => field(page, id, "difficulty")).toBe("hard");
});

test("Mood: a day's Mood is changed in its Peek", async ({ page }) => {
  const { id, dialog } = await peekNew(page, async (core) => {
    const date = "2020-01-0" + (1 + Math.floor(Math.random() * 9));
    const old = (await core.documentsOf("mood")).find((m: { title: string }) => m.title === date);
    if (old) await core.removeDocument(old.id);
    return (await core.putDocument({ type: "mood", title: date, level: 2 })).id;
  });
  await dialog.getByRole("button", { name: /Great/ }).click();
  await expect.poll(() => field(page, id, "level")).toBe(5);
});

test("Swear Jar: a Fine's note is edited in its Peek; its amount stays the Offence's", async ({ page }) => {
  const { id, dialog } = await peekNew(page, async (core, stamp) => {
    const o = await core.putDocument({ type: "swearjar_offence", title: `Snoozed ${stamp}`, name: `Snoozed ${stamp}`, price: 200, emoji: "", color: "", archived: false });
    return (await core.putDocument({ type: "swearjar_fine", title: "€2.00", offenceId: o.id, amount: 200, occurredAt: "2026-10-01T08:00:00.000Z", note: "" })).id;
  });
  await expect(dialog.getByLabel("Amount (cents)")).toHaveCount(0);
  await dialog.getByLabel("Note").fill("Twice, really");
  await page.keyboard.press("Escape");
  await expect.poll(() => field(page, id, "note")).toBe("Twice, really");
  expect(await field(page, id, "amount")).toBe(200);
});
