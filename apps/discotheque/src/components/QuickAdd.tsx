import { useEffect, useState } from "react";
import { QuickPick } from "@lifeline/parts";
import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import { deleteWork, parseQuickTitle, quickAddWork } from "../data/repo";
import { lookupFor, resolveHit } from "../data/lookup";
import type { WorkHit } from "../data/lookup";
import { Cover } from "./Cover";

/** MusicBrainz is keyless — one stable empty-keys object (stable for effect deps). */
const NO_KEYS = {};

const LAST_TYPE_KEY = "media:quick-type";
const isType = (v: unknown): v is WorkTypeId => WORK_TYPES.some((t) => t.id === v);

function readLastType(): WorkTypeId | null {
  try {
    const v = localStorage.getItem(LAST_TYPE_KEY);
    return isType(v) ? v : null;
  } catch {
    return null;
  }
}

function writeLastType(t: WorkTypeId) {
  try {
    localStorage.setItem(LAST_TYPE_KEY, t);
  } catch {
    /* private mode etc. — remembering the medium is a nicety */
  }
}

/**
 * One-line add (ADR 0006 amendment): "Title — Creator", pick a medium, Enter.
 * The item lands on the To… shelf; the toast offers Undo. When the medium has
 * a lookup its hits follow the "Add …" row in the shared QuickPick (a kit
 * Combobox); the lookup never blocks — Enter adds the raw text unless a hit
 * is highlighted.
 */
export function QuickAdd({ defaultType, onAdded, autoFocus, compact }: { defaultType?: WorkTypeId; onAdded?: (id: string) => void; autoFocus?: boolean; compact?: boolean }) {
  const [type, setTypeState] = useState<WorkTypeId>(() => defaultType ?? readLastType() ?? "music");
  const settings = NO_KEYS;
  const def = workType(type);

  useEffect(() => {
    if (defaultType) setTypeState(defaultType);
  }, [defaultType]);

  function setType(t: WorkTypeId) {
    setTypeState(t);
    writeLastType(t);
  }

  async function add(input: { title: string; creator?: string; hit?: WorkHit }) {
    const title = input.title.trim();
    if (!title) return;
    // Lazy enrichment (TMDB director/runtime, RAWG developers) happens only on pick.
    const hit = input.hit ? await resolveHit(input.hit) : undefined;
    const id = await quickAddWork({ medium: type, title, creator: input.creator || hit?.creator, hit });
    writeLastType(type);
    toast.success(`Added to ${def.wantLabel}`, {
      description: title,
      action: {
        label: "Undo",
        onClick: () => void deleteWork(id),
      },
    });
    onAdded?.(id);
  }

  const lookup = lookupFor(type, settings);
  const placeholder = `Add ${/^[aeiou]/i.test(def.label) ? "an" : "a"} ${def.label.toLowerCase()} — ${def.creatorLabel.toLowerCase()}…`;

  const mediumPicker = compact ? (
    <Select value={type} onValueChange={(v) => setType(v as WorkTypeId)}>
      <SelectTrigger size="sm" className="w-28 shrink-0 text-xs" aria-label="Medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORK_TYPES.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Medium">
      {WORK_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={type === t.id}
          className={cn("rounded-full border px-2 py-0.5 text-2xs transition-colors", type === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
          onClick={() => setType(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn("grid gap-1.5", compact ? "" : "gap-2")}>
      <div className={cn("flex items-center gap-2", compact ? "" : "flex-col items-stretch md:flex-row")}>
        <QuickPick<WorkHit>
          medium={type}
          search={lookup}
          byline={(h) => h.creator}
          cover={(h) => <Cover item={{ title: h.title, coverUrl: h.coverUrl, type }} className="h-8 w-6 shrink-0" />}
          onAdd={(t) => void add(parseQuickTitle(t))}
          onPick={(h) => void add({ title: h.title, creator: h.creator, hit: h })}
          placeholder={placeholder}
          aria-label={`Quick add ${def.label.toLowerCase()}`}
          autoFocus={autoFocus}
          className="min-w-0 flex-1"
        />
        {compact && mediumPicker}
      </div>
      {!compact && mediumPicker}
    </div>
  );
}
