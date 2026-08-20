import { useNavigate } from "react-router";
import { displayTitle, docHref, documentType, formatHuman, useLinkIndex, type CardProps } from "@lifeline/core";
import { tagSnippet } from "../domain/search";
import { DAILY } from "../domain/types";

/** Card: notes carrying one tag, with the text around the tag (knobs: tag, count). */
export function TagCard({ settings }: CardProps) {
  const tag = String(settings.tag ?? "");
  const count = Number(settings.count ?? 12);
  const index = useLinkIndex();
  const navigate = useNavigate();
  const list = (index.tags.get(tag) ?? [])
    .map((id) => index.byId.get(id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, count);
  if (!tag) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Choose a tag.</div>;
  if (list.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing tagged #{tag} yet.</div>;
  return (
    <ul className="grid h-full content-start gap-1 overflow-y-auto">
      {list.map((n) => {
        const I = documentType(n.type)?.icon;
        return (
          <li key={n.id}>
            <button className="hover:bg-accent flex w-full flex-col gap-0.5 rounded-md px-1 py-0.5 text-left" onClick={() => navigate(docHref(n))}>
              <span className="flex items-center gap-2 text-sm">
                {I && <I className="text-muted-foreground size-3.5 shrink-0" />}
                <span className="truncate">{n.type === DAILY ? formatHuman(n.title) : displayTitle(n)}</span>
              </span>
              <span className="text-muted-foreground line-clamp-2 text-xs">{tagSnippet(typeof n.body === "string" ? n.body : "", tag)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const tagTitle = (settings: CardProps["settings"]) => (settings.tag ? `#${String(settings.tag)}` : "Tag");
