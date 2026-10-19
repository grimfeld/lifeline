import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  allDocuments,
  allDocumentTypes,
  allIntakes,
  appById,
  buildLinkIndex,
  buildSelectionMenu,
  documentTypeSync,
  getDocument,
  isLinkable,
  isModShortcut,
  moduleOfPath,
  openPeek,
  patchDocument,
  quickMake,
  rememberIntake,
  removeDocument,
  singularOf,
  useDocument,
  useDocumentTypes,
  useLinkIndex,
  writeLink,
  type Handoff,
  type SelectionEntry,
} from "@lifeline/core";
import { readBodySelection, SELECTION_EVENT, type BodySelection } from "@lifeline/editor";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  PhoneDock,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
  usePhone,
} from "@lifeline/ui";
import { Link2, TextSelect } from "lucide-react";

/** Per-device memory of the Intake last chosen from a selection, beside each App's own (ADR 0050). A convenience only: it never orders the menu. */
const SENDER = "selection";

/** A selection that empties is let go after this long — long enough for the tap that opens the menu to land. */
const LINGER_MS = 400;

type Intake = ReturnType<typeof allIntakes>[number];

/**
 * The **Selection menu** (CONTEXT.md, ADR 0086): selecting text in any
 * Document's body offers to link it to the Document it names, to make a
 * user-defined type's Document from it, or to hand it to an App's Intake,
 * grouped by where each lives. Opened by its trigger or
 * `Ctrl+.`, filtered by typing; the groups and their order are Core's
 * (`buildSelectionMenu`), this only draws them and acts.
 *
 * Linking rewrites the body in place — in an editor as one undoable edit, in a
 * rendered body through the store — and the user stays on the page. An Intake
 * opens its App's dialog prefilled with the Handoff; nothing is written until
 * it saves. A user-defined type's Document is made at once instead (Core's
 * quick make): titled by the selection, linked from it when the type is
 * Linkable, opened in a Peek beside the page, and undone from the toast.
 *
 * On the desk the trigger floats just above the selection; on a phone it sits
 * in the dock (ADR 0064), clear of the system's own selection menu.
 */
export function SelectionMenu() {
  const phone = usePhone();
  const { pathname } = useLocation();
  const [sel, setSel] = useState<BodySelection | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [handing, setHanding] = useState<{ intake: Intake; handoff: Handoff } | null>(null);
  // The last selection seen: opening the menu (or a tap on its trigger) may clear the live one.
  const last = useRef<BodySelection | null>(null);
  const shown = sel ?? (open ? last.current : null);
  const origin = useDocument(shown?.originId);
  const index = useLinkIndex();
  const types = useDocumentTypes();

  useEffect(() => {
    let linger: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readBodySelection();
        clearTimeout(linger);
        if (next) {
          last.current = next;
          setSel(next);
        } else linger = setTimeout(() => setSel(null), LINGER_MS);
      });
    };
    // Ctrl+. opens the menu on the current selection, from the keyboard alone.
    const onKey = (e: KeyboardEvent) => {
      if (!isModShortcut(e, ".")) return;
      const now = readBodySelection();
      if (!now) return;
      e.preventDefault();
      clearTimeout(linger);
      last.current = now;
      setSel(now);
      setQuery("");
      setOpen(true);
    };
    document.addEventListener("selectionchange", read);
    document.addEventListener(SELECTION_EVENT, read);
    window.addEventListener("scroll", read, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("selectionchange", read);
      document.removeEventListener(SELECTION_EVENT, read);
      window.removeEventListener("scroll", read, true);
      window.removeEventListener("keydown", onKey);
      clearTimeout(linger);
      cancelAnimationFrame(frame);
    };
  }, []);

  const storedBody = typeof origin?.body === "string" ? origin.body : "";
  const groups = shown
    ? buildSelectionMenu<Intake>({
        text: shown.text,
        originId: shown.originId,
        body: shown.editor ? shown.editor.body() : storedBody,
        placement: shown.placement,
        index,
        typeLabel: (id) => {
          const def = documentTypeSync(id);
          return def && singularOf(def);
        },
        intakes: allIntakes(),
        userTypes: types
          .filter((t) => !t.builtIn && !t.internal)
          .map((t) => ({ id: t.id, title: singularOf(t), homeModule: t.homeModule, linkable: isLinkable(t) })),
        moduleOf: (appId) => appById(appId)?.module,
        appTitle: (appId) => appById(appId)?.title,
        currentModule: moduleOfPath(pathname),
        query,
      })
    : [];

  function openChange(next: boolean) {
    if (next) setQuery("");
    setOpen(next);
  }

  /**
   * Wrap the selection in a link to `canonical` where it was selected — in an
   * editor as one edit, in a rendered body through the store. Returns what
   * puts the words back while the link is still as written, or null when the
   * link could not be placed.
   */
  async function writeLinkAt(s: BodySelection, canonical: string): Promise<(() => void) | null> {
    if (!s.placement) return null;
    const ed = s.editor;
    if (ed) {
      const w = writeLink(ed.body(), s.placement, canonical);
      if (!w) return null;
      const words = ed.body().slice(w.from, w.to);
      ed.replace(w.from, w.to, w.insert);
      return () => {
        if (ed.body().slice(w.from, w.from + w.insert.length) === w.insert) ed.replace(w.from, w.from + w.insert.length, words);
      };
    }
    const id = s.originId;
    const current = await getDocument(id);
    const before = typeof current?.body === "string" ? current.body : "";
    const w = writeLink(before, s.placement, canonical);
    if (!w) return null;
    await patchDocument(id, { body: w.body });
    return () =>
      void (async () => {
        if ((await getDocument(id))?.body === w.body) await patchDocument(id, { body: before });
      })();
  }

  async function link(s: BodySelection, entry: Extract<SelectionEntry, { kind: "link" }>) {
    const undo = await writeLinkAt(s, entry.canonical);
    if (undo) toast.success(`Linked to ${entry.target}`, { action: { label: "Undo", onClick: undo } });
  }

  /** Quick make: the Document at once, the selection linked to it when its type is Linkable, its Peek open; Undo takes both back. */
  async function make(s: BodySelection, entry: Extract<SelectionEntry, { kind: "make" }>) {
    let made;
    try {
      made = await quickMake(entry.typeId, s.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      return;
    }
    let unlink: (() => void) | null = null;
    if (entry.linkable) {
      // The canonical name as it now stands: a title shared with another Document is written with its Folder.
      const name = buildLinkIndex(await allDocuments(), allDocumentTypes())
        .names()
        .find((n) => n.ref.kind === "doc" && n.ref.id === made.id);
      unlink = await writeLinkAt(s, name?.canonical ?? made.title);
    }
    openPeek(made.id);
    const id = made.id;
    toast.success(`Made ${entry.title} ${made.title}`, {
      action: {
        label: "Undo",
        onClick: () => {
          unlink?.();
          void removeDocument(id);
        },
      },
    });
  }

  function choose(entry: SelectionEntry<Intake>) {
    const s = last.current;
    setOpen(false);
    if (!s) return;
    if (entry.kind === "link") return void link(s, entry);
    if (entry.kind === "make") return void make(s, entry);
    rememberIntake(SENDER, entry.intake.key);
    setHanding({ intake: entry.intake, handoff: { title: origin?.title || s.text.slice(0, 80), text: s.text, originId: s.originId } });
  }

  // Keep the selection while pressing the trigger: its focus stays where it was.
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  const offer = shown && groups.length + (query ? 1 : 0) > 0 && (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={phone ? "outline" : "secondary"} className="shadow-sm" onMouseDown={keep} aria-label="Selection menu">
          <TextSelect /> Selection…
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Selection menu" align="start" side={phone ? "top" : "bottom"} className="w-72 max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Link or make…" aria-label="Filter" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.id} heading={g.title}>
                {g.entries.map((e) => (
                  <CommandItem key={e.key} value={e.key} onSelect={() => choose(e)} className="min-w-0">
                    {e.kind === "link" ? (
                      <Link2 className="size-4 shrink-0" />
                    ) : e.kind === "make" ? (
                      <TypeIcon type={e.typeId} />
                    ) : (
                      e.intake.icon && <e.intake.icon className="size-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const top = shown ? (shown.rect.top > 56 ? shown.rect.top - 40 : shown.rect.bottom + 8) : 0;
  const left = shown ? Math.min(Math.max(8, shown.rect.left), window.innerWidth - 140) : 0;

  return (
    <>
      {offer && (phone ? <PhoneDock>{offer}</PhoneDock> : <div className="fixed z-50" style={{ top, left }}>{offer}</div>)}
      {handing && <handing.intake.dialog open onOpenChange={(o) => !o && setHanding(null)} handoff={handing.handoff} />}
    </>
  );
}

/** A type's own icon, as the sidebar and the Vault show it. */
function TypeIcon({ type }: { type: string }) {
  const Icon = documentTypeSync(type)?.icon;
  return Icon ? <Icon className="size-4 shrink-0" /> : null;
}
