import { Card, CardContent, CardHeader, CardTitle, cn } from "@lifeline/ui";
import { appById, cardById, cardSchema, resolveSettings, type CardSettings } from "@lifeline/core";

/** Grid row height the Cards were sized against on Screens (~40px). */
const ROW = 40;

/**
 * One App Card placed by a hand-written Module (ADR 0057): the Module chooses
 * which Cards and where, the owning App draws them. Sized from the Card's own
 * default height, since Cards are written for a fixed frame.
 */
export function ModuleCard({ cardId, settings, title, className }: { cardId: string; settings?: CardSettings; title?: string; className?: string }) {
  const def = cardById(cardId);
  if (!def) return null;
  const resolved = resolveSettings(cardSchema(def), settings ?? {});
  const Component = def.component;
  const body = <Component settings={resolved} configure={() => {}} />;
  return (
    <Card className={cn("gap-2 overflow-hidden py-3", className)} style={{ height: def.defaultSize.h * ROW }}>
      <CardHeader className="px-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="size-2 shrink-0 rounded-full" style={{ background: appById(def.appId)?.color ?? "var(--muted-foreground)" }} />
          <span className="truncate">{title ?? def.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden px-3">
        {body}
      </CardContent>
    </Card>
  );
}
