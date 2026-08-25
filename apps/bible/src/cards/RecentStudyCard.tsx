import { useNavigate } from "react-router";
import { displayTitle, docHref, documentType, formatHuman, matchesTagFilter, settingsTags, singularOf, type CardProps } from "@lifeline/core";
import { useStudy } from "../data/repo";

/** The last few Documents of the study. */
export function RecentStudyCard({ settings }: CardProps) {
  const navigate = useNavigate();
  const tags = settingsTags(settings);
  const docs = useStudy()
    .filter((d) => tags.length === 0 || matchesTagFilter(d.tags, [tags]))
    .slice(0, Number(settings.count ?? 8));
  if (docs.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-sm">Nothing studied yet.</div>;
  return (
    <ul className="grid content-start gap-0.5 overflow-y-auto p-2">
      {docs.map((d) => {
        const def = documentType(d.type);
        return (
          <li key={d.id}>
            <button className="hover:bg-accent flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-sm" onClick={() => navigate(docHref(d, def))}>
              <span className="min-w-0 flex-1 truncate">{displayTitle(d, def)}</span>
              {def && <span className="text-muted-foreground shrink-0 text-[10px] uppercase">{singularOf(def)}</span>}
              <span className="text-muted-foreground shrink-0 text-[10px]">{formatHuman(d.updatedAt.slice(0, 10))}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
