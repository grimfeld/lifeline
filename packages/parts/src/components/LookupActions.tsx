import { useState, type ReactNode } from "react";
import { Button, cn, toast } from "@lifeline/ui";
import { RefreshCw, Search } from "lucide-react";

/**
 * "Find metadata" / "Refresh from source": a work's lookup actions, for the
 * Work page's actions row (ADR 0006 amendment). Nothing where the work's
 * medium has no lookup. The App hands in whether it has one, its refresh
 * (null: no matching source entry; else the patch it wrote) and its own Find
 * metadata dialog.
 */
export function LookupActions({
  available,
  canRefresh,
  refresh,
  findDialog,
}: {
  /** Whether the work's medium has a lookup at all. */
  available: boolean;
  /** Whether it has a source to refresh from (an external key). */
  canRefresh: boolean;
  refresh: () => Promise<object | null>;
  findDialog: (onClose: () => void) => ReactNode;
}) {
  const [finding, setFinding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (!available) return null;

  async function onRefresh() {
    setRefreshing(true);
    try {
      const patch = await refresh();
      if (patch === null) toast.warning("No matching source entry found");
      else toast.success(Object.keys(patch).length ? "Refreshed from source" : "Already up to date");
    } catch (e) {
      toast.error("Could not refresh from the source", { description: (e as Error).message || undefined });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setFinding(true)}>
        <Search /> Find metadata
      </Button>
      {canRefresh && (
        <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => void onRefresh()}>
          <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh from source
        </Button>
      )}
      {finding && findDialog(() => setFinding(false))}
    </>
  );
}
