import { useState, type ComponentType } from "react";
import { Link } from "react-router";
import {
  Button,
  Dialog,
  DialogContent,
  PageHeader,
  Separator,
  Tip,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@lifeline/ui";
import {
  BAR_PINNED,
  BAR_SLOT_ORDER,
  CAPTURE_PINS_MAX,
  DATE_VOCABULARIES,
  inhabitedModules,
  isDemo,
  movePin,
  saveCapturePins,
  useCaptureSheet,
  saveBar,
  sameSlot,
  useBarConfig,
  useCurrentWorkspace,
  useKeyBindings,
  useSlotOptions,
  useMacros,
  useWorkspaces,
  type BarSlot,
  type CaptureEntry,
  type SlotOption,
} from "@lifeline/core";
import { ArrowDown, ArrowUp, CalendarDays, Check, ChevronRight, Keyboard, ListOrdered, Lock, Pin, Plus, Smartphone, X } from "lucide-react";
import { entryIcon, foldMembers } from "../capture/captureParts";
import { SURFACE_ICONS, slotIcon } from "../navIcons";
import { WorkspaceDialog, WorkspaceForm } from "../components/WorkspaceDialog";
import { SyncBadge } from "../components/SyncBadge";
import { ResetDemoButton, SourceLink } from "../demo/DemoActions";
import { setDateLanguage, useDateLanguage } from "./dateLanguage";

/**
 * `/settings` (ADR 0053): where the user configures Lifeline itself rather
 * than any of its content.
 *
 * The **sixth** kind of page, and with the Guide one of the two that serve no
 * Documents (ADR 0089) — a Card, a Screen, a Surface, an App screen and a Base
 * all present or process Documents, this one configures the app, and the Guide
 * explains it. It exists because the Phone bar is
 * a phone arrangement edited on the phone, and drag-reordering inside a dialog
 * at 390px is bad. Everything else in Lifeline keeps its configuration at the
 * object it configures; what lands here is what has no object of its own.
 *
 * Workspace management moved in with it: the bar is a field on the `workspaces`
 * record and is seeded from that record's Modules, so editing the Modules in a
 * dialog while editing the bar here would be two front doors on one record,
 * coupled by a rule the user cannot see.
 */
export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 md:p-6">
      <PageHeader title="Settings" />
      {isDemo() ? (
        <DemoSection />
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-medium">Account and sync</h2>
          <div className="max-w-xs">
            <SyncBadge />
          </div>
        </section>
      )}
      <Separator />
      <PhoneBarSection />
      <Separator />
      <CapturePinsSection />
      <Separator />
      <MacrosSection />
      <Separator />
      <DateLanguageSection />
      <Separator />
      <KeysSection />
      <Separator />
      <WorkspacesSection />
    </div>
  );
}

/** In the Demo (ADR 0077), where Account and sync would be: what this device is instead. */
function DemoSection() {
  return (
    <section aria-label="Demo settings" className="flex flex-col gap-2">
      <h2 className="text-base font-medium">Demo</h2>
      <p className="text-muted-foreground text-sm">
        This is the Lifeline Demo, filled with a made-up person's life. Everything you add, change or delete stays in this
        browser: there is no account, nothing syncs, and no one else ever sees it.
      </p>
      {/* Here as well as in the banner, so both stay reachable once it is dismissed. */}
      <div className="flex flex-wrap gap-2">
        <ResetDemoButton />
        <SourceLink />
      </div>
    </section>
  );
}

/** A section whose settings have a page of their own: what it is, and a row that says how many there are and goes there. */
function PageLinkSection({ icon: Icon, title, blurb, to, label }: { icon: ComponentType<{ className?: string }>; title: string; blurb: string; to: string; label: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Icon className="size-4" /> {title}
        </h2>
        <p className="text-muted-foreground text-sm">{blurb}</p>
      </div>
      <Link to={to} className="hover:bg-accent flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight className="size-4 shrink-0" />
      </Link>
    </section>
  );
}

/** Macros (ADR 0092) have a page of their own, `/settings/macros`: a list and an editor of steps. */
function MacrosSection() {
  const count = useMacros().length;
  return (
    <PageLinkSection
      icon={ListOrdered}
      title="Macros"
      blurb="Several Commands run in order as one, from the palette, in every Workspace."
      to="/settings/macros"
      label={count === 0 ? "Make a Macro" : `${count} Macro${count === 1 ? "" : "s"}`}
    />
  );
}

/**
 * Which language a palette `/` word means when English and French disagree
 * (ADR 0091). Per device (ADR 0093, dateLanguage.ts); every language is read either way.
 */
function DateLanguageSection() {
  const lang = useDateLanguage();
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-medium">
          <CalendarDays className="size-4" /> Dates in the palette
        </h2>
        <p className="text-muted-foreground text-sm">
          A <code>/</code> in the palette reads a date in English and in French alike. When a word means different things in each
          (<code>/mar</code>: March or mardi), this language decides. Kept on this device.
        </p>
      </div>
      <ToggleGroup aria-label="Preferred date language" value={lang} onValueChange={setDateLanguage} className="self-start">
        {Object.entries(DATE_VOCABULARIES).map(([code, v]) => (
          <ToggleGroupItem key={code} value={code} aria-label={v.name}>
            {v.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  );
}

// --- the Phone bar ---

function PhoneBarSection() {
  const ws = useCurrentWorkspace();
  const config = useBarConfig();
  const options = useSlotOptions();
  const [picking, setPicking] = useState<number | null>(null);

  async function set(index: number, slot: BarSlot | null) {
    if (!ws) return;
    const next = [...config];
    next[index] = slot;
    await saveBar(ws, next);
    setPicking(null);
  }

  /** One of the user's cells in the preview, by its stored index. */
  function slotCell(i: number | undefined, border: boolean) {
    if (i === undefined) return null;
    const s = config[i];
    const found = s ? options.find((o) => sameSlot(o.slot, s)) : undefined;
    const Icon = s ? (found?.icon ?? slotIcon(s.kind, s.id)) : Plus;
    return (
      <button
        type="button"
        key={i}
        className={cn("hover:bg-accent flex flex-1 flex-col items-center gap-0.5 py-2 text-2xs", border && "border-r", !s && "opacity-40")}
        onClick={() => setPicking(i)}
      >
        <Icon className="size-5" />
        <span className="max-w-full truncate px-0.5">{s ? (s.label?.trim() || found?.title || "Gone") : "Set"}</span>
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Smartphone className="size-4" /> Phone bar
        </h2>
        <p className="text-muted-foreground text-sm">
          The bar at the foot of the phone. Calendar and capture are fixed; the other three are yours. This bar belongs to{" "}
          <strong>{ws?.name ?? "this workspace"}</strong> — each workspace has its own.
        </p>
      </div>

      {/* The bar as it will read, in order, so the arrangement is edited where it is seen. */}
      <div className="bg-background flex overflow-hidden rounded-lg border">
        {BAR_PINNED.map((s) => {
          const Icon = SURFACE_ICONS[s.id];
          return (
            <div key={s.id} className="text-muted-foreground flex flex-1 flex-col items-center gap-0.5 border-r py-2 text-2xs">
              {Icon && <Icon className="size-5" />} {s.title}
              <Lock className="size-2.5 opacity-50" />
            </div>
          );
        })}
        {slotCell(BAR_SLOT_ORDER[0], true)}
        <div className="text-muted-foreground flex flex-1 flex-col items-center gap-0.5 border-r py-2 text-2xs">
          <Plus className="size-5" /> Capture
          <Lock className="size-2.5 opacity-50" />
        </div>
        {slotCell(BAR_SLOT_ORDER[1], true)}
        {slotCell(BAR_SLOT_ORDER[2], false)}
      </div>

      <div className="flex flex-col gap-2">
        {BAR_SLOT_ORDER.map((i, pos) => [config[i] ?? null, i, pos] as const).map(([s, i, pos]) => (
          <SlotRow
            key={i}
            index={pos}
            slot={s}
            option={s ? options.find((o) => sameSlot(o.slot, s)) : undefined}
            onPick={() => setPicking(i)}
            onClear={() => void set(i, null)}
            onLabel={(label) => void set(i, s && { ...s, label })}
          />
        ))}
      </div>

      {picking !== null && (
        <SlotPicker
          current={config[picking] ?? null}
          onClose={() => setPicking(null)}
          onPick={(slot) => void set(picking, slot)}
        />
      )}
    </section>
  );
}

// --- the capture sheet's pins ---

/** Key bindings live on their own page, `/settings/keys`; this is the way there. */
function KeysSection() {
  const count = useKeyBindings().length;
  return (
    <PageLinkSection
      icon={Keyboard}
      title="Keys"
      blurb="Give any Command a key, so it runs on the desk without the palette. The same keys in every Workspace."
      to="/settings/keys"
      label={count === 0 ? "Bind a key" : `${count} key${count === 1 ? "" : "s"} bound`}
    />
  );
}

/**
 * The Workspace's capture pins (CONTEXT.md "Capture sheet"): the handful on
 * top of the sheet and of the empty palette, in this order. Also pinned and
 * unpinned by holding a cell on the sheet itself. Pins that no longer resolve
 * are not shown, and any write here drops them.
 */
function CapturePinsSection() {
  const ws = useCurrentWorkspace();
  const { pinned, groups } = useCaptureSheet();
  const [picking, setPicking] = useState(false);
  const live = pinned.map((e) => e.key);

  async function save(next: string[]) {
    if (ws) await saveCapturePins(ws, next);
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Pin className="size-4" /> Capture pins
        </h2>
        <p className="text-muted-foreground text-sm">
          Up to {CAPTURE_PINS_MAX} capture commands kept on top of the phone's capture sheet and of the empty palette, always in this order. They belong to{" "}
          <strong>{ws?.name ?? "this workspace"}</strong>. On the phone, hold any capture command to pin or unpin it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {pinned.map((e, i) => {
          const Icon = entryIcon(e);
          return (
            <div key={e.key} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
              <Tip label="Move up">
                <Button size="icon-sm" variant="ghost" className="shrink-0" disabled={i === 0} onClick={() => void save(movePin(live, e.key, -1))}>
                  <ArrowUp className="size-3.5" />
                </Button>
              </Tip>
              <Tip label="Move down">
                <Button size="icon-sm" variant="ghost" className="shrink-0" disabled={i === pinned.length - 1} onClick={() => void save(movePin(live, e.key, 1))}>
                  <ArrowDown className="size-3.5" />
                </Button>
              </Tip>
              <Tip label="Unpin">
                <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => void save(live.filter((k) => k !== e.key))}>
                  <X className="size-3.5" />
                </Button>
              </Tip>
            </div>
          );
        })}
        {pinned.length < CAPTURE_PINS_MAX && (
          <button type="button" className="hover:bg-accent/50 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-left text-sm" onClick={() => setPicking(true)}>
            {pinned.length === 0 ? "Nothing pinned yet. Pin a capture command…" : "Pin another…"}
          </button>
        )}
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md" aria-describedby={undefined}>
          <h2 className="text-base font-medium">Pin a capture command</h2>
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g.id} className="flex flex-col gap-0.5">
                <p className="text-muted-foreground px-1 text-xs font-medium">{g.title}</p>
                {g.entries.flatMap((e) => [
                  <PinChoice key={e.key} entry={e} pinned={live.includes(e.key)} onPick={() => void save([...live, e.key]).then(() => setPicking(false))} />,
                  ...(e.kind === "fold"
                    ? foldMembers(e).map((m) => (
                        <PinChoice
                          key={m.entry.key}
                          entry={m.entry}
                          label={m.label}
                          indent
                          pinned={live.includes(m.entry.key)}
                          onPick={() => void save([...live, m.entry.key]).then(() => setPicking(false))}
                        />
                      ))
                    : []),
                ])}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PinChoice({ entry, label, indent, pinned, onPick }: { entry: CaptureEntry; label?: string; indent?: boolean; pinned: boolean; onPick: () => void }) {
  const Icon = entryIcon(entry);
  return (
    <button
      type="button"
      className={cn("hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-50", indent && "ml-6")}
      disabled={pinned}
      onClick={onPick}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label ?? entry.title}</span>
      {pinned && <Check className="size-3.5 shrink-0" />}
    </button>
  );
}

function SlotRow({
  index,
  slot,
  option,
  onPick,
  onClear,
  onLabel,
}: {
  index: number;
  slot: BarSlot | null;
  option: SlotOption | undefined;
  onPick: () => void;
  onClear: () => void;
  onLabel: (label: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!slot) {
    return (
      <button type="button" className="hover:bg-accent/50 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-left text-sm" onClick={onPick}>
        Slot {index + 1} — empty. Choose what it opens…
      </button>
    );
  }
  // A slot whose destination is gone is *shown* gone rather than quietly
  // dropped: the user chose it, and only the user replaces it (ADR 0053).
  const gone = option === undefined;
  const title = option?.title;
  const Icon = option?.icon ?? slotIcon(slot.kind, slot.id);
  const value = draft ?? slot.label ?? "";
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <Icon className="size-4 shrink-0" />
      <button type="button" className="min-w-0 flex-1 text-left text-sm hover:underline" onClick={onPick}>
        {gone ? <span className="text-destructive">No longer there — pick something else</span> : <span className="truncate">{title}</span>}
      </button>
      <input aria-label={`Label for ${title ?? "this item"}`}
        className="border-input w-24 shrink-0 rounded-md border bg-transparent px-2 py-1 text-xs"
        placeholder={gone ? "" : title}
        value={value}
        disabled={gone}
        title="What this slot says on the bar"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== (slot.label ?? "")) onLabel(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <Tip label="Empty this slot">
        <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={onClear}>
          <X className="size-3.5" />
        </Button>
      </Tip>
    </div>
  );
}

function SlotPicker({
  current,
  onClose,
  onPick,
}: {
  current: BarSlot | null;
  onClose: () => void;
  onPick: (slot: BarSlot) => void;
}) {
  const options = useSlotOptions();
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md" aria-describedby={undefined}>
        <h2 className="text-base font-medium">What does this slot open?</h2>
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <p className="text-muted-foreground px-1 text-xs font-medium">{g}</p>
            {options
              .filter((o) => o.group === g)
              .map((o) => {
                const Icon = o.icon ?? slotIcon(o.slot.kind, o.slot.id);
                return (
                  <button
                    type="button"
                    key={`${o.slot.kind}:${o.slot.id}`}
                    className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    // The label is the slot's, so re-pointing a slot keeps the
                    // short name the user typed for it.
                    onClick={() => onPick({ ...o.slot, label: current?.label })}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{o.title}</span>
                    {sameSlot(o.slot, current) && <Check className="ml-auto size-4 shrink-0" />}
                  </button>
                );
              })}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

// --- Workspaces ---

function WorkspacesSection() {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const target = workspaces.find((w) => w.id === editing);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Workspaces</h2>
        <p className="text-muted-foreground text-sm">
          A workspace is a set of Modules. Which Modules it holds decides what its sidebar and Bases list — never what the Schedule,
          the Vault or the palette can reach.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {workspaces.map((w) => (
          <button
            type="button"
            key={w.id}
            className={cn(
              "hover:bg-accent/50 flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
              w.id === current?.id && "bg-accent/40",
            )}
            onClick={() => setEditing(w.id)}
          >
            {w.separated ? <Lock className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
            <span className="font-medium">{w.name}</span>
            <span className="text-muted-foreground ml-auto text-xs">
              {w.modules.length === inhabitedModules().length ? "All modules" : `${w.modules.length} module${w.modules.length === 1 ? "" : "s"}`}
            </span>
          </button>
        ))}
      </div>

      <div>
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus /> New workspace
        </Button>
      </div>

      {target && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-lg">
            <WorkspaceForm workspace={target} onDone={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
      {creating && <WorkspaceDialog open createFirst onOpenChange={(o) => !o && setCreating(false)} />}
    </section>
  );
}
