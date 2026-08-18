import type { WorkHit } from "./openlibrary";

/**
 * MusicBrainz release-group search — the lookup source for albums. Free and
 * keyless; identifies itself per their policy and stays under 1 req/s (the
 * caller debounces). Cover art via the Cover Art Archive front image URL
 * (may 404 for obscure releases; the <img> just falls back).
 */
const UA = "Lifeline personal dashboard/0.1 (github.com/grimfeld/lifeline)";

interface RG {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "artist-credit"?: { name: string }[];
}

export async function searchMusicBrainz(q: string, signal?: AbortSignal): Promise<WorkHit[]> {
  const url = new URL("https://musicbrainz.org/ws/2/release-group/");
  url.searchParams.set("query", `releasegroup:"${q.replace(/"/g, "")}" AND (primarytype:album OR primarytype:ep)`);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "8");
  const res = await fetch(url, { signal, headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
  const data = (await res.json()) as { "release-groups": RG[] };
  return data["release-groups"].map((r) => ({
    externalKey: `musicbrainz:release-group/${r.id}`,
    title: r.title,
    creator: (r["artist-credit"] ?? []).map((a) => a.name).join(", "),
    year: Number((r["first-release-date"] ?? "").slice(0, 4)) || 0,
    size: 0,
    coverUrl: `https://coverartarchive.org/release-group/${r.id}/front-250`,
  }));
}
