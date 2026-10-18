import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useOpenDocument } from "./openDocument";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Label, MiniMap, Sheet, SheetContent, SheetTitle, TagInput, Textarea, cn, toast } from "@lifeline/ui";
import {
  isLinkable,
  documentPanels,
  basePath,
  displayTitle,
  docHref,
  documentToText,
  effectiveTags,
  extractProseTags,
  fieldsOfDocument,
  formatHuman,
  geoOf,
  normalizeTag,
  putDocument,
  removeDocument,
  restoreRole,
  roleDef,
  ROLES_KEY,
  singularOf,
  textToDocument,
  useIsMobile,
  useTagVocabulary,
  wearableRoles,
  withRoleFields,
  wornRoles,
  writeGeo,
  type Document,
  openPrivateDialog,
  type DocumentTypeDef,
  type LinkIndex,
  type LinkRef,
} from "@lifeline/core";
import { BookOpen, Code2, Shapes, Link2, MoreHorizontal, PanelRightClose, PanelRightOpen, Pencil, SlidersHorizontal, Table2, Trash2 } from "lucide-react";
import { MarkdownEditor } from "./MarkdownEditor";
import { ReadTimer } from "./ReadTimer";
import { MarkdownView } from "./MarkdownView";
import { FieldsForm } from "./FieldsForm";
import { LinksPanel } from "./LinksPanel";
import { LocalGraphPanel } from "./LocalGraphPanel";

export interface DocumentEditorProps {
  doc: Document;
  def: DocumentTypeDef | undefined;
  index: LinkIndex;
  autoFocus?: boolean;
  showPanel?: boolean;
  /** The day a daylog fence defaults to (a daily note's date). */
  docDate?: string | null;
  /** What to do with an unresolved link the user opens. Default: create a `note` and open it. */
  onCreateUnresolved?: (name: string) => void;
  /** Called after delete (default: navigate to the type's Base). */
  onDeleted?: () => void;
  /** Extra toolbar content (an App's own actions). */
  toolbar?: React.ReactNode;
  /** A note under the header (an App's own hint). */
  banner?: React.ReactNode;
  /** Allow editing guarded fields through the form (the owning App's own editor). */
  allowGuarded?: boolean;
  /** Write the Document (default: putDocument). */
  save?: (next: Document) => Promise<unknown>;
  /** Delete the Document (default: removeDocument) — an App may cascade. */
  remove?: () => Promise<unknown>;
  /** Nothing but the title and the page: the Fields and Tags strip is left out (a Manuscript's Focus). */
  minimal?: boolean;
}

/**
 * The generic editor over any Document (ADR 0018): title, the type's Fields
 * as a form, Tags, the markdown body (edit / reading / raw text modes), and
 * the links panel. Saves are debounced. Text mode shows the frontmatter
 * projection; edits to guarded fields there are reverted with a notice.
 */
export function DocumentEditor({ doc, def, index, autoFocus, showPanel = true, docDate = null, onCreateUnresolved, onDeleted, toolbar, banner, allowGuarded, save, remove: removeFn, minimal = false }: DocumentEditorProps) {
  const navigate = useNavigate();
  const openDoc = useOpenDocument();
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(showPanel);
  /** Phone: the panel is a right sheet, not a column — it starts closed whatever `showPanel` says. */
  const [panelSheet, setPanelSheet] = useState(false);
  const panelShown = isMobile ? panelSheet : panelOpen;
  const togglePanel = () => (isMobile ? setPanelSheet((o) => !o) : setPanelOpen((o) => !o));
  const [mode, setMode] = useState<"edit" | "read" | "text">("edit");
  /** Phone: the Fields + Tags strip is folded away — on a phone the body is the point. */
  const [detailsOpen, setDetailsOpen] = useState(false);
  /**
   * The header recedes while the body is being written and comes back on a
   * scroll up or a blur (ADR 0021, amended 2026-09-05). Automatic rather than a
   * toggle: a focus button is one more control in the row it is trying to
   * empty, and a mode one can be stuck in without knowing. Editor behaviour, so
   * it applies at the desk too — a title pinned above the text is no more
   * wanted with a mouse (the caret band set that precedent).
   */
  const [quiet, setQuiet] = useState(false);
  // Leaving the body's editor at all — reading mode, raw text — brings the
  // header back: those modes unmount the editor, which would otherwise never
  // report the change and leave the header away with no way to ask for it.
  useEffect(() => setQuiet(false), [mode]);
  const [title, setTitle] = useState(doc.title);
  useEffect(() => setTitle(doc.title), [doc.title]);

  const docRef = useRef(doc);
  docRef.current = doc;
  // Kept in a ref: an App usually passes a fresh closure every render, and a
  // changing `write` used to re-run the unmount effect below on every render —
  // flushing (and syncing) mid-word instead of when the typing stops.
  const saveRef = useRef(save);
  saveRef.current = save;
  /** Pending edits not yet flushed. */
  const pending = useRef<Partial<Document>>({});
  const timer = useRef<number | null>(null);
  /** The body the editor holds; ahead of the stored one until a write comes back. */
  const editorBody = useRef<string | null>(null);
  /** Bodies handed to the store and not read back yet (see `body` below). */
  const written = useRef<string[]>([]);
  const write = useCallback(async (next: Document) => {
    if (saveRef.current) await saveRef.current(next);
    else await putDocument(next as Document & { type: string });
  }, []);
  const flush = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (Object.keys(pending.current).length === 0) return;
    const next = { ...docRef.current, ...pending.current } as Document;
    pending.current = {};
    if (typeof next.body === "string") written.current = [...written.current, next.body].slice(-10);
    void write(next);
  }, [write]);
  const stage = useCallback(
    (patch: Partial<Document>, immediate = false) => {
      if (typeof patch.body === "string") editorBody.current = patch.body;
      pending.current = { ...pending.current, ...patch };
      if (immediate) return flush();
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 500);
    },
    [flush],
  );
  useEffect(() => () => flush(), [flush]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setMode((m) => (m === "read" ? "edit" : "read"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openRef = useCallback(
    (ref: LinkRef, name: string) => {
      if (ref.kind === "doc") {
        const d = index.byId.get(ref.id);
        if (d) openDoc(d);
        return;
      }
      if (ref.kind === "locked") return openPrivateDialog("unlock");
      if (onCreateUnresolved) return onCreateUnresolved(name);
      void putDocument({ type: "thought", title: name, body: "" }).then((n) => {
        toast.success(`Created “${name}”`);
        navigate(docHref(n));
      });
    },
    [index, navigate, openDoc, onCreateUnresolved],
  );
  const context = useMemo(() => ({ docDate, openRef }), [docDate, openRef]);

  const stored = typeof doc.body === "string" ? doc.body : "";
  /**
   * The text the editor works on. The stored body lags behind the keystrokes
   * for the length of a write's round trip, so a Document arriving with a body
   * we ourselves wrote is our own write catching up, not news, and must not be
   * pushed back into the editor — it would undo whatever was typed meanwhile
   * (erasing characters fast used to fight the editor, the last one reappearing
   * over and over as each save came back). Anything else — another device's
   * edit, a Restore, text mode — is news and wins.
   */
  const body = (() => {
    if (editorBody.current === null || stored === editorBody.current) {
      written.current = [];
      return stored;
    }
    if (typeof pending.current.body === "string" || written.current.includes(stored)) return editorBody.current;
    editorBody.current = null;
    written.current = [];
    return stored;
  })();
  const hasBody = (def?.body ?? "optional") !== "none";
  // A worn Role's Fields (ADR 0069) sit beside the type's own, everywhere the type's would.
  const fields = useMemo(() => fieldsOfDocument(doc, def), [doc, def]);
  const textDef = useMemo(() => withRoleFields(doc, def), [doc, def]);
  const worn = wornRoles(doc);
  const wearable = wearableRoles(doc, def);
  const currentRoles = Array.isArray(doc[ROLES_KEY]) ? (doc[ROLES_KEY] as string[]) : [];
  function putOnRole(roleId: string) {
    stage({ [ROLES_KEY]: [...currentRoles, roleId] } as Partial<Document>, true);
  }
  /** Taking a Role off drops its own Fields; the toast's Undo puts them back. */
  function takeOffRole(roleId: string) {
    const role = roleDef(roleId);
    if (!role) return;
    const own = new Set((def?.fields ?? []).map((f) => f.key));
    const dropped: Record<string, unknown> = {};
    const patch: Record<string, unknown> = { [ROLES_KEY]: currentRoles.filter((r) => r !== roleId) };
    for (const f of role.fields) {
      if (own.has(f.key)) continue;
      if (doc[f.key] !== undefined) dropped[f.key] = doc[f.key];
      patch[f.key] = undefined;
    }
    stage(patch as Partial<Document>, true);
    toast.success(`No longer ${/^[aeiou]/i.test(role.label) ? "an" : "a"} ${role.label}`, { action: { label: "Undo", onClick: () => void restoreRole(doc.id, roleId, dropped) } });
  }
  /**
   * The header's controls come from the type (ADR 0045), so a Document is
   * never offered a control that can do nothing for it:
   * - raw "frontmatter + body as text" is just the body when the type declares
   *   no visible Field, and the editor below is already that;
   * - the links panel is backlinks and the local graph, which a type that is
   *   not a wikilink target (a Template) has none of.
   */
  const hasFields = fields.some((f) => !f.hidden);
  const hasPanel = isLinkable(def) || !!def?.locatable;
  const fieldValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of fields) out[f.key] = doc[f.key];
    return out;
  }, [doc, fields]);

  async function commitTitle() {
    if (def?.titleRule === "date" || def?.titleRule === "derived") return;
    if (title.trim() && title.trim() !== doc.title) stage({ title: title.trim() }, true);
    else setTitle(doc.title);
  }

  async function remove() {
    flush();
    if (removeFn) await removeFn();
    else await removeDocument(doc.id);
    toast.success(`“${displayTitle(doc, def)}” deleted`);
    if (onDeleted) onDeleted();
    else navigate(basePath(doc.type));
  }

  const coords = useMemo(() => geoOf(doc, def), [doc, def]);
  const geoKey = typeof def?.locatable === "string" ? def.locatable : undefined;

  // Tags (ADR 0014): the chip row edits the explicit list; prose #tags are read-only here (edit them in the text).
  const proseTags = useMemo(() => extractProseTags(body), [body]);
  const explicitTags = useMemo(() => doc.tags.filter((t) => !proseTags.includes(t)), [doc.tags, proseTags]);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);

  // Text mode: the frontmatter projection.
  const [text, setText] = useState("");
  const codec = useMemo(
    () => ({
      linkName: (id: string) => {
        const d = index.byId.get(id);
        return d ? displayTitle(d) : undefined;
      },
      resolveLink: (name: string) => {
        const r = index.resolve(name);
        return r.kind === "doc" ? r.id : undefined;
      },
    }),
    [index],
  );
  useEffect(() => {
    if (mode === "text") setText(documentToText(doc, textDef, codec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  function commitText() {
    const { patch, rejected } = textToDocument(text, doc, textDef, codec);
    if (rejected.length > 0) toast.message(`Guarded fields kept as they were: ${rejected.join(", ")}`);
    stage(patch as Partial<Document>, true);
  }

  const Icon = def?.icon;
  const label = def ? singularOf(def) : doc.type;
  /** The right-hand panel's contents: a column on the desktop, a sheet on a phone. */
  const panel = (
    <>
      {!isMobile && (
        <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
          <Link2 className="size-3" /> ⌘-click a link to open it
        </div>
      )}
      {coords && (
        <div className="mb-3">
          <MiniMap
            lat={coords.lat}
            lon={coords.lon}
            color="var(--chart-green)"
            onMove={(lat, lon) => {
              if (geoKey) stage({ [geoKey]: writeGeo({ lat, lon }) }, true);
            }}
            onExpand={() => navigate(`/map?focus=${doc.type}/${doc.id}`)}
          />
        </div>
      )}
      <div className="mb-3">
        <LocalGraphPanel docId={doc.id} index={index} onOpen={openRef} />
      </div>
      {documentPanels().map((p) => {
        const Panel = p.component;
        return (
          <div key={`${p.appId}/${p.id}`} className="mb-3">
            <Panel doc={doc} index={index} />
          </div>
        );
      })}
      <LinksPanel docId={doc.id} index={index} onOpen={openRef} />
    </>
  );
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Collapsed rather than unmounted: the title Input keeps its state, and
            a height transition is what stops the text jumping under the caret. */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 overflow-hidden border-b px-3 py-2 transition-[max-height,opacity,padding] duration-200 md:flex-nowrap md:px-4",
            quiet ? "max-h-0 border-b-0 py-0 opacity-0" : "max-h-40 opacity-100",
          )}
          // Collapsed chrome must leave the tab order too, or Tab walks into
          // controls nobody can see. `inert` does both halves (React 19).
          inert={quiet}
        >
          {Icon && <Icon className="text-muted-foreground size-4 shrink-0" />}
          {def?.titleRule === "date" ? (
            <h1 className="text-lg font-semibold tracking-tight">
              {formatHuman(doc.title)} <span className="text-muted-foreground text-sm font-normal">{doc.title}</span>
            </h1>
          ) : def?.titleRule === "derived" ? (
            <h1 className="truncate text-lg font-semibold tracking-tight">{displayTitle(doc, def)}</h1>
          ) : (
            <Input
              className="h-8 max-w-md border-transparent px-1 text-lg font-semibold tracking-tight shadow-none focus-visible:border-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              aria-label="Title"
            />
          )}
          <Badge variant="secondary" className="shrink-0 cursor-pointer max-md:hidden" title={`Open the ${def?.label ?? doc.type} Base`} onClick={() => navigate(basePath(doc.type))}>
            {label}
          </Badge>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1 max-md:basis-full md:flex-nowrap">
            {toolbar}
            <Button size="icon" variant="ghost" className={cn("size-8 md:hidden", detailsOpen && "bg-accent")} onClick={() => setDetailsOpen((o) => !o)} aria-label="Fields and tags" title="Fields and tags">
              <SlidersHorizontal />
            </Button>
            {hasBody && (
              <Button size="icon" variant="ghost" className="size-8" onClick={() => setMode((m) => (m === "read" ? "edit" : "read"))} aria-label={mode === "read" ? "Edit" : "Reading mode"} title={mode === "read" ? "Edit (⌘E)" : "Reading mode (⌘E)"}>
                {mode === "read" ? <Pencil /> : <BookOpen />}
              </Button>
            )}
            {hasFields && (
              <Button size="icon" variant="ghost" className={`size-8 ${mode === "text" ? "bg-accent" : ""}`} onClick={() => setMode((m) => (m === "text" ? "edit" : "text"))} aria-label="Raw text" title="Frontmatter + body as text">
                <Code2 />
              </Button>
            )}
            {hasPanel && (
              <Button size="icon" variant="ghost" className={cn("size-8", isMobile && panelShown && "bg-accent")} onClick={togglePanel} aria-label="Toggle links panel" title="Links panel">
                {panelShown ? <PanelRightClose /> : <PanelRightOpen />}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(basePath(doc.type))}>
                  <Table2 /> Open {def?.label ?? "Base"}
                </DropdownMenuItem>
                {wearable.map((r) => (
                  <DropdownMenuItem key={`on-${r.id}`} onClick={() => putOnRole(r.id)}>
                    <Shapes /> Also {/^[aeiou]/i.test(r.label) ? "an" : "a"} {r.label}
                  </DropdownMenuItem>
                ))}
                {worn.map((r) => (
                  <DropdownMenuItem key={`off-${r.id}`} onClick={() => takeOffRole(r.id)}>
                    <Shapes /> Not {/^[aeiou]/i.test(r.label) ? "an" : "a"} {r.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {banner}
        {mode === "text" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 md:p-4">
            <Textarea className="min-h-0 flex-1 resize-none font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMode("edit")}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => { commitText(); setMode("edit"); }}>
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={cn("grid gap-2 border-b px-3 py-2 md:px-4", !detailsOpen && "max-md:hidden", minimal && "hidden")}>
              {fields.some((f) => !f.hidden) && (
                <FieldsForm def={{ fields }} value={fieldValues} allowGuarded={allowGuarded} onChange={(next) => stage(next as Partial<Document>)} />
              )}
              <div className="grid gap-1">
                <Label htmlFor="doc-tags" className="text-muted-foreground text-xs">
                  Tags
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <TagInput
                    id="doc-tags"
                    className="min-w-48 flex-1"
                    value={explicitTags}
                    onChange={(next) => stage({ tags: effectiveTags(next, body) }, true)}
                    suggestions={tagSuggestions}
                    normalize={normalizeTag}
                    placeholder="Add tag…"
                  />
                  {proseTags.length > 0 && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" title="Written in the text — edit them there">
                      in text: {proseTags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {hasBody && (
              // Names the Document, so selecting in its body — read or edited — can hand the passage off (ADR 0073).
              <div className="flex min-h-0 flex-1 flex-col px-3 md:px-4" data-origin={doc.id}>
                {mode === "read" ? (
                  <>
                    <div className="min-h-0 flex-1 overflow-y-auto py-3" onDoubleClick={() => setMode("edit")}>
                      <MarkdownView body={body} index={index} docDate={docDate} />
                    </div>
                    {/* Reading a Writing aloud is a Talk (CONTEXT.md), and the clock
                        is what you want while giving one. Declared by the type, so
                        reading mode needs to know nothing about Writings. */}
                    {def?.readTimer && <ReadTimer />}
                  </>
                ) : (
                  <MarkdownEditor
                    value={body}
                    onChange={(next) => stage({ body: next, tags: effectiveTags(explicitTags, next) })}
                    index={index}
                    context={context}
                    autoFocus={autoFocus}
                    onQuietChange={setQuiet}
                    placeholder="Write… [[ links any Document, #tags, ```daylog for the day's facts"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Not merely CSS-hidden on a phone: the sheet below holds the same panel, and mounting both
          would run every App's document panel twice. */}
      {hasPanel && panelOpen && !isMobile && <aside className="w-80 min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-l p-3 max-md:hidden">{panel}</aside>}
      {/* Phone: the same panel as a right sheet — there is no width for a column, and
          the links, the local graph and an App's own panels are not desk-only (ADR 0021). */}
      <Sheet open={hasPanel && isMobile && panelSheet} onOpenChange={setPanelSheet}>
        <SheetContent side="right" aria-describedby={undefined} className="w-[85%] max-w-sm overflow-hidden">
          <SheetTitle>Links</SheetTitle>
          {/* Opening a link navigates, which remounts the editor (keyed by Document) — the sheet goes with it. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{panel}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
