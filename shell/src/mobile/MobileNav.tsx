import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import {
  BAR_PINNED,
  appsOfModule,
  useAllCommands,
  useBarSlots,
  useIsMobile,
  useKeyboardInset,
  setPhoneNavHeight,
  useWorkspaceModules,
  type CommandDef,
} from "@lifeline/core";
import { Plus } from "lucide-react";
import { SURFACE_ICONS, slotIcon } from "../navIcons";

type DialogCommand = CommandDef & { appId: string };

/** One bottom-bar slot; shared by both bars and by the Vault's tab buttons. */
function slot(active: boolean) {
  return cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px]", active ? "text-foreground" : "text-muted-foreground");
}

/**
 * The **Phone bar** (ADR 0053): `Calendar · Schedule · ✛ · [slot] · [slot]`.
 *
 * The two views of time are pinned on the left because they are what a phone
 * is taken out of a pocket for, and neither belongs to a Module — so under
 * ADR 0049's derivation, the one composition rule it allowed, they could never
 * win a slot at all. Capture is pinned in the centre because the other cells
 * are places to go and this one is a thing to do.
 *
 * The two on the right are the user's, arranged in Settings and stored on the
 * Workspace, so switching Workspace still reconfigures the phone — by an
 * arrangement rather than by which shelves the Workspace happens to hold. A
 * slot whose destination is gone renders empty rather than being refilled, so
 * the pinned three never move under the thumb.
 *
 * `☰` is not here any more; it opens the drawer from the header (PhoneHeader).
 *
 * Rendered below `md` only.
 */
export function MobileNav() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogCommand | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const nav = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  // iOS never shrinks the layout viewport for the keyboard, so the frame — and
  // this nav at the foot of it — runs on underneath the keys. The nav reserves
  // that strip itself and ends above them, which Chromium's viewport resize
  // gives for free (ADR 0021 amendment); there this reads 0, as it should.
  const inset = useKeyboardInset(isMobile);

  const modules = useWorkspaceModules();
  const slots = useBarSlots();
  const ActiveDialogComponent = activeDialog?.dialog;

  /**
   * The capture sheet lists this Workspace's Modules' Commands and no others
   * (ADR 0047). A list of Commands is chrome, so gating it needs no new
   * principle — and ungated it both buries the ones you want among twenty-three
   * and, in a separated Workspace, offers to strand a Clipping where there is
   * no Clippings screen to find it again. The palette stays open: it is the
   * escape hatch, and always was.
   */
  const captureApps = new Set(modules.flatMap((m) => appsOfModule(m).map((a) => a.id)));
  const captures = useAllCommands().filter((c) => c.capture && (modules.length === 0 || captureApps.has(c.appId)));

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

  function pickCapture(c: DialogCommand) {
    setCaptureOpen(false);
    if (c.dialog) setActiveDialog(c);
    else void c.run?.({ navigate });
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

        <button className={slot(false)} onClick={() => setCaptureOpen(true)}>
          <Plus className="size-5" /> Capture
        </button>

        {slots.map((s, i) => {
          if (!s) {
            // Empty rather than closed up: the cell holds its place so the three
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
        })}
      </nav>

      {/* "✛" capture sheet: the Apps' capture commands, straight to their dialogs. */}
      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetTitle>Capture</SheetTitle>
          <div className="grid grid-cols-2 gap-2 p-4">
            {captures.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={`${c.appId}/${c.id}`}
                  className="border-input hover:bg-accent flex items-center gap-3 rounded-lg border p-3 text-left text-sm"
                  onClick={() => pickCapture(c)}
                >
                  {Icon && <Icon className="size-5 shrink-0" />} {c.title}
                </button>
              );
            })}
            {captures.length === 0 && <p className="text-muted-foreground col-span-2 text-sm">No capture commands registered.</p>}
          </div>
        </SheetContent>
      </Sheet>

      {ActiveDialogComponent && <ActiveDialogComponent open onOpenChange={(o) => !o && setActiveDialog(null)} />}
    </>
  );
}
