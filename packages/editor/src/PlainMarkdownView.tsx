import { useMemo, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@lifeline/ui";
import "./editor.css";

/**
 * Markdown that is no Document's body — the Guide's pages: the reading view's
 * look, without wikilinks, Daylog blocks or attachments. `onLink` takes a link
 * first and returns true when it handled it; any other link opens in a new tab.
 */
export function PlainMarkdownView({ body, onLink, className }: { body: string; onLink?: (href: string) => boolean; className?: string }) {
  // Read through a ref so the component map never changes (see MarkdownView).
  const live = useRef(onLink);
  live.current = onLink;
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (href && live.current?.(href)) e.preventDefault();
          }}
        >
          {children}
        </a>
      ),
    }),
    [],
  );
  return (
    <div className={cn("prose-note", className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

const REMARK_PLUGINS = [remarkGfm];
