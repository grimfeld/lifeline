import { useState } from "react";
import { Button, cn, toast } from "@lifeline/ui";
import { RefreshCw, Search } from "lucide-react";
import type { Work } from "../domain/types";
import { useLookupSettings } from "../data/repo";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "./FindMetadataDialog";

/** "Find metadata" / "Refresh from source" — a work's lookup actions (ADR 0006 amendment). Nothing where its medium has no lookup. */
export function LookupActions({ item }: { item: Work }) {
  const settings = useLookupSettings();
  const [finding, setFinding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (lookupFor(item.type, settings) === null) return null;

  async function refresh() {
    setRefreshing(true);
    try {
      const patch = await refreshFromSource(item, settings);
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
      {item.externalKey && (
        <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh from source
        </Button>
      )}
      {finding && <FindMetadataDialog item={item} onClose={() => setFinding(false)} />}
    </>
  );
}
