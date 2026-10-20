import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  commandDefaultFilter,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@lifeline/ui";
import {
  appById,
  MACRO_APP,
  CALENDAR_VIEWS,
  isInvocable,
  isModShortcut,
  moduleById,
  moduleHome,
  registeredApps,
  screenRoute,
  useAllCommands,
  useCaptureSheet,
  useWorkspaceModules,
  useWorkspaceScreens,
  type CaptureEntry,
  type CommandDef,
} from "@lifeline/core";
import { MODULE_ICONS } from "../navIcons";
import { GUIDE_PAGES } from "@lifeline/guide";
import { CalendarDays, CircleHelp, LayoutDashboard, MapPin, Terminal } from "lucide-react";
import { guideHref } from "../guide/guidePlace";
import { entryIcon, foldMembers } from "../capture/captureParts";
import { InlineLine } from "./InlineLine";

type DialogCommand = CommandDef & { appId: string };

/**
 * The palette carries capture at the desk (CONTEXT.md "Capture sheet"):
 * opened empty it shows the Workspace's pins, in the sheet's order; typed into,
 * capture Commands rank above everything else, folded ones included — typing
 * "movie" finds "Add movie…" directly. Ungated by Module, as the palette is.
 *
 * The ranking rides on cmdk's own scorer: a capture item carries a marker
 * keyword, and any match on it scores one above the best a plain match can.
 * cmdk orders groups by their best item, so the Capture group leads — after
 * the rows inline Commands offer for the query, which lead everything.
 */
const CAPTURE_MARK = "\u0000capture";
/**
 * An inline Command's row (ADR 0088) has judged the query itself: it scores
 * above anything a match can, whatever cmdk would make of its label.
 */
const INLINE_MARK = "\u0000inline";

function rankCaptureFirst(value: string, search: string, keywords?: string[]): number {
  if (keywords?.includes(INLINE_MARK)) return 3;
  const capture = keywords?.includes(CAPTURE_MARK) ?? false;
  const score = commandDefaultFilter(value, search, capture ? keywords!.filter((k) => k !== CAPTURE_MARK) : keywords);
  return capture && score > 0 ? score + 1 : score;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogCommand | null>(null);
  const [search, setSearch] = useState("");
  // A pinned fold opens its members here, in place of the full list.
  const [openFold, setOpenFold] = useState<Extract<CaptureEntry, { kind: "fold" }> | null>(null);
  // The caret, for the inline reader's suggestions (ADR 0091).
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  const screens = useWorkspaceScreens();
  const modules = useWorkspaceModules();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isModShortcut(e, "k")) {
        e.preventDefault();
        setOpen((o) => {
          if (o) {
            setSearch("");
            setOpenFold(null);
          }
          return !o;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function setPaletteOpen(o: boolean) {
    setOpen(o);
    if (!o) {
      setSearch("");
      setOpenFold(null);
    }
  }

  function pick(fn: () => void) {
    setPaletteOpen(false);
    fn();
  }

  function runCommand(c: DialogCommand) {
    if (c.dialog) return pick(() => setActiveDialog(c));
    // A Command may ask to stay (CommandCtx.keepPalette): the query empties, ready for it.
    let keep = false;
    void c.run?.({
      navigate,
      keepPalette: () => {
        keep = true;
      },
    });
    if (!keep) return setPaletteOpen(false);
    setSearch("");
    input.current?.focus();
  }

  function pickEntry(e: CaptureEntry) {
    if (e.kind === "fold") {
      setOpenFold(e);
      setSearch("");
    } else runCommand(e.command);
  }

  const commands = useAllCommands();
  const { pinned } = useCaptureSheet();
  const runnable = commands.filter((c) => c.dialog || c.run);
  // What `!` can name: every Command but an inline-only one (ADR 0088), headless-only ones included.
  const nameable = useMemo(() => commands.filter((c) => c.dialog || c.run || isInvocable(c)), [commands]);
  // Every inline Command reads the query anew on each change of it (ADR 0088).
  const offers =
    search.trim() === ""
      ? []
      : commands.flatMap((c) => {
          const offer = c.inline?.(search);
          return offer ? [{ command: c, offer }] : [];
        });
  const ActiveDialogComponent = activeDialog?.dialog;

  /** A `!` in the query hands the list to the inline reader, which keeps the search only while the line is no mark. */
  function withInline(rows: ReactNode) {
    if (!search.includes("!")) return rows;
    return (
      <InlineLine
        line={search}
        cursor={Math.min(cursor, search.length)}
        commands={nameable}
        mark={INLINE_MARK}
        onLine={(line, at) => {
          setSearch(line);
          setCursor(at);
          requestAnimationFrame(() => {
            input.current?.focus();
            input.current?.setSelectionRange(at, at);
          });
        }}
        onOpen={(c) => runCommand(c)}
        onDone={() => setPaletteOpen(false)}
      >
        {rows}
      </InlineLine>
    );
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setPaletteOpen} filter={rankCaptureFirst}>
        <CommandInput
          ref={input}
          placeholder={openFold ? `${openFold.title.replace(/…$/, "")}: which?` : "Type a command or search…"}
          value={search}
          onValueChange={(v) => {
            setSearch(v);
            setCursor(input.current?.selectionStart ?? v.length);
          }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? search.length)}
          onKeyDown={(e) => {
            if (openFold && e.key === "Backspace" && search === "") setOpenFold(null);
          }}
        />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {openFold ? (
            <CommandGroup heading={openFold.title}>
              {foldMembers(openFold).map(({ entry, label }) => {
                const Icon = entryIcon(entry);
                return (
                  <CommandItem key={entry.key} value={`${label} ${entry.key}`} onSelect={() => pickEntry(entry)}>
                    <Icon /> {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : (
          withInline(<>
          {offers.length > 0 && (
            <CommandGroup>
              {offers.map(({ command: c, offer }) => {
                const Icon = c.icon ?? Terminal;
                return (
                  <CommandItem
                    key={`inline-${c.appId}/${c.id}`}
                    value={`${offer.label} inline ${c.appId}/${c.id}`}
                    keywords={[INLINE_MARK]}
                    onSelect={() => pick(() => void offer.run({ navigate }))}
                  >
                    <Icon /> <span className="min-w-0 flex-1 truncate">{offer.label}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{appById(c.appId)?.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {search === "" && pinned.length > 0 && (
            <>
              <CommandGroup heading="Pinned">
                {pinned.map((e) => {
                  const Icon = entryIcon(e);
                  return (
                    <CommandItem key={`pin-${e.key}`} value={`pinned ${e.title} ${e.key}`} onSelect={() => pickEntry(e)}>
                      <Icon /> {e.title}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading="Capture">
            {runnable
              .filter((c) => c.capture)
              .map((c) => {
                const Icon = c.icon ?? Terminal;
                return (
                  <CommandItem
                    key={`capture-${c.appId}/${c.id}`}
                    value={`${c.title} ${c.appId}/${c.id}`}
                    keywords={[...(c.keywords ?? []), appById(c.appId)?.title ?? "", CAPTURE_MARK]}
                    onSelect={() => runCommand(c)}
                  >
                    <Icon /> {c.title}
                    <span className="text-muted-foreground ml-auto text-xs">{appById(c.appId)?.title}</span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {modules.map((id) => {
              const m = moduleById(id);
              if (!m) return null;
              const Icon = MODULE_ICONS[id] ?? LayoutDashboard;
              return (
                <CommandItem key={`module-${id}`} onSelect={() => pick(() => navigate(moduleHome(m)))}>
                  <Icon /> {m.title}
                </CommandItem>
              );
            })}
            {screens.map((s) => (
              <CommandItem key={s.id} onSelect={() => pick(() => navigate(`/screen/${s.id}`))}>
                <LayoutDashboard /> {s.name}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => pick(() => navigate("/calendar"))}>
              <CalendarDays /> Calendar
            </CommandItem>
            {/* Each view by name, so "week" or "upcoming" finds it (ADR 0063). */}
            {CALENDAR_VIEWS.map((v) => (
              <CommandItem key={v.id} value={`Calendar ${v.title}`} onSelect={() => pick(() => navigate(`/calendar?view=${v.id}`))}>
                <CalendarDays /> Calendar · {v.title}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => pick(() => navigate("/map"))}>
              <MapPin /> Map
            </CommandItem>
            {registeredApps()
              .flatMap((a) => a.screens)
              .filter((s) => !s.hidden)
              .map((s) => {
                const Icon = s.icon ?? LayoutDashboard;
                return (
                  <CommandItem
                    key={s.id}
                    onSelect={() => pick(() => navigate(screenRoute(s)))}
                  >
                    <Icon /> {s.title}
                  </CommandItem>
                );
              })}
            {/* Every Guide page by name, so "guide money" finds it (ADR 0089). */}
            {GUIDE_PAGES.map((p) => (
              <CommandItem key={`guide-${p.slug}`} value={`Guide ${p.title}`} onSelect={() => pick(() => navigate(guideHref(p.slug)))}>
                <CircleHelp /> Guide · {p.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Commands">
            {runnable
              .filter((c) => !c.capture)
              .map((c) => {
                const Icon = c.icon ?? Terminal;
                return (
                  <CommandItem
                    key={c.id}
                    keywords={c.keywords}
                    onSelect={() => runCommand(c)}
                  >
                    <Icon /> {c.title}
                    <span className="text-muted-foreground ml-auto text-xs">
                      {c.appId === MACRO_APP ? "Macro" : appById(c.appId)?.title}
                    </span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
          </>)
          )}
        </CommandList>
      </CommandDialog>

      {ActiveDialogComponent && (
        <ActiveDialogComponent
          open={activeDialog !== null}
          onOpenChange={(o) => !o && setActiveDialog(null)}
        />
      )}
    </>
  );
}
