import { parseReceiptText, type ReceiptDraft, type ShopRef } from "./parse";

/**
 * The receipt reader seam (ADR 0045): an image in, a draft out. Today the
 * reader is Tesseract on the device, loaded lazily on first use (its worker,
 * core and language data come from the network the first time, then live in
 * the browser cache). Replace this one function to switch to a cloud model;
 * nothing else in the App knows which reader produced the draft.
 */
export const OCR_LANGS = "fra+eng";

export interface ReadProgress {
  /** "loading" while the engine and language data arrive, "reading" during recognition. */
  stage: "loading" | "reading";
  /** 0–1 within the stage. */
  progress: number;
}

export async function readReceipt(image: Blob, shops: readonly ShopRef[], onProgress?: (p: ReadProgress) => void): Promise<ReceiptDraft> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(OCR_LANGS, undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (!onProgress) return;
      const reading = m.status === "recognizing text";
      onProgress({ stage: reading ? "reading" : "loading", progress: typeof m.progress === "number" ? m.progress : 0 });
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(image);
    return parseReceiptText(data.text, shops);
  } finally {
    await worker.terminate();
  }
}
