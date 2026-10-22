import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { Button, PageHeader } from "@lifeline/ui";
import { eraseDevice } from "@lifeline/core";

/**
 * How the Demo starts (ADR 0077): "Loading…" while today's agenda and Home are
 * written, then the app, while the rest of the life is written behind it
 * (`./seed`). main.tsx calls this only in the Demo, so the real build drops it.
 */
export function startDemo(root: Root, app: ReactNode): void {
  root.render(
    <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm" role="status">
      Loading…
    </div>,
  );
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    root.render(app);
  };
  // A chunk of its own: only the Demo loads the made-up life.
  import("./seed")
    .then((m) => m.seedDemoIfNeeded(show))
    .then(show)
    .catch((err: unknown) => {
      // Never the app over a half-written life: the store is erased on "Try again".
      console.error("The Demo life could not be written", err);
      root.render(<SeedFailed error={err} />);
    });
}

/** In place of the app when the Demo life could not be written. */
function SeedFailed({ error }: { error: unknown }) {
  return (
    <div role="alert" className="mx-auto flex h-dvh max-w-md flex-col items-center justify-center gap-3 p-4 text-center">
      <PageHeader title="The Demo could not be set up" className="justify-center" />
      <p className="text-muted-foreground text-sm">
        Its made-up life was not written into this browser
        {error instanceof Error && error.message ? ` (${error.message})` : ""}. Trying again starts from an empty store.
      </p>
      <Button onClick={() => void eraseDevice()}>Try again</Button>
    </div>
  );
}
