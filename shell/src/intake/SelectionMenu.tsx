import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import {
  aliasWrite,
  allIntakes,
  appById,
  buildSelectionMenu,
  documentTypeSync,
  getDocument,
  isModShortcut,
  linkTargets,
  moduleOfPath,
  patchDocument,
  rememberIntake,
  singularOf,
  useDocument,
  useLinkIndex,
  writeLink,
  type Handoff,
  type LinkCandidate,
  type SelectionEntry,
} from "@lifeline/core";
import { readBodySelection, SELECTION_EVENT, type BodySelection } from "@lifeline/editor";
import {
  Button,
  Checkbox,
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

/** "Link to…" lists at most this many Documents; typing narrows the rest. */
const SEARCH_LIMIT = 50;

/** A new alias as `aliasWrite` gives it: the target's Aliases Field, with the words added. */
type AliasWrite = { key: string; value: string[] };

/**
 * What the open menu shows: its groups; "Link to…"'s search; or, for a target
 * whose name the words are not, the link about to be written with the option
 * (off) to add the words as its alias.
 */
type Pane = { kind: "menu" } | { kind: "search" } | { kind: "alias"; target: LinkCandidate; alias: AliasWrite; add: boolean };

/**
 * The **Selection menu** (CONTEXT.md, ADR 0086): selecting text in any
 * Document's body offers to link it to the Document it names, or to hand it to
 * an App's Intake, grouped by where each lives. Opened by its trigger or
 * `Ctrl+.`, filtered by typing; the groups and their order are Core's
 * (`buildSelectionMenu`), this only draws them and acts.
 *
 * "Link to…" searches every Linkable Document; when the selected words are
 * not the picked one's name, the link is offered with "add as alias" (off).
 * Linking rewrites the body in place — in an editor as one undoable edit, in a
 * rendered body through the store — and the user stays on the page. An Intake
 * opens its App's dialog prefilled with the Handoff; nothing is written until
 * it saves.
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
  const [pane, setPane] = useState<Pane>({ kind: "menu" });
  const [handing, setHanding] = useState<{ intake: Intake; handoff: Handoff } | null>(null);
  // The last selection seen: opening the menu (or a tap on its trigger) may clear the live one.
  const last = useRef<BodySelection | null>(null);
  const shown = sel ?? (open ? last.current : null);
  const origin = useDocument(shown?.originId);
  const index = useLinkIndex();

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
      setPane({ kind: "menu" });
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
        moduleOf: (appId) => appById(appId)?.module,
        appTitle: (appId) => appById(appId)?.title,
        currentModule: moduleOfPath(pathname),
        query,
      })
    : [];

  function openChange(next: boolean) {
    if (next) {
      setQuery("");
      setPane({ kind: "menu" });
    }
    setOpen(next);
  }

  /** Add the selected words as the target's alias; returns how to take it back while it still stands as written. */
  function addAlias(targetId: string, alias: AliasWrite): () => Promise<void> {
    const before = index.byId.get(targetId)?.[alias.key];
    void patchDocument(targetId, { [alias.key]: alias.value });
    return async () => {
      const now = (await getDocument(targetId))?.[alias.key];
      if (JSON.stringify(now) === JSON.stringify(alias.value)) await patchDocument(targetId, { [alias.key]: before ?? [] });
    };
  }

  /**
   * Wrap the selection in a link where it was selected, adding the words as
   * the target's alias when asked; Undo puts the words back while the link is
   * still as written, and takes the alias back too.
   */
  function link(s: BodySelection, entry: { canonical: string; target: string; targetId: string }, alias?: AliasWrite) {
    if (!s.placement) return;
    const done = `Linked to ${entry.target}`;
    const withAlias = () => (alias ? addAlias(entry.targetId, alias) : async () => {});
    const ed = s.editor;
    if (ed) {
      const w = writeLink(ed.body(), s.placement, entry.canonical);
      if (!w) return;
      const words = ed.body().slice(w.from, w.to);
      ed.replace(w.from, w.to, w.insert);
      const undoAlias = withAlias();
      toast.success(done, {
        action: {
          label: "Undo",
          onClick: () => {
            if (ed.body().slice(w.from, w.from + w.insert.length) === w.insert) ed.replace(w.from, w.from + w.insert.length, words);
            void undoAlias();
          },
        },
      });
      return;
    }
    const before = storedBody;
    const w = writeLink(before, s.placement, entry.canonical);
    if (!w) return;
    const id = s.originId;
    void patchDocument(id, { body: w.body });
    const undoAlias = withAlias();
    toast.success(done, {
      action: {
        label: "Undo",
        onClick: () =>
          void (async () => {
            if ((await getDocument(id))?.body === w.body) await patchDocument(id, { body: before });
            await undoAlias();
          })(),
      },
    });
  }

  /** A Document picked from "Link to…": linked at once, unless the words could become its alias — then that is offered first. */
  function pick(target: LinkCandidate) {
    const s = last.current;
    const doc = index.byId.get(target.id);
    if (!s || !doc) return setOpen(false);
    const alias = aliasWrite(s.text, doc, documentTypeSync(doc.type));
    if (alias) return setPane({ kind: "alias", target, alias, add: false });
    setOpen(false);
    link(s, { canonical: target.canonical, target: target.title, targetId: target.id });
  }

  function confirmAlias(p: Extract<Pane, { kind: "alias" }>) {
    const s = last.current;
    setOpen(false);
    if (s) link(s, { canonical: p.target.canonical, target: p.target.title, targetId: p.target.id }, p.add ? p.alias : undefined);
  }

  function choose(entry: SelectionEntry<Intake>) {
    const s = last.current;
    setOpen(false);
    if (!s) return;
    if (entry.kind === "link") return link(s, entry);
    if (entry.kind === "search") {
      setQuery("");
      setPane({ kind: "search" });
      setOpen(true);
      return;
    }
    rememberIntake(SENDER, entry.intake.key);
    setHanding({ intake: entry.intake, handoff: { title: origin?.title || s.text.slice(0, 80), text: s.text, originId: s.originId } });
  }

  // Keep the selection while pressing the trigger: its focus stays where it was.
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  const targets = shown && pane.kind === "search" ? linkTargets(index, shown.originId, query).slice(0, SEARCH_LIMIT) : [];
  const offer = shown && (groups.length > 0 || query || pane.kind !== "menu") && (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={phone ? "outline" : "secondary"} className="shadow-sm" onMouseDown={keep} aria-label="Selection menu">
          <TextSelect /> Selection…
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Selection menu" align="start" side={phone ? "top" : "bottom"} className="w-72 max-w-[calc(100vw-2rem)] p-0">
        {pane.kind === "alias" ? (
          <div className="grid min-w-0 gap-3 p-3 text-sm">
            <p className="min-w-0">
              Link “{shown.text}” to <span className="font-medium">{pane.target.title}</span>
            </p>
            <label className="flex min-w-0 items-center gap-2">
              <Checkbox checked={pane.add} onCheckedChange={(v) => setPane({ ...pane, add: !!v })} className="shrink-0" />
              <span className="min-w-0">Also add “{shown.text}” as an alias</span>
            </label>
            <Button size="sm" autoFocus onClick={() => confirmAlias(pane)}>
              Link
            </Button>
          </div>
        ) : pane.kind === "search" ? (
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder="Link to…" aria-label="Search Documents" autoFocus />
            <CommandList>
              <CommandEmpty>No Document matches.</CommandEmpty>
              {targets.map((t) => (
                <CommandItem key={t.id} value={t.id} onSelect={() => pick(t)} className="min-w-0">
                  <Link2 className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.subtitle && <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">{t.subtitle}</span>}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder="Link or make…" aria-label="Filter" />
            <CommandList>
              <CommandEmpty>Nothing matches.</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.id} heading={g.title}>
                  {g.entries.map((e) => (
                    <CommandItem key={e.key} value={e.key} onSelect={() => choose(e)} className="min-w-0">
                      {e.kind === "intake" ? e.intake.icon && <e.intake.icon className="size-4 shrink-0" /> : <Link2 className="size-4 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}
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
