import { useEffect, useRef, useState } from "react";
import { Button } from "@lifeline/ui";
import { attachmentUrl, useAttachments } from "@lifeline/core";
import { Play } from "lucide-react";

/** The Attachment a clip id stands for, once the live list holds it. */
function useClipUrl(clipId: string | undefined): string | null {
  const attachments = useAttachments();
  const att = clipId ? attachments.find((a) => a.id === clipId && !a.deleted) : undefined;
  const [url, setUrl] = useState<string | null>(null);
  const attFile = att?.file;
  useEffect(() => {
    if (!att) return void setUrl(null);
    let alive = true;
    attachmentUrl(att)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the Attachment's id and file: the record object is new on every read
  }, [att?.id, attFile]);
  return url;
}

/**
 * An item's clip (ADR 0116) beside its revealed answer: plays once as it
 * mounts (a reveal is a tap or a key, which lets the browser play sound) and
 * has a button to hear it again. Nothing renders without a clip, so an item
 * without one reveals exactly as before.
 */
export function ClipPlayer({ clipId, autoPlay = true }: { clipId: string | undefined; autoPlay?: boolean }) {
  // One player per clip: a new clip starts afresh, never on the last one's url or played-state.
  return <ClipPlayerFor key={clipId} clipId={clipId} autoPlay={autoPlay} />;
}

function ClipPlayerFor({ clipId, autoPlay }: { clipId: string | undefined; autoPlay: boolean }) {
  const url = useClipUrl(clipId);
  const audio = useRef<HTMLAudioElement>(null);
  const [played, setPlayed] = useState(0);
  const started = useRef(false);

  function play() {
    const el = audio.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }

  useEffect(() => {
    if (!url || !autoPlay || started.current) return;
    started.current = true;
    play();
  }, [url, autoPlay]);

  if (!clipId) return null;
  return (
    <div className="flex justify-center">
      <Button type="button" size="sm" variant="outline" disabled={!url} onClick={play} data-testid="clip-replay" data-plays={played}>
        <Play /> {url ? "Replay" : "Loading clip…"}
      </Button>
      {url && <audio ref={audio} src={url} preload="auto" onPlay={() => setPlayed((n) => n + 1)} data-testid="clip-audio" />}
    </div>
  );
}

/** The clip's audio element with controls, for the dialogs: hear it before keeping it. */
export function ClipPreview({ clipId }: { clipId: string }) {
  return <ClipPreviewFor key={clipId} clipId={clipId} />;
}

function ClipPreviewFor({ clipId }: { clipId: string }) {
  const url = useClipUrl(clipId);
  if (!url) return <span className="text-muted-foreground text-sm">Loading clip…</span>;
  return <audio src={url} controls aria-label="Clip preview" preload="metadata" className="h-10 w-full min-w-0" data-testid="clip-preview" />;
}
