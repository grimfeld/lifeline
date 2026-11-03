import { test, expect, type Page } from "@playwright/test";

/**
 * Scanning a book's barcode on the phone (#382): the Add dialog offers it where
 * there is a camera and the platform reads barcodes, and a scanned ISBN runs the
 * ISBN search like a typed one. The camera and the BarcodeDetector are stood in
 * for here: `window.__barcode` is what the next frame reads.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A phone camera and BarcodeDetector that read `window.__barcode`, and Open Library answering one ISBN. */
async function fakeCamera(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __barcode: string; BarcodeDetector: unknown };
    w.__barcode = "";
    w.BarcodeDetector = class {
      static getSupportedFormats() {
        return Promise.resolve(["ean_13", "qr_code"]);
      }
      detect() {
        return Promise.resolve(w.__barcode ? [{ rawValue: w.__barcode, format: "ean_13" }] : []);
      }
    };
    navigator.mediaDevices.enumerateDevices = () => Promise.resolve([{ kind: "videoinput", deviceId: "", groupId: "", label: "" } as MediaDeviceInfo]);
    navigator.mediaDevices.getUserMedia = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      canvas.getContext("2d")!.fillRect(0, 0, 16, 16);
      return Promise.resolve(canvas.captureStream());
    };
  });
  await page.route(/^https:\/\/(?!localhost)/, (route) => {
    const url = route.request().url();
    if (url === "https://openlibrary.org/isbn/9780441172719.json") return route.fulfill({ json: { works: [{ key: "/works/OL893415W" }] } });
    if (url.startsWith("https://openlibrary.org/search.json") && url.includes("OL893415W"))
      return route.fulfill({ json: { docs: [{ key: "/works/OL893415W", title: "Dune", author_name: ["Frank Herbert"], first_publish_year: 1965 }] } });
    return route.abort();
  });
}

const scanned = (page: Page, value: string) => page.evaluate((v) => ((window as unknown as { __barcode: string }).__barcode = v), value);

async function openAdd(page: Page) {
  await page.goto("/app/library");
  await workLocally(page);
  await page.getByRole("button", { name: /^Add with details/ }).click();
  return page.getByRole("dialog");
}

test("on the phone, a scanned ISBN fills the Add dialog's search and finds the work; another barcode is reported", async ({ page, isMobile }) => {
  test.skip(!isMobile, "scanning is the phone's");
  await fakeCamera(page);
  const dialog = await openAdd(page);
  await dialog.getByRole("button", { name: "Scan barcode" }).click();
  await expect(dialog.getByLabel("Camera")).toBeVisible();

  await scanned(page, "5012345678900");
  await expect(dialog.getByText("5012345678900 is not an ISBN")).toBeVisible();
  await expect(dialog.getByLabel("Title")).toHaveValue("");

  await scanned(page, "9780441172719");
  await expect(dialog.getByLabel("Title")).toHaveValue("9780441172719");
  await expect(dialog.getByLabel("Camera")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Dune/ })).toBeVisible();
});

test("the desk is not offered a scan, even with a camera", async ({ page, isMobile }) => {
  test.skip(isMobile, "the desk's case");
  await fakeCamera(page);
  const dialog = await openAdd(page);
  await expect(dialog.getByLabel("Title")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Scan barcode" })).toHaveCount(0);
});

test("a phone whose browser cannot read barcodes is not offered a scan", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone's case");
  await fakeCamera(page);
  await page.addInitScript(() => delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector);
  const dialog = await openAdd(page);
  await expect(dialog.getByLabel("Title")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Scan barcode" })).toHaveCount(0);
});
