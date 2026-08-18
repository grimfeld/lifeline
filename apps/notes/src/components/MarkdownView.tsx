import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router";
import { cn } from "@lifeline/ui";
import type { NoteIndex } from "../domain/index";
import { extractBlocks, splitFrontmatter } from "../domain/markdown";
import { DaylogBlock } from "./DaylogBlock";
import { noteHref } from "../workspace/useOpenNote";
import "./notes.css";

/**
 * Reading mode (ADR 0009): renders a note's markdown with wikilinks resolved
 * through the index (note → open it, App entity → its href, unresolved →
 * dimmed) and `daylog` fences rendered live. Frontmatter is not shown.
 */
export function MarkdownView({ body, index, noteDate, className, compact }: { body: string; index: NoteIndex; noteDate?: string | null; className?: string; compact?: boolean }) {
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
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("wikilink:")) {
              const name = decodeURIComponent(href.slice("wikilink:".length));
              const ref = index.resolve(name);
              const cls = ref.kind === "unresolved" ? "wikilink wikilink-unresolved" : ref.kind === "app" ? "wikilink wikilink-app" : "wikilink";
              return (
                <a
                  href="#"
                  className={cls}
                  onClick={(e) => {
                    e.preventDefault();
                    if (ref.kind === "note") {
                      const n = index.byId.get(ref.noteId);
                      if (n) navigate(noteHref(n));
                    } else if (ref.kind === "app" && ref.href) navigate(ref.href);
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
              return <DaylogBlock date={opts.date || noteDate || new Date().toISOString().slice(0, 10)} apps={opts.apps ? opts.apps.split(/[\s,]+/).filter(Boolean) : undefined} compact />;
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

function wikify(text: string): string {
  return text.replace(/(!?)\[\[([^\]\n|#]+)(?:#([^\]\n|]+))?(?:\|([^\]\n]+))?\]\]/g, (_m, _embed, name: string, _heading: string | undefined, alias: string | undefined) => {
    const label = (alias ?? name).trim();
    return `[${label.replace(/\]/g, "\\]")}](wikilink:${encodeURIComponent(name.trim())})`;
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
