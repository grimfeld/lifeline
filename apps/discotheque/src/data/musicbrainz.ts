/** A lookup candidate (the shape the old Open Library module defined). */
export interface WorkHit {
  externalKey: string;
  title: string;
  creator: string;
  year: number;
  size: number;
  coverUrl: string;
  /** Lazy "on pick" enrichment: one more request, merged into the hit before it is applied. */
  resolve?: () => Promise<Partial<WorkHit>>;
}

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
  // MusicBrainz ranks by text score, so tributes tie with the original; among equal titles prefer the earliest release.
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const wanted = norm(q);
  const groups = [...data["release-groups"]].sort((a, b) => {
    const ea = norm(a.title) === wanted ? 0 : 1;
    const eb = norm(b.title) === wanted ? 0 : 1;
    if (ea !== eb) return ea - eb;
    return (a["first-release-date"] || "9999").localeCompare(b["first-release-date"] || "9999");
  });
  return groups.map((r) => ({
    externalKey: `musicbrainz:release-group/${r.id}`,
    title: r.title,
    creator: (r["artist-credit"] ?? []).map((a) => a.name).join(", "),
    year: Number((r["first-release-date"] ?? "").slice(0, 4)) || 0,
    size: 0,
    coverUrl: `https://coverartarchive.org/release-group/${r.id}/front-250`,
  }));
}
