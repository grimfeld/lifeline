import { useState } from "react";
import { Button, cn, toast } from "@lifeline/ui";
import { RefreshCw, Search } from "lucide-react";
import type { Work } from "../domain/types";
import { useLookupSettings } from "../data/repo";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "./FindMetadataDialog";

/** "Find metadata" / "Refresh from source" — a work's lookup actions. */
export function LookupActions({ item }: { item: Work }) {
  const settings = useLookupSettings();
  const [finding, setFinding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLookup = lookupFor(item.type, settings) !== null;
  if (!hasLookup) return null;

  async function refresh() {
    setRefreshing(true);
    try {
      const patch = await refreshFromSource(item, settings);
      if (patch === null) toast.warning("No matching source entry found");
      else toast.success(Object.keys(patch).length ? "Refreshed from source" : "Already up to date");
    } catch (e) {
      toast.error((e as Error).message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="ghost" onClick={() => setFinding(true)}>
        <Search className="size-3" /> Find metadata
      </Button>
      {item.externalKey && (
        <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw className={cn("size-3", refreshing && "animate-spin")} /> Refresh from source
        </Button>
      )}
      {finding && <FindMetadataDialog item={item} onClose={() => setFinding(false)} />}
    </div>
  );
}
