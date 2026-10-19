import { addFeed, addLiveValue } from "@lifeline/app-sources/src/data/repo";
import { primeSourceCache } from "@lifeline/app-sources/src/data/cache";
import { PLACES, type LifeClock } from "../persona";

/**
 * Windows (the `sources` App): things from outside shown inside. The Demo has
 * no fetch proxy (ADR 0077), so each Window carries the body a fetch would
 * have brought, dated around the visit. The sites are made up (`.example`).
 */
export async function seedWindows(c: LifeClock): Promise<void> {
  // Once a day: a refresh can only fail here, and the primed body stays fresh till then.
  const daily = 24 * 60;

  const feed = await addFeed({
    name: "Notes from the Treatment Room",
    url: "https://treatmentroom.example/feed.xml",
    tags: ["work"],
    refreshMinutes: daily,
  });
  const posts: [number, string, string][] = [
    [-1, "Load, not rest: getting tendons back to work", "Why the old advice to rest a sore Achilles tendon keeps people sore for longer."],
    [-3, "Five minutes of hip mobility for desk days", "A short routine to break up a long day at the desk."],
    [-6, "What the research says about cold-water swimming", "Less than the headlines claim, and a little more than the sceptics allow."],
    [-10, "Returning to running after a calf strain", "A walk–run plan, and the signs it is time to slow down."],
    [-15, "Sleep is part of the training plan", "Rehab goes faster when people sleep well, so ask about it."],
  ];
  const items = posts
    .map(
      ([offset, title, summary], i) => `    <item>
      <title>${title}</title>
      <link>https://treatmentroom.example/posts/${i + 1}</link>
      <guid>https://treatmentroom.example/posts/${i + 1}</guid>
      <pubDate>${new Date(`${c.day(offset)}T08:00:00`).toUTCString()}</pubDate>
      <description>${summary}</description>
    </item>`,
    )
    .join("\n");
  await primeSourceCache(feed, {
    contentType: "application/rss+xml",
    body: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Notes from the Treatment Room</title>
    <link>https://treatmentroom.example</link>
    <description>A physiotherapy blog</description>
${items}
  </channel>
</rss>`,
  });

  const sea = await addLiveValue({
    name: `Sea temperature at ${PLACES.myrtleville.name}`,
    url: "https://seatemp.example/ie/myrtleville.json",
    refreshMinutes: daily,
    mode: "json",
    path: "water.temperature",
    unit: "°C",
    decimals: 1,
  });
  await primeSourceCache(sea, {
    contentType: "application/json",
    body: JSON.stringify({ station: "Myrtleville", water: { temperature: 13.4 }, measured: `${c.today}T07:00:00Z` }),
  });
}
