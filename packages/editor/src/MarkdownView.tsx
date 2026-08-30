import { useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router";
import { cn } from "@lifeline/ui";
import { docHref, extractBlocks, isImageName, openPrivateDialog, splitFrontmatter, type LinkIndex } from "@lifeline/core";
import { DaylogBlock } from "./DaylogBlock";
import { AttachmentImage } from "./AttachmentImage";
import "./editor.css";

/**
 * Reading mode: renders a Document's markdown with wikilinks resolved through
 * the link index (Document → its route, unresolved → dimmed) and `daylog`
 * fences rendered live. A leading frontmatter block is not shown.
 */
export function MarkdownView({ body, index, docDate, className, compact }: { body: string; index: LinkIndex; docDate?: string | null; className?: string; compact?: boolean }) {
  const navigate = useNavigate();
  const { content } = useMemo(() => splitFrontmatter(body), [body]);
  // Turn [[Name|alias]] into markdown links with a wikilink: scheme so ReactMarkdown keeps them as <a>.
  const prepared = useMemo(() => {
    const blocks = extractBlocks(content);
    let out = "";
    let pos = 0;
    for (const b of blocks) {
      out += wikify(content.slice(pos, b.from));
      out += content.slice(b.from, b.to);
      pos = b.to;
    }
    out += wikify(content.slice(pos));
    return out;
  }, [content]);

  return (
    <div className={cn("prose-note", compact && "prose-note-compact", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // The default transform blanks every scheme it does not know — our own two included.
        urlTransform={(url) => (url.startsWith("wikilink:") || url.startsWith("attachment:") ? url : defaultUrlTransform(url))}
        components={{
          img: ({ src, alt }) => {
            const s = typeof src === "string" ? src : "";
            if (s.startsWith("attachment:")) return <AttachmentImage name={decodeURIComponent(s.slice("attachment:".length))} />;
            return <img src={s} alt={alt} />;
          },
          a: ({ href, children }) => {
            if (href?.startsWith("wikilink:")) {
              const name = decodeURIComponent(href.slice("wikilink:".length));
              const ref = index.resolve(name);
              const cls = ref.kind === "unresolved" ? "wikilink wikilink-unresolved" : ref.kind === "locked" ? "wikilink wikilink-locked" : "wikilink";
              return (
                <a
                  href="#"
                  className={cls}
                  title={ref.kind === "locked" ? "In Private — unlock to open" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    if (ref.kind === "doc") {
                      const d = index.byId.get(ref.id);
                      if (d) navigate(docHref(d));
                    } else if (ref.kind === "locked") openPrivateDialog("unlock");
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          code: ({ className: cls, children, ...rest }) => {
            const lang = /language-(\w+)/.exec(cls ?? "")?.[1];
            if (lang === "daylog") {
              const opts = parseOpts(String(children));
              return <DaylogBlock date={opts.date || docDate || new Date().toISOString().slice(0, 10)} apps={opts.apps ? opts.apps.split(/[\s,]+/).filter(Boolean) : undefined} compact />;
            }
            return (
              <code className={cls} {...rest}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}

/** `[[Name|alias]]` → a `wikilink:` link; `![[image.png]]` → an `attachment:` image (ADR 0037). */
function wikify(text: string): string {
  return text.replace(/(!?)\[\[([^\]\n|#]+)(?:#([^\]\n|]+))?(?:\|([^\]\n]+))?\]\]/g, (_m, embed: string, name: string, _heading: string | undefined, alias: string | undefined) => {
    const label = (alias ?? name).trim().replace(/\]/g, "\\]");
    if (embed && isImageName(name)) return `![${label}](attachment:${encodeURIComponent(name.trim())})`;
    return `[${label}](wikilink:${encodeURIComponent(name.trim())})`;
  });
}

function parseOpts(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = /^\s*([A-Za-z_-]+)\s*:\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
