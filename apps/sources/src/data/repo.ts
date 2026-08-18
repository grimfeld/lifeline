import { db, newId, normalizeTags, put, remove, todayStr, useLiveQuery } from "@lifeline/core";
import { SOURCES, type Embed, type Source } from "../domain/types";
import { normalizeEmbedUrl } from "../domain/url";

function normalize(s: Source): Source {
  return { ...s, tags: s.tags ?? [], refreshMinutes: s.refreshMinutes || null };
}

export function useSources(): Source[] {
  return useLiveQuery(
    async () => (await db().collection<Source>(SOURCES).where("deleted").equals(0).toArray()).map(normalize),
    [],
    [] as Source[],
  );
}

export function useEmbeds(): Embed[] {
  return useSources().filter((s): s is Embed => s.kind === "embed");
}

export function useEmbed(id: string | undefined): Embed | undefined {
  return useEmbeds().find((e) => e.id === id);
}

export interface EmbedInput {
  name: string;
  url: string;
  tags?: string[];
  refreshMinutes?: number | null;
}

function scrub(input: EmbedInput): Pick<Embed, "name" | "url" | "tags" | "refreshMinutes"> {
  const url = normalizeEmbedUrl(input.url);
  if (!url) throw new Error("Not a valid http(s) URL");
  const r = input.refreshMinutes;
  return {
    name: input.name.trim(),
    url,
    tags: normalizeTags(input.tags ?? []),
    refreshMinutes: typeof r === "number" && Number.isFinite(r) && r > 0 ? Math.round(r) : null,
  };
}

export async function addEmbed(input: EmbedInput): Promise<string> {
  const id = newId();
  await put<Embed>(SOURCES, { id, kind: "embed", ...scrub(input), createdAt: todayStr() });
  return id;
}

export async function updateEmbed(embed: Embed, input: EmbedInput): Promise<void> {
  await put<Embed>(SOURCES, { ...embed, ...scrub(input) });
}

export async function deleteSource(id: string): Promise<void> {
  await remove(SOURCES, id);
}
