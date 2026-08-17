import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, MiniMap, toast } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { Link2, MoreHorizontal, PanelRightClose, PanelRightOpen, Trash2 } from "lucide-react";
import type { Note } from "../domain/types";
import { noteType, TEMPLATE_TYPE } from "../domain/noteTypes";
import type { LinkRef, NoteIndex } from "../domain/index";
import { noteCoords, splitFrontmatter, withProperties, writeCoords, type Properties } from "../domain/markdown";
import { createNote, deleteNote, renameNote, saveBody } from "../data/repo";
import { MarkdownEditor } from "./MarkdownEditor";
import { PropertiesForm } from "./PropertiesForm";
import { LinksPanel } from "./LinksPanel";

/**
 * One note: title, typed properties (frontmatter), the markdown editor over
 * the content, and the links panel. Saves are debounced; the text is the
 * truth (ADR 0009).
 */
export function NoteEditor({ note, index, autoFocus, showPanel = true }: { note: Note; index: NoteIndex; autoFocus?: boolean; showPanel?: boolean }) {
  const navigate = useNavigate();
  const def = noteType(note.type);
  const [panelOpen, setPanelOpen] = useState(showPanel);
  const [title, setTitle] = useState(note.title);
  useEffect(() => setTitle(note.title), [note.title]);

  const { properties, content } = useMemo(() => splitFrontmatter(note.body), [note.body]);
  const contentRef = useRef(content);
  const propsRef = useRef<Properties>(properties);
  useEffect(() => {
    contentRef.current = content;
    propsRef.current = properties;
  }, [content, properties]);

  const noteRef = useRef(note);
  noteRef.current = note;
  const timer = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const body = withProperties(contentRef.current, propsRef.current);
    void saveBody(noteRef.current, body);
  }, []);
  const scheduleSave = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  }, [flush]);
  useEffect(() => () => flush(), [flush]);

  const openRef = useCallback(
    (ref: LinkRef, name: string) => {
      if (ref.kind === "note") navigate(`/notes/n/${ref.noteId}`);
      else if (ref.kind === "app") {
        if (ref.href) navigate(ref.href);
        else toast.message(`${name} lives in another app`);
      } else {
        void createNote({ type: "plain", title: name }).then((n) => {
          toast.success(`Created “${name}”`);
          navigate(`/notes/n/${n.id}`);
        });
      }
    },
    [navigate],
  );
  const context = useMemo(() => ({ noteDate: note.type === "daily" ? note.title : null, openRef }), [note.type, note.title, openRef]);

  async function commitTitle() {
    if (def.titleRule === "date") return;
    if (title.trim() && title.trim() !== note.title) await renameNote(note, title);
    else setTitle(note.title);
  }

  async function remove() {
    flush();
    await deleteNote(note.id);
    toast.success(`“${note.title}” deleted`);
    navigate("/notes");
  }

  const coords = useMemo(() => noteCoords(properties), [properties]);
  const Icon = def.icon;
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Icon className="text-muted-foreground size-4 shrink-0" />
          {def.titleRule === "date" ? (
            <h1 className="text-lg font-semibold tracking-tight">
              {formatHuman(note.title)} <span className="text-muted-foreground text-sm font-normal">{note.title}</span>
            </h1>
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
          <Badge variant="secondary" className="shrink-0">
            {def.label}
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setPanelOpen((o) => !o)} aria-label="Toggle links panel">
              {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
                  <Trash2 /> Delete note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {note.type === TEMPLATE_TYPE && (
          <div className="text-muted-foreground border-b px-4 py-1.5 text-xs">
            Template for <span className="text-foreground font-medium">{noteType(note.title).label}</span> notes — this text seeds every new one. Placeholders:{" "}
            <code>{"{{title}}"}</code> <code>{"{{date}}"}</code> <code>{"{{time}}"}</code>. Delete this note to restore the built-in default.
          </div>
        )}
        {def.properties.length > 0 && (
          <div className="border-b px-4 py-2">
            <PropertiesForm
              type={def}
              value={properties}
              onChange={(next) => {
                propsRef.current = next;
                flush();
              }}
            />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col px-4">
          <MarkdownEditor
            value={content}
            onChange={(next) => {
              contentRef.current = next;
              scheduleSave();
            }}
            index={index}
            context={context}
            autoFocus={autoFocus}
            placeholder="Write… [[ links notes and app items, #tags, ```daylog for the day's facts"
          />
        </div>
      </div>
      {panelOpen && (
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l p-3 md:block">
          <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
            <Link2 className="size-3" /> ⌘-click a link to open it
          </div>
          {coords && (
            <div className="mb-3">
              <MiniMap
                lat={coords.lat}
                lon={coords.lon}
                color="var(--chart-green)"
                onMove={(lat, lon) => {
                  propsRef.current = { ...propsRef.current, location: writeCoords({ lat, lon }) };
                  flush();
                }}
                onExpand={() => navigate(`/map?focus=notes/${note.id}`)}
              />
            </div>
          )}
          <LinksPanel note={note} index={index} onOpen={openRef} />
        </aside>
      )}
    </div>
  );
}
