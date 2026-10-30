import { useState } from "react";
import { Button, cn, toast } from "@lifeline/ui";
import { RefreshCw, Search } from "lucide-react";
import type { Work } from "../domain/types";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "./FindMetadataDialog";

/** MusicBrainz is keyless — one stable empty-keys object (stable for effect deps). */
const NO_KEYS = {};

/** "Find metadata" / "Refresh from source" — an album's lookup actions. Nothing where its medium has no lookup. */
export function LookupActions({ item }: { item: Work }) {
  const [finding, setFinding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (lookupFor(item.type, NO_KEYS) === null) return null;

  async function refresh() {
    setRefreshing(true);
    try {
      const patch = await refreshFromSource(item, NO_KEYS);
      if (patch === null) toast.warning("No matching source entry found");
      else toast.success(Object.keys(patch).length ? "Refreshed from source" : "Already up to date");
    } catch (e) {
      toast.error((e as Error).message || "Refresh failed");
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
