import { useMemo } from "react";
import { patchDocument, type Document, type LinkIndex } from "@lifeline/core";
import { Button, toast } from "@lifeline/ui";
import { Link2 } from "lucide-react";
import { canonical, linkRefs, scanRefs } from "../domain/refs";

/**
 * The unlinked references of the open Document (ADR 0032): bare "Rom 8:28"
 * found in the body, offered as links — never linked silently. Nothing to
 * say → renders nothing.
 */
export function ReferencesPanel({ doc }: { doc: Document; index: LinkIndex }) {
  const body = typeof doc.body === "string" ? doc.body : "";
  const found = useMemo(() => scanRefs(body), [body]);
  if (found.length === 0) return null;

  async function link(which: typeof found) {
    await patchDocument(doc.id, { body: linkRefs(body, which) });
    toast.success(which.length === 1 ? `Linked ${canonical(which[0].ref)}` : `Linked ${which.length} references`);
  }

  return (
    <section className="text-sm">
      <h3 className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
        <Link2 className="size-3" /> Unlinked references · {found.length}
      </h3>
      <ul className="grid gap-1">
        {found.map((f, i) => (
          <li key={`${f.from}-${i}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs">
              {f.text} {canonical(f.ref) !== f.text.trim() && <span className="text-muted-foreground">→ {canonical(f.ref)}</span>}
            </span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => void link([f])}>
              Link
            </Button>
          </li>
        ))}
      </ul>
      {found.length > 1 && (
        <Button size="sm" variant="outline" className="mt-1.5 h-6 w-full text-xs" onClick={() => void link(found)}>
          Link all
        </Button>
      )}
    </section>
  );
}
