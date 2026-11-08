import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** Drifting (#420): People with a Relationship not seen for 90 days, the never seen first; leave someone out, bring them back. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 8000 }).then(() => local.click(), () => {});
}

test("Drifting ranks the People not seen lately, and leaving one out removes them until their page brings them back", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  // Dates are relative to now, so the specs never age.
  await inCore(
    page,
    async (core) => {
      const day = (back: number) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
      const person = async (title: string, relationship: string) => (await core.createDocument({ type: "contacts_person", title, fields: { relationship } })).id as string;
      const met = async (title: string, relationship: string, back: number) => {
        const id = await person(title, relationship);
        await core.createDocument({ type: "event", title: `Met ${title}`, fields: { date: day(back), with: [id] } });
      };
      await met("Drift Old", "old friend", 120);
      await met("Drift Older", "cousin", 200);
      await met("Drift Fresh", "colleague", 5);
      await met("Drift Nobody", "", 300);
      await person("Drift Never", "neighbour");
    },
    undefined,
  );

  const drifting = page.getByRole("region", { name: "Drifting" });
  const rows = drifting.getByRole("listitem");
  await expect(drifting.getByText("Drift Older")).toBeVisible();
  await expect(drifting.getByText("Drift Old", { exact: true })).toBeVisible();
  await expect(drifting.getByText("Drift Fresh")).toHaveCount(0);
  await expect(drifting.getByText("Drift Nobody")).toHaveCount(0);
  const text = (await rows.allInnerTexts()).join("|");
  // The never seen first, then the longest unseen.
  expect(text.indexOf("Drift Never")).toBeGreaterThanOrEqual(0);
  expect(text.indexOf("Drift Never")).toBeLessThan(text.indexOf("Drift Older"));
  await expect(rows.filter({ hasText: "Drift Never" }).getByText("Never seen")).toBeVisible();
  expect(text.indexOf("Drift Older")).toBeLessThan(text.indexOf("Drift Old\n"));

  // Left out from the row: gone from Drifting, still in Everyone.
  await drifting.getByRole("button", { name: "Leave out Drift Older" }).click();
  await expect(drifting.getByText("Drift Older")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Everyone" }).getByText("Drift Older")).toBeVisible();

  // Their page brings them back.
  await page.getByRole("region", { name: "Everyone" }).getByRole("link", { name: /Drift Older/ }).click();
  const excluded = page.getByRole("checkbox", { name: "Excluded from Drifting" });
  await expect(excluded).toBeChecked();
  await excluded.click();
  await expect(excluded).not.toBeChecked();
  await page.goto("/app/people");
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Drifting" }).getByText("Drift Older")).toBeVisible();
});

test("Not mentioned counts the Days that link instead", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  await inCore(
    page,
    async (core) => {
      const day = (back: number) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);
      const qui = (await core.createDocument({ type: "contacts_person", title: "Quiet Qui", fields: { relationship: "neighbour" } })).id as string;
      await core.createDocument({ type: "event", title: "Met Qui", fields: { date: day(5), with: [qui] } });
      await core.createDocument({ type: "daily", title: day(150), body: "[[Quiet Qui]]" });
    },
    undefined,
  );
  const drifting = page.getByRole("region", { name: "Drifting" });
  await expect(drifting.getByText("Quiet Qui")).toHaveCount(0);
  // A toggle on the desk, a select on a phone (ADR 0064).
  const by = drifting.getByRole("combobox", { name: "Drifting by" });
  if (await by.isVisible()) {
    await by.click();
    await page.getByRole("option", { name: "Not mentioned" }).click();
  } else await drifting.getByRole("radio", { name: "Not mentioned" }).click();
  await expect(drifting.getByText("Quiet Qui")).toBeVisible();
});
