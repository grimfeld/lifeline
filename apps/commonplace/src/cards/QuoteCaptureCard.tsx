import { useMemo } from "react";
import type { CardProps } from "@lifeline/core";
import { CaptureForm, useCaptureSources } from "../components/CaptureForm";
import { familyOf } from "./quoteShared";

/** Card: take a Note or a Quote from the Source I'm in now (ADR 0070) — the family knob narrows nothing but the default. */
export function QuoteCaptureCard({ settings }: CardProps) {
  const family = familyOf(settings);
  const { current } = useCaptureSources();
  const first = useMemo(() => (family ? current.find((s) => s.family === family) : current[0]), [current, family]);
  if (current.length === 0) return <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-center text-sm">No Sources yet — add a book in Culture or an article in Notes.</div>;
  return (
    <div className="h-full min-h-0 overflow-y-auto p-1">
      <CaptureForm key={first?.id ?? ""} initialMode="quote" defaultSource={first?.id} />
    </div>
  );
}
