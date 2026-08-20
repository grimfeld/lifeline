import { createDocument, putDocument, useDocuments, type DateStr } from "@lifeline/core";
import { CLIPPING, type Clipping } from "./types";

export function useClippings(): Clipping[] {
  return useDocuments<Clipping>(CLIPPING);
}

/** Record a Clipping: the text I pasted, plus where it came from. Title defaults to the source's host or the first words. */
export async function clip(input: { title?: string; source?: string; author?: string; publishedAt?: DateStr; text: string; tags?: string[] }): Promise<Clipping> {
  const text = input.text.replace(/\s+$/, "");
  const firstLine = text.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").trim() ?? "";
  const title = input.title?.trim() || firstLine.slice(0, 80) || `Clipping ${new Date().toLocaleString()}`;
  const fields = { source: input.source?.trim() ?? "", author: input.author?.trim() ?? "", publishedAt: input.publishedAt ?? "", capturedAt: new Date().toISOString(), tags: input.tags ?? [] };
  try {
    return (await createDocument({ type: CLIPPING, title, body: text + "\n", fields })) as Clipping;
  } catch {
    // Titles are unique per folder: a second clipping of the same headline gets a time suffix rather than an error.
    const d = new Date();
    const stamp = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return (await createDocument({ type: CLIPPING, title: `${title} (${stamp})`, body: text + "\n", fields })) as Clipping;
  }
}

export async function updateClipping(c: Clipping): Promise<void> {
  await putDocument<Clipping>(c);
}
