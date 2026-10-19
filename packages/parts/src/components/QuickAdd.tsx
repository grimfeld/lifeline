import { useEffect, useRef, useState, type ReactNode } from "react";
import { openPeek } from "@lifeline/core";
import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import type { LookupHit } from "../lookup";
import { quickAddPlaceholder, startingMedium, type QuickAddMedium } from "../quickAdd";
import { QuickPick } from "./QuickPick";

/** Shared by every family App, so a medium picked in one is offered again wherever that App has it. */
const LAST_MEDIUM_KEY = "media:quick-type";

function readLastMedium(): string | null {
  try {
    return localStorage.getItem(LAST_MEDIUM_KEY);
  } catch {
    return null;
  }
}

function writeLastMedium(m: string) {
  try {
    localStorage.setItem(LAST_MEDIUM_KEY, m);
  } catch {
    /* private mode etc. — remembering the medium is a nicety */
  }
}

/** What a family App tells its QuickAdd. */
export interface QuickAddConfig<M extends string, H extends LookupHit> {
  /** The App's media in the order the switch shows them; with one there is no switch. */
  media: readonly QuickAddMedium<M>[];
  /** How the hint names the creator, when not the medium's `creatorLabel` ("author" for the Library's "Authors"). */
  creatorHint?: string;
  /** The medium's lookup, or null (no key, no provider). A hook: it may read the App's lookup keys. */
  useSearch: (medium: M) => ((query: string, signal: AbortSignal) => Promise<readonly H[]>) | null;
  byline: (hit: H) => string | undefined;
  cover: (hit: H, medium: M) => ReactNode;
  /**
   * Adds the typed text ("Title — Creator") or a picked hit; the new work's id and title, or null when there is no title.
   * A work already on the list is handed back instead, nothing added: `already` says where it stands ("To read, unread").
   */
  add: (medium: M, input: { text: string } | { hit: H }) => Promise<{ id: string; title: string; already?: string } | null>;
  /** The toast's Undo. */
  remove: (id: string) => Promise<void>;
}

export interface QuickAddProps<M extends string> {
  /** The medium to add to (a Card's, a filtered screen's); else the last one added to. */
  defaultType?: M;
  onAdded?: (id: string) => void;
  autoFocus?: boolean;
  /** A Card's one row: the medium as a small select beside the input. */
  compact?: boolean;
}

/**
 * A family App's one-line add (ADR 0006 amendment): "Title — Creator", pick a
 * medium, Enter. The work lands on the medium's To… Shelf; the toast offers
 * Undo. When the medium has a lookup its hits follow the "Add …" row in the
 * QuickPick; the lookup never blocks — Enter adds the raw text unless a hit
 * is highlighted. Configured per App (`QuickAddConfig`).
 */
export function QuickAdd<M extends string, H extends LookupHit>({
  config,
  defaultType,
  onAdded,
  autoFocus,
  compact,
}: QuickAddProps<M> & { config: QuickAddConfig<M, H> }) {
  const { media } = config;
  const [medium, setMediumState] = useState<M>(() => startingMedium(media, defaultType, readLastMedium()));
  const search = config.useSearch(medium);
  const def = media.find((m) => m.id === medium) ?? media[0];

  useEffect(() => {
    if (defaultType) setMediumState(defaultType);
  }, [defaultType]);

  function setMedium(m: M) {
    setMediumState(m);
    writeLastMedium(m);
  }

  // An add awaits the lookup and the store; Enter or a click meanwhile must not add a twin.
  const busy = useRef(false);

  async function add(input: { text: string } | { hit: H }) {
    if (busy.current) return;
    busy.current = true;
    try {
      const added = await config.add(medium, input);
      if (!added) return;
      if (added.already !== undefined) {
        toast.warning(`Already on your list — ${added.already}`, {
          description: added.title,
          action: { label: "Open", onClick: () => openPeek(added.id) },
        });
        return;
      }
      writeLastMedium(medium);
      toast.success(`Added to ${def.wantLabel}`, {
        description: added.title,
        action: { label: "Undo", onClick: () => void config.remove(added.id) },
      });
      onAdded?.(added.id);
    } catch (e) {
      toast.error((e as Error).message || "Could not add it");
    } finally {
      busy.current = false;
    }
  }

  const picker =
    media.length < 2 ? null : compact ? (
      <Select value={medium} onValueChange={(v) => setMedium(v as M)}>
        <SelectTrigger size="sm" className="w-28 shrink-0 text-xs" aria-label="Medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {media.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <ToggleGroup value={medium} onValueChange={(v) => setMedium(v as M)} aria-label="Medium">
        {media.map((m) => (
          <ToggleGroupItem key={m.id} value={m.id}>
            {m.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );

  return (
    <div className={cn("grid", compact ? "gap-1.5" : "gap-2")}>
      <div className={cn("flex items-center gap-2", !compact && "flex-col items-stretch md:flex-row")}>
        <QuickPick<H>
          medium={medium}
          search={search}
          byline={config.byline}
          cover={(h) => config.cover(h, medium)}
          onAdd={(text) => void add({ text })}
          onPick={(hit) => void add({ hit })}
          placeholder={quickAddPlaceholder(def, config.creatorHint)}
          aria-label={`Quick add ${def.label.toLowerCase()}`}
          autoFocus={autoFocus}
          className="min-w-0 flex-1"
        />
        {compact && picker}
      </div>
      {!compact && picker}
    </div>
  );
}
