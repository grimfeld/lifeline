import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { initialList, initialText, todayStr, type CommandDialogProps } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@lifeline/ui";
import { ImagePlus, X } from "lucide-react";
import { addMemory } from "../data/repo";
import { memoryHref } from "../domain/types";
import { MemoryForm, type MemoryFormValue } from "./MemoryForm";

/** The chosen photo, shown while it waits to be kept. */
function Chosen({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img src={url} alt="The chosen photo" className="max-h-48 w-full rounded-md border object-contain" /> : null;
}

/**
 * New memory (ADR 0136): first a photo, picked or taken and skippable, then a
 * title and its day; the Memory is kept with the photo embedded and opens on
 * its page for the words and what it is about. The palette's and the capture
 * sheet's "New memory…". `initial` (CommandDialogProps) prefills the title,
 * the date and About (ids, carried to the Memory), so another spec can open
 * it for an Event without changing the Command's args.
 */
export function NewMemoryDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const [value, setValue] = useState<MemoryFormValue>({ title: "", date: todayStr(), about: [] });
  const { title, date, about } = value;
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setValue({ title: initialText(initial, "title"), date: initialText(initial, "date") || todayStr(), about: initialList(initial, "about") });
    setPhoto(null);
    setError("");
    setPhotoError("");
  }, [open, initial]);

  async function save() {
    if (!title.trim()) return setError("A Memory needs a title.");
    setBusy(true);
    setPhotoError("");
    try {
      const m = await addMemory({ title, date, about, photo: photo ?? undefined });
      onOpenChange(false);
      navigate(memoryHref(m.id));
    } catch (e) {
      if (photo) setPhotoError(`The photo could not be kept, so the Memory was not: ${(e as Error).message}`);
      else setError(`The Memory could not be kept: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New memory</DialogTitle>
          <DialogDescription>A photo if you have one, a title and its day; the words and what it is about go on its page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-2">
            {photo && <Chosen file={photo} />}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => photoRef.current?.click()}>
                <ImagePlus className="size-3.5" /> {photo ? "Another photo" : "Add a photo"}
              </Button>
              {photo && (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setPhoto(null)}>
                  <X className="size-3.5" /> Skip the photo
                </Button>
              )}
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Photo"
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null);
                setPhotoError("");
                e.target.value = "";
              }}
            />
            {photoError && (
              <p role="alert" className="text-destructive text-sm">
                {photoError}
              </p>
            )}
          </div>
          <MemoryForm
            value={value}
            showAbout={false}
            autoFocus
            titleError={error}
            onChange={(patch) => {
              setValue((v) => ({ ...v, ...patch }));
              if (patch.title !== undefined) setError("");
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy && photo ? "Preparing the photo…" : "Keep"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
