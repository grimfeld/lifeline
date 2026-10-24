import { useState } from "react";
import { ImageOff } from "lucide-react";
import { Button } from "@lifeline/ui";

/**
 * An image a body links from another site (#270). Loading it tells that site
 * your address and when you read the note, so a clipped page's tracking pixel
 * would report every reading: it waits for a click. "Always" trusts its host
 * on this device. Data URLs and Lifeline's own address load as they are.
 * Spans throughout: reading mode mounts it inside a paragraph.
 */
export function RemoteImage({ src, alt }: { src: string; alt?: string }) {
  const host = remoteHost(src);
  const [shown, setShown] = useState(() => !host || trustedHosts().has(host));
  if (shown || !host) return <img src={src} alt={alt} />;
  return (
    <span className="remote-image">
      <ImageOff className="text-muted-foreground size-4 shrink-0" />
      <span className="text-muted-foreground min-w-0 truncate">
        {alt ? `“${alt}” · ` : ""}image from {host}
      </span>
      <Button size="sm" variant="outline" onClick={() => setShown(true)}>
        Load
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          trustHost(host);
          setShown(true);
        }}
      >
        Always from {host}
      </Button>
    </span>
  );
}

const KEY = "lifeline:trustedImageHosts";

/** The host an image would be fetched from, or null when loading it reaches no other site. */
export function remoteHost(src: string, here: string = location.origin): string | null {
  let u: URL;
  try {
    u = new URL(src, here);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return u.origin === here ? null : u.host;
}

function trustedHosts(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function trustHost(host: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...trustedHosts().add(host)]));
  } catch {
    // Storage refused (a private window): it loads this once.
  }
}
