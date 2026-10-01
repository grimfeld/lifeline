import { useLocation, useNavigate } from "react-router";
import { documentTypeSync, openDocument, useBacklinkRows, useLinkIndex } from "@lifeline/core";
import { TASK } from "@lifeline/app-tasks";

/**
 * A Project's material (ADR 0060): whatever links to it — Notes, Clippings,
 * Receipts, Events — gathered by type. Never a list the Project keeps, never
 * a Folder. Its own Tasks are left out: they are the work, shown above.
 */
export function Material({ projectId }: { projectId: string }) {
  const rows = useBacklinkRows(projectId).filter((r) => r.type !== TASK);
  const idx = useLinkIndex();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">Nothing links here yet. Write <code>[[</code>its name<code>]]</code> in a note, a clipping, anything — it gathers here.</p>;

  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.type, [...(groups.get(r.type) ?? []), r]);
  return (
    <div className="flex flex-col gap-3">
      {[...groups].map(([type, list]) => (
        <div key={type} className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">{documentTypeSync(type)?.label ?? type}</span>
          <ul className="flex flex-col">
            {list.map((r) => (
              <li key={`${r.sourceId}/${r.field ?? ""}`}>
                <button
                  className="hover:bg-accent/40 w-full truncate rounded px-2 py-1 text-left text-sm"
                  onClick={() => {
                    const doc = idx.byId.get(r.sourceId);
                    if (doc) openDocument(doc, { pathname, navigate });
                  }}
                  title={r.context || undefined}
                >
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
