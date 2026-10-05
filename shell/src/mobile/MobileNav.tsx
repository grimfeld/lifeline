import { Fragment, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import {
  BAR_LEFT_SLOT,
  BAR_PINNED,
  useBarSlots,
  useCaptureSheet,
  useIsMobile,
  useKeyboardInset,
  setPhoneNavHeight,
  type CaptureCommand,
  type CaptureEntry,
} from "@lifeline/core";
import { ChevronLeft, Plus } from "lucide-react";
import { SURFACE_ICONS, slotIcon } from "../navIcons";
import { CaptureCell, SectionHeading, foldMembers, useTogglePin } from "../capture/captureParts";

type FoldEntry = Extract<CaptureEntry, { kind: "fold" }>;

/** One bottom-bar slot; shared by both bars and by the Vault's tab buttons. */
function slot(active: boolean) {
  return cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px]", active ? "text-foreground" : "text-muted-foreground");
}

/**
 * The **Phone bar** (ADR 0053, ADR 0063): `Calendar · [slot] · ✛ · [slot] · [slot]`.
 *
 * The Calendar is pinned at the far left because time is what a phone is
 * taken out of a pocket for, and it belongs to no Module — so under ADR
 * 0049's derivation, the one composition rule it allowed, it could never win a
 * slot at all. Capture is pinned in the centre because the other cells are
 * places to go and this one is a thing to do.
 *
 * The other three are the user's, arranged in Settings and stored on the
 * Workspace, so switching Workspace still reconfigures the phone — by an
 * arrangement rather than by which shelves the Workspace happens to hold. A
 * slot whose destination is gone renders empty rather than being refilled, so
 * the pinned two never move under the thumb.
 *
 * `☰` is not here any more; it opens the drawer from the header (PhoneHeader).
 *
 * Rendered below `md` only.
 */
export function MobileNav() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<CaptureCommand | null>(null);
  // The fold whose members the sheet is showing in place of the groups.
  const [openFold, setOpenFold] = useState<FoldEntry | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const nav = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  // iOS never shrinks the layout viewport for the keyboard, so the frame — and
  // this nav at the foot of it — runs on underneath the keys. The nav reserves
  // that strip itself and ends above them, which Chromium's viewport resize
  // gives for free (ADR 0021 amendment); there this reads 0, as it should.
  const inset = useKeyboardInset(isMobile);

  const slots = useBarSlots();
  const ActiveDialogComponent = activeDialog?.dialog;

  /**
   * The capture sheet (CONTEXT.md "Capture sheet"): this Workspace's Modules'
   * capture Commands and no others (ADR 0047), the user's pins on top, the
   * rest grouped under their Modules — folds standing in for the Commands
   * folded under them. The palette stays open: it is the escape hatch.
   */
  const sheet = useCaptureSheet();
  const pinnedKeys = new Set(sheet.pinned.map((e) => e.key));
  const togglePin = useTogglePin();

  // Whatever the nav actually measures — its safe-area padding included, and 0
  // once `md:hidden` takes it out — is what the editor's accessory bar stacks on
  // top of. Observed rather than assumed: the padding comes and goes with the
  // keyboard, and a guessed number would put the bar over the nav again.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPhoneNavHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    setPhoneNavHeight(el.getBoundingClientRect().height);
    return () => {
      ro.disconnect();
      setPhoneNavHeight(0);
    };
  }, []);

  function setSheetOpen(open: boolean) {
    setCaptureOpen(open);
    if (!open) setOpenFold(null);
  }

  function pick(entry: CaptureEntry) {
    if (entry.kind === "fold") {
      setOpenFold(entry);
      return;
    }
    const c = entry.command;
    setSheetOpen(false);
    if (c.dialog) setActiveDialog(c);
    else void c.run?.({ navigate });
  }

  function cell(entry: CaptureEntry, label?: string) {
    return (
      <CaptureCell
        key={entry.key}
        entry={entry}
        label={label}
        pinned={pinnedKeys.has(entry.key)}
        onPick={() => pick(entry)}
        onTogglePin={() => void togglePin(entry)}
      />
    );
  }

  function slotCell(s: (typeof slots)[number], i: number) {
    if (!s) {
      // Empty rather than closed up: the cell holds its place so the two
      // pinned ones never shift, and says what it is for (ADR 0053).
      return (
        <button
          key={`empty-${i}`}
          className={cn(slot(false), "opacity-40")}
          title="Choose what this slot opens"
          onClick={() => navigate("/settings")}
        >
          <Plus className="size-5" /> Set
        </button>
      );
    }
    const Icon = s.icon ?? slotIcon(s.slot.kind, s.slot.id);
    return (
      <button key={`${s.slot.kind}:${s.slot.id}`} className={slot(location.pathname === s.path)} onClick={() => navigate(s.path)}>
        <Icon className="size-5" /> <span className="max-w-full truncate px-0.5">{s.title}</span>
      </button>
    );
  }

  return (
    <>
      <nav
        ref={nav}
        className="bg-background flex shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        // The margin is the keyboard's strip, taken out of the frame so the nav
        // ends above it; with the keyboard up the home indicator is behind it,
        // so its safe-area padding would only be dead height.
        style={inset > 0 ? { marginBottom: inset, paddingBottom: 0 } : undefined}
      >
        {BAR_PINNED.map((s) => {
          const Icon = SURFACE_ICONS[s.id];
          return (
            <button key={s.id} className={slot(location.pathname === s.path)} onClick={() => navigate(s.path)}>
              <Icon className="size-5" /> {s.title}
            </button>
          );
        })}

        {slotCell(slots[BAR_LEFT_SLOT], BAR_LEFT_SLOT)}

        <button className={slot(false)} onClick={() => setCaptureOpen(true)}>
          <Plus className="size-5" /> Capture
        </button>

        {slots.filter((_, i) => i !== BAR_LEFT_SLOT).map((s, i) => slotCell(s, i))}
      </nav>

      {/* "✛" capture sheet: pins, then groups; a fold opens its members in place. Hold a cell to pin it. */}
      <Sheet open={captureOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[85dvh]">
          {openFold ? (
            <>
              <SheetTitle className="flex items-center gap-1">
                <button className="hover:bg-accent -ml-1 rounded p-1" aria-label="Back" onClick={() => setOpenFold(null)}>
                  <ChevronLeft className="size-5" />
                </button>
                {openFold.title}
              </SheetTitle>
              <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4">
                {foldMembers(openFold).map((m) => cell(m.entry, m.label))}
              </div>
            </>
          ) : (
            <>
              <SheetTitle>Capture</SheetTitle>
              <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 pt-2">
                {sheet.pinned.length > 0 && (
                  <>
                    <SectionHeading className="pt-0">Pinned</SectionHeading>
                    {sheet.pinned.map((e) => cell(e))}
                  </>
                )}
                {sheet.groups.map((g) => (
                  <Fragment key={g.id}>
                    <SectionHeading>{g.title}</SectionHeading>
                    {g.entries.map((e) => cell(e))}
                  </Fragment>
                ))}
                {sheet.groups.length === 0 && <p className="text-muted-foreground col-span-2 text-sm">No capture commands registered.</p>}
                {sheet.pinned.length === 0 && sheet.groups.length > 0 && (
                  <p className="text-muted-foreground col-span-2 px-1 pt-2 text-xs">Hold any of these to pin it on top.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {ActiveDialogComponent && <ActiveDialogComponent open onOpenChange={(o) => !o && setActiveDialog(null)} />}
    </>
  );
}
