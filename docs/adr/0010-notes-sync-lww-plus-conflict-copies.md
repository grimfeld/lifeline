# Notes keep per-record LWW but never drop local edits: conflict copies

ADR 0002's sync is last-writer-wins per record, which is fine for chores and entries but would silently drop a paragraph when the same journal note is edited on two offline devices. Rather than a CRDT/3-way merge for one collection (a second persistence model and a heavy dependency), the sync layer gains a per-collection hook: when a pull would overwrite a note that has unsynced local edits, the local text is saved as a sibling note `"<title> (conflict HH:MM)"` and the incoming version wins the original. Nothing is lost, there is no merge UI, and every other collection keeps plain LWW.

## Amendment (2026-08-28): the editor is authoritative while it holds unstored keystrokes

Erasing characters quickly in a Writing put the pad in a loop: the last
character came back, was erased, came back again, each flip a stored write and
a queued push. LWW was not the culprit — the round trip through the store was.
A debounced save writes the body, the store answers a beat later, and the
answer is a body that is *older than the editor* if anything was typed in
between; pushed back into CodeMirror it undid those keystrokes, and CodeMirror
reported the undo as a user edit, which was saved, which came back. Three
rules, and the loop has nowhere to run:

- **An external value applied to the editor is never reported back.** It is
  applied as a minimal change (the caret survives an edit elsewhere in the
  text) and marked as such, so `onChange` — and the write and push behind it —
  fires for the user's edits only.
- **A Document arriving with a body this editor wrote is its own write
  catching up, not news.** The editor keeps the bodies it handed to the store
  and answers with its own text until the store agrees; only a body it never
  wrote — another device, a Restore, text mode — replaces what is on screen.
  Effects run a paint after the render that computed the value, so the editor
  also refuses any value that arrives while it holds changes the owner has not
  handed back yet.
- **A pull never rewrites an identical record.** Every push comes back on the
  same cycle's pull; storing it again woke every live query for nothing. And a
  record held back because a local write is queued no longer moves the pull
  cursor past it — the server copy has to come round again.

Debounced saves also stopped being flushed on every render: the owner's `save`
closure is held in a ref, so the unmount flush is an unmount flush again and
not a save per keystroke.
