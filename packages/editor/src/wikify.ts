import { isImageName } from "@lifeline/core";

/**
 * `[[Name|alias]]` → a `wikilink:` link; `![[image.png]]` → an `attachment:` image (ADR 0037).
 * A name, heading and alias hold no `[`, so a long run of `[[` is read once, not once per bracket.
 */
export function wikify(text: string): string {
  return text.replace(/(!?)\[\[([^[\]\n|#]+)(?:#([^[\]\n|]+))?(?:\|([^[\]\n]+))?\]\]/g, (_m, embed: string, name: string, _heading: string | undefined, alias: string | undefined) => {
    const label = (alias ?? name).trim().replace(/[\\\]]/g, "\\$&");
    if (embed && isImageName(name)) return `![${label}](attachment:${encodeURIComponent(name.trim())})`;
    return `[${label}](wikilink:${encodeURIComponent(name.trim())})`;
  });
}
