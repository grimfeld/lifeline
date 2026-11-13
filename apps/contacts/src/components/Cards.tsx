import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { Button, Tip, cn } from "@lifeline/ui";
import { Check, Pencil, Plus, X } from "lucide-react";

/**
 * Whether the Person page is in Edit (#422): reading by default, where a
 * number calls and a name opens; in Edit each row opens its dialog and gets
 * Remove and, where it has one, Former. Adding works either way.
 */
const EditingContext = createContext(false);
export const EditingProvider = EditingContext.Provider;
export const useEditing = () => useContext(EditingContext);

/** The page's Edit / Done switch. */
export function EditToggle({ editing, onChange }: { editing: boolean; onChange: (editing: boolean) => void }) {
  return (
    <Button variant={editing ? "default" : "secondary"} size="sm" onClick={() => onChange(!editing)}>
      {editing ? (
        <>
          <Check /> Done
        </>
      ) : (
        "Edit"
      )}
    </Button>
  );
}

/** A card of rows: one bordered box, a line between rows. */
export function CardList({ children }: { children: ReactNode }) {
  return <ul className="divide-y min-w-0 rounded-lg border">{children}</ul>;
}

/**
 * One row of a card. Reading, it shows `title` (a link, when it acts) over
 * `sub`. In Edit, the row itself opens its dialog (`editLabel`), with Remove
 * before it and Former after it.
 */
export function CardRow(props: {
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  editLabel: string;
  onEdit: () => void;
  removeLabel: string;
  onRemove: () => void;
  former?: boolean;
  formerLabel?: string;
  onFormer?: () => void;
  /** Shown in both modes, after the text: an action the row always offers. */
  extra?: ReactNode;
  /** A test's handle on the row, as `data-testid`. */
  testId?: string;
}) {
  const editing = useEditing();
  const { icon, title, sub, editLabel, onEdit, removeLabel, onRemove, former, formerLabel, onFormer, extra, testId } = props;
  const text = (
    <>
      {/* pr-1: a long unbroken word can overshoot its line by a pixel or two; the room keeps it inside the box. */}
      <span className="block min-w-0 pr-1 text-sm break-words">{title}</span>
      {sub && <span className="text-muted-foreground block min-w-0 text-xs break-words">{sub}</span>}
    </>
  );
  // The row is about to go: hand focus to the next row's main control (the Add row at the end), or the keyboard falls to the page.
  const removeAndKeepFocus = (e: MouseEvent<HTMLButtonElement>) => {
    const li = e.currentTarget.closest("li");
    const next = li?.nextElementSibling?.querySelector<HTMLElement>("[data-row-focus]") ?? li?.previousElementSibling?.querySelector<HTMLElement>("[data-row-focus]");
    next?.focus();
    onRemove();
  };
  return (
    <li className="flex min-w-0 items-center gap-3 px-3 py-2" data-testid={testId} data-former={former || undefined}>
      {editing && (
        <Tip label={removeLabel}>
          <Button variant="destructive" size="icon-xs" onClick={removeAndKeepFocus}>
            <X />
          </Button>
        </Tip>
      )}
      <span className="text-muted-foreground shrink-0" aria-hidden>
        {icon}
      </span>
      {editing ? (
        <button type="button" data-row-focus aria-label={editLabel} onClick={onEdit} className="hover:bg-accent focus-visible:ring-ring -my-1 min-w-0 flex-1 rounded-md py-1 text-left focus-visible:ring-2 focus-visible:outline-none">
          {text}
        </button>
      ) : (
        <span className={cn("min-w-0 flex-1", former && "text-muted-foreground")}>{text}</span>
      )}
      {extra}
      {editing && onFormer && formerLabel && (
        <Tip label={formerLabel}>
          <Button variant="secondary" size="xs" onClick={onFormer}>
            {former ? "Current" : "Former"}
          </Button>
        </Tip>
      )}
      {editing && <Pencil className="text-muted-foreground size-3.5 shrink-0" aria-hidden />}
    </li>
  );
}

/** The last row of a card: add one more. */
export function AddRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" data-row-focus onClick={onClick} className="text-primary hover:bg-accent focus-visible:ring-ring flex w-full min-w-0 items-center gap-3 rounded-b-lg px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none">
        <Plus className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">{children}</span>
      </button>
    </li>
  );
}
