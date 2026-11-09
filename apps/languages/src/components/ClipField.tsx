import { useEffect, useRef, useState } from "react";
import { Button, Label, toast } from "@lifeline/ui";
import { addAudioAttachment, deleteAttachment } from "@lifeline/core";
import { Mic, Paperclip, Square, Trash2 } from "lucide-react";
import { ClipPreview } from "./ClipPlayer";

/** Longest recording, in seconds: a clip is a word or a line, not a lecture. */
const MAX_RECORDING_SECONDS = 60;

const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function recorderType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * The clip a Word or Sentence dialog is editing (ADR 0116). Recording or
 * attaching stores the audio at once; the dialog's Save is what keeps it on the
 * item, so every Attachment made and not kept is deleted again — replaced
 * mid-edit, or the dialog closed without saving (a closed tab leaves it for
 * `sweepClipOrphans`). Replacing or removing a
 * clip already on the item is the repo's to clean up when Save writes it.
 */
export function useClipDraft(open: boolean, savedClip: string | undefined) {
  const [clip, setClip] = useState("");
  const made = useRef(new Set<string>());

  useEffect(() => {
    if (!open) return;
    setClip(savedClip ?? "");
    made.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seeds when the dialog opens
  }, [open]);

  async function drop(id: string) {
    made.current.delete(id);
    await deleteAttachment(id).catch(() => undefined);
  }

  async function put(file: Blob & { name?: string }) {
    const att = await addAudioAttachment(file);
    made.current.add(att.id);
    if (clip && made.current.has(clip)) await drop(clip);
    setClip(att.id);
  }

  /** Save went through (kept: the clip now on the item) or the dialog closed (kept: ""). Deletes what is not kept. */
  async function settle(kept: string) {
    for (const id of [...made.current]) if (id !== kept) await drop(id);
    made.current = new Set();
  }

  return { clip, remove: async () => { if (clip && made.current.has(clip)) await drop(clip); setClip(""); }, put, settle, reset: () => setClip("") };
}

/** Record in the browser or attach an audio file; hear it; re-record or remove it. */
export function ClipField({ clip, onPut, onRemove, idPrefix }: { clip: string; onPut: (file: Blob & { name?: string }) => Promise<void>; onRemove: () => Promise<void>; idPrefix: string }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // What a screen reader hears: the change of state only, never the running seconds.
  const [announced, setAnnounced] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!recorderType();

  function release() {
    if (stream.current) setAnnounced("Recording stopped");
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRecording(false);
  }

  // A dialog closing mid-recording lets go of the microphone.
  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== "inactive") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      release();
    },
    [],
  );

  async function start() {
    const type = recorderType();
    if (!type) return void toast.error("This browser cannot record — attach a file instead");
    let s: MediaStream;
    try {
      // The microphone is asked for here, when recording starts, never on opening the dialog.
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return void toast.error("Microphone not allowed — attach a file instead");
    }
    stream.current = s;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(s, { mimeType: type });
    recorder.current = r;
    r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    r.onstop = () => {
      release();
      const blob = new Blob(chunks, { type: r.mimeType || type });
      if (blob.size === 0) return;
      onPut(blob).catch((err: Error) => toast.error(`Could not keep the clip: ${err.message}`));
    };
    r.start();
    setSeconds(0);
    setRecording(true);
    setAnnounced("Recording");
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS && recorder.current?.state === "recording") recorder.current.stop();
    }, 1000);
  }

  function stop() {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  function attach(file: File | undefined) {
    if (picker.current) picker.current.value = "";
    if (!file) return;
    onPut(file).catch((err: Error) => toast.error(`Could not keep the clip: ${err.message}`));
  }

  return (
    <div className="grid gap-2">
      <Label id={`${idPrefix}-clip-label`}>Audio clip</Label>
      {clip && <ClipPreview clipId={clip} />}
      <span role="status" className="sr-only">
        {announced}
      </span>
      <div role="group" aria-labelledby={`${idPrefix}-clip-label`} className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" size="sm" variant="destructive" onClick={stop} aria-label="Stop recording">
            <Square /> Stop · {seconds}s
          </Button>
        ) : (
          canRecord && (
            <Button type="button" size="sm" variant="outline" onClick={() => void start()}>
              <Mic /> {clip ? "Re-record" : "Record"}
            </Button>
          )
        )}
        <Button type="button" size="sm" variant="outline" disabled={recording} onClick={() => picker.current?.click()}>
          <Paperclip /> {clip ? "Replace with a file" : "Attach a file"}
        </Button>
        {clip && !recording && (
          <Button type="button" size="sm" variant="ghost" onClick={() => void onRemove()}>
            <Trash2 /> Remove
          </Button>
        )}
        <input ref={picker} type="file" accept="audio/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => attach(e.target.files?.[0])} data-testid="clip-file" />
      </div>
      <span className="text-muted-foreground text-xs">Played whenever you reveal this one. Optional.</span>
    </div>
  );
}
