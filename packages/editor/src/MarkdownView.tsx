import { useMemo, useRef } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@lifeline/ui";
import { extractBlocks, openPrivateDialog, parseBlockOptions, splitFrontmatter, todayStr, type LinkIndex } from "@lifeline/core";
import { DaylogBlock } from "./DaylogBlock";
import { useOpenDocument } from "./openDocument";
import { AttachmentImage } from "./AttachmentImage";
import { wikify } from "./wikify";
import "./editor.css";

/**
 * Reading mode: renders a Document's markdown with wikilinks resolved through
 * the link index (Document → its route, unresolved → dimmed) and `daylog`
 * fences rendered live. A leading frontmatter block is not shown.
 */
/** `origin` names the Document the body belongs to, so a selection in it can be handed off with that Document as its origin (ADR 0073). */
export function MarkdownView({ body, index, docDate, className, compact, origin }: { body: string; index: LinkIndex; docDate?: string | null; className?: string; compact?: boolean; origin?: string }) {
  const openDoc = useOpenDocument();
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

  // The renderers read the live props through a ref, so the map itself never
  // changes: a fresh map each render gave ReactMarkdown new component types,
  // and every image and daylog in the note remounted (and refetched) on any
  // re-render. Whatever the ref holds is read when they render.
  const live = useRef({ index, openDoc, docDate });
  live.current = { index, openDoc, docDate };
  const components = useMemo<Components>(
    () => ({
      img: ({ src, alt }) => {
        const s = typeof src === "string" ? src : "";
        if (s.startsWith("attachment:")) return <AttachmentImage name={decodeURIComponent(s.slice("attachment:".length))} />;
        return <img src={s} alt={alt} />;
      },
      a: ({ href, children }) => {
        if (href?.startsWith("wikilink:")) {
          const name = decodeURIComponent(href.slice("wikilink:".length));
          const { index, openDoc } = live.current;
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
                  if (d) openDoc(d);
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
          const opts = parseBlockOptions(String(children));
          return <DaylogBlock date={opts.date || live.current.docDate || todayStr()} apps={opts.apps ? opts.apps.split(/[\s,]+/).filter(Boolean) : undefined} compact />;
        }
        return (
          <code className={cls} {...rest}>
            {children}
          </code>
        );
      },
      pre: ({ children }) => <>{children}</>,
    }),
    [],
  );

  return (
    <div className={cn("prose-note", compact && "prose-note-compact", className)} data-origin={origin}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        urlTransform={urlTransform}
        components={components}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}

const REMARK_PLUGINS = [remarkGfm];
/** The default transform blanks every scheme it does not know — our own two included. */
const urlTransform = (url: string) => (url.startsWith("wikilink:") || url.startsWith("attachment:") ? url : defaultUrlTransform(url));
