import { useEffect, useRef } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Button, Page } from "@lifeline/ui";
import { PlainMarkdownView } from "@lifeline/editor";
import { guideLink, guidePage } from "@lifeline/guide";
import { guideBody } from "@lifeline/guide/pages";
import { ChevronLeft } from "lucide-react";
import { guideHref } from "./guidePlace";

/**
 * `/guide` and `/guide/:page` (ADR 0089): the **Guide**, Lifeline's manual.
 * With Settings, one of the two pages that serve no Documents — Settings
 * configures the app, this explains it. Its pages are Markdown from
 * `@lifeline/guide`; a link to another page's file opens that page here. Loaded
 * on first visit (App.tsx), so the manual stays out of the first load.
 */
export function GuidePage() {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
  const top = useRef<HTMLDivElement>(null);
  const p = guidePage(page);

  // A new page starts at its top.
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [page]);

  if (!p) return <Navigate to="/guide" replace />;

  const onLink = (href: string) => {
    const slug = guideLink(href);
    if (!slug) return false;
    navigate(guideHref(slug));
    return true;
  };

  return (
    <Page>
      <div ref={top} className="scroll-mt-4">
        {p.slug !== "index" && (
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to="/guide">
              <ChevronLeft /> Guide
            </Link>
          </Button>
        )}
      </div>
      <PlainMarkdownView body={guideBody(p.slug) ?? ""} onLink={onLink} />
    </Page>
  );
}
