/** RSS 2.0 / Atom / RSS 1.0 parsing with DOMParser — titles, links, dates. */
export interface FeedItem {
  id: string;
  title: string;
  link: string | null;
  /** ISO instant, or null when the feed gives none. */
  published: string | null;
  summary?: string;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim();
}

function firstChild(parent: Element, ...names: string[]): Element | null {
  for (const n of names) {
    for (const c of Array.from(parent.children)) {
      if (c.localName === n || c.nodeName === n) return c;
    }
  }
  return null;
}

function toIso(s: string): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseFeed(xml: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not a valid feed (XML parse error)");
  const root = doc.documentElement;
  const items: FeedItem[] = [];

  if (root.localName === "feed") {
    // Atom
    const title = text(firstChild(root, "title"));
    for (const e of Array.from(root.getElementsByTagName("entry"))) {
      const links = Array.from(e.getElementsByTagName("link"));
      const alt = links.find((l) => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate") ?? links[0];
      const id = text(firstChild(e, "id")) || alt?.getAttribute("href") || text(firstChild(e, "title"));
      items.push({
        id,
        title: text(firstChild(e, "title")) || "(untitled)",
        link: alt?.getAttribute("href") ?? null,
        published: toIso(text(firstChild(e, "published", "updated"))),
        summary: stripHtml(text(firstChild(e, "summary", "content"))).slice(0, 300) || undefined,
      });
    }
    return { title, items };
  }

  // RSS 2.0 (<rss><channel><item>) or RSS 1.0 (<rdf:RDF><item>)
  const channel = root.getElementsByTagName("channel")[0] ?? root;
  const title = text(firstChild(channel, "title"));
  for (const it of Array.from(root.getElementsByTagName("item"))) {
    const link = text(firstChild(it, "link")) || null;
    const guid = text(firstChild(it, "guid"));
    items.push({
      id: guid || link || text(firstChild(it, "title")),
      title: text(firstChild(it, "title")) || "(untitled)",
      link,
      published: toIso(text(firstChild(it, "pubDate", "date", "dc:date"))),
      summary: stripHtml(text(firstChild(it, "description", "encoded", "content:encoded"))).slice(0, 300) || undefined,
    });
  }
  return { title, items };
}

/** Newest first; undated items keep feed order after dated ones. */
export function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      if (a.it.published && b.it.published) return b.it.published.localeCompare(a.it.published);
      if (a.it.published) return -1;
      if (b.it.published) return 1;
      return a.i - b.i;
    })
    .map((x) => x.it);
}

export function isNewItem(item: FeedItem, seenUpTo: string | null | undefined): boolean {
  return !!item.published && (!seenUpTo || item.published > seenUpTo);
}

/**
 * "Seen up to" after the list has been shown: now, or the newest item when a
 * feed dates one in the future — otherwise that item stays new forever and
 * every look marks the feed seen again.
 */
export function seenUpToFor(items: FeedItem[], now: string = new Date().toISOString()): string {
  return items.reduce((max, it) => (it.published && it.published > max ? it.published : max), now);
}
