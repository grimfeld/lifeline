import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@lifeline/ui";
import {
  hasRequiredFields,
  cardSchema,
  isConfigured,
  registeredApps,
  resolveSettings,
  type CardDef,
  type CardSettings,
} from "@lifeline/core";
import { ArrowLeft, Search } from "lucide-react";
import { CardSettingsForm } from "./CardSettingsForm";

/**
 * "Add a card": Cards grouped by App with search. Cards with a required
 * setting open a configure step before being added (ADR 0008).
 */
export function CardPicker({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (cardId: string, settings: CardSettings) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [configuring, setConfiguring] = useState<CardDef | null>(null);
  const [draft, setDraft] = useState<CardSettings>({});

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registeredApps()
      .map((app) => ({
        app,
        cards: app.cards.filter(
          (c) => !q || c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q) || app.title.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.cards.length > 0);
  }, [query]);

  function reset() {
    setQuery("");
    setConfiguring(null);
    setDraft({});
  }

  function pick(card: CardDef) {
    if (hasRequiredFields(cardSchema(card))) {
      setConfiguring(card);
      setDraft(resolveSettings(cardSchema(card)));
      return;
    }
    void onAdd(card.id, resolveSettings(cardSchema(card)));
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {configuring ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setConfiguring(null)} aria-label="Back">
                  <ArrowLeft />
                </Button>
                Configure “{configuring.title}”
              </DialogTitle>
            </DialogHeader>
            <CardSettingsForm schema={cardSchema(configuring)!} value={draft} onChange={setDraft} />
            <DialogFooter>
              <Button
                disabled={!isConfigured(cardSchema(configuring), draft)}
                onClick={() => {
                  void onAdd(configuring.id, resolveSettings(cardSchema(configuring), draft));
                  reset();
                }}
              >
                Add card
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a card</DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input autoFocus placeholder="Search cards…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="-mr-2 grid max-h-[60vh] gap-4 overflow-y-auto pr-2">
              {groups.length === 0 && <div className="text-muted-foreground py-6 text-center text-sm">No cards match.</div>}
              {groups.map(({ app, cards }) => {
                const Icon = app.icon;
                return (
                  <section key={app.id} className="grid gap-1.5">
                    <h3 className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-medium tracking-wide uppercase">
                      <span className="size-2 rounded-full" style={{ background: app.color ?? "var(--muted-foreground)" }} />
                      {Icon && <Icon className="size-3.5" />}
                      {app.title}
                    </h3>
                    {cards.map((c) => (
                      <button
                        key={c.id}
                        className="hover:bg-accent flex items-start gap-3 rounded-lg border p-3 text-left"
                        onClick={() => pick(c)}
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {c.title}
                            {hasRequiredFields(cardSchema(c)) && <span className="text-muted-foreground font-normal"> · pick one</span>}
                          </span>
                          {c.description && <span className="text-muted-foreground block text-xs">{c.description}</span>}
                        </span>
                      </button>
                    ))}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
