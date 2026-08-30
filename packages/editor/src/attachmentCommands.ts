import { EditorSelection } from "@codemirror/state";
import { EditorView, type Command } from "@codemirror/view";
import { addAttachment } from "@lifeline/core";
import { toast } from "@lifeline/ui";

/** The image files of a drop or a paste (anything else is left to the default handling). */
export function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files ?? []).filter((f) => f.type.startsWith("image/"));
}

/**
 * Write `![[name]]` at `at`, on a line of its own when the line already has
 * text, and leave the cursor after it. Returns the cursor position.
 */
export function insertEmbed(view: EditorView, name: string, at: number): number {
  const line = view.state.doc.lineAt(at);
  const before = view.state.sliceDoc(line.from, at);
  const after = view.state.sliceDoc(at, line.to);
  const text = `${before.trim() ? "\n" : ""}![[${name}]]${after.trim() ? "\n" : ""}`;
  const cursor = at + text.length - (after.trim() ? 1 : 0);
  view.dispatch({
    changes: { from: at, insert: text },
    selection: EditorSelection.cursor(cursor),
    userEvent: "input",
    scrollIntoView: true,
  });
  return cursor;
}

/**
 * Store each image as an Attachment (ADR 0037) and embed it, one after the
 * other from `at`. Each embed is written as soon as its bytes are stored —
 * offline included; the upload follows through the outbox.
 */
export async function insertAttachments(view: EditorView, files: File[], at: number): Promise<void> {
  let pos = at;
  for (const f of files) {
    try {
      const att = await addAttachment(f);
      pos = insertEmbed(view, att.name, Math.min(pos, view.state.doc.length));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
}

/**
 * Drop and paste of image files into the editor: the browser-standard events
 * (Tauri's own drag-drop interception is off, ADR 0037). Text drops and
 * pastes fall through to CodeMirror.
 */
export const attachmentDrop = EditorView.domEventHandlers({
  dragover(event) {
    if (!event.dataTransfer?.types.includes("Files")) return false;
    event.preventDefault();
    return true;
  },
  drop(event, view) {
    const files = imageFiles(event.dataTransfer);
    if (files.length === 0) return false;
    event.preventDefault();
    const at = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
    void insertAttachments(view, files, at);
    return true;
  },
  paste(event, view) {
    const files = imageFiles(event.clipboardData);
    if (files.length === 0) return false;
    event.preventDefault();
    void insertAttachments(view, files, view.state.selection.main.head);
    return true;
  },
});

/** Open the platform's image picker (the phone's gallery or camera) and embed what it returns. */
export const pickImage: Command = (view) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.style.display = "none";
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    input.remove();
    if (files.length) void insertAttachments(view, files, view.state.selection.main.head);
  };
  document.body.appendChild(input);
  input.click();
  return true;
};
