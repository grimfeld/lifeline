import { PhoneDock, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";

/** The spans a statistics screen reads over (ADR 0084); 0 months = All. */
export const SPANS: readonly { months: number; label: string }[] = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
  { months: 0, label: "All" },
];

/** The one span every figure on a screen shares — the Product page's and the Overview's — in the Phone dock on a phone. */
export function SpanPicker({ months, onChange }: { months: number; onChange: (months: number) => void }) {
  return (
    <PhoneDock order={1}>
      <ToggleGroup value={String(months)} onValueChange={(v) => onChange(Number(v))} aria-label="Span" className="justify-self-start">
        {SPANS.map((s) => (
          <ToggleGroupItem key={s.months} value={String(s.months)} aria-label={s.label}>
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </PhoneDock>
  );
}
