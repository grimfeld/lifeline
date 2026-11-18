import { useDocument } from "@lifeline/core";

/**
 * Where an Event happens, as a list shows it (ADR 0128): "At Chez Janou", or
 * "At Marc Lefèvre" for a Person's home — their name, never their Address.
 * Nothing when the Event has no At, or its Place or Person is gone.
 */
export function useAtTitle(at: string | undefined): string | undefined {
  const doc = useDocument(at || undefined);
  return doc && !doc.deleted ? doc.title : undefined;
}

/** The At of an Event in a line of text: " · At Chez Janou", or nothing. */
export function AtText({ at, lead = " · " }: { at: string | undefined; lead?: string }) {
  const title = useAtTitle(at);
  return title ? (
    <>
      {lead}At {title}
    </>
  ) : null;
}
