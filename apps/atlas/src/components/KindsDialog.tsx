import { useEffect, useState } from "react";
import { errorMessage } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { kindOptions } from "../domain/place";
import { saveKindOptions } from "../data/repo";

/** One Kind in the form: a stored one keeps its value through a rename; a new one has none yet. */
interface Row {
  value?: string;
  label: string;
}

/**
 * Rename and add Kinds (ADR 0119, #487 story 11): the list fits the user's
 * life (bakery, climbing gym…). A Kind is never removed, so no Place loses
 * its own; a renamed one keeps every Place that had it.
 */
export function KindsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(kindOptions().map((o) => ({ value: o.value, label: o.label })));
    setError("");
  }, [open]);

  async function save() {
    setBusy(true);
    try {
      await saveKindOptions(rows.filter((r) => r.value || r.label.trim()));
      toast.success("Kinds saved");
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kinds</DialogTitle>
          <DialogDescription>Rename a Kind, or add your own. A Kind is never removed, so no place loses its own.</DialogDescription>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <ul className="grid max-h-[50vh] min-w-0 gap-2 overflow-y-auto">
            {rows.map((r, i) => (
              <li key={r.value ?? `new-${i}`} className="min-w-0">
                <Field label={`Kind ${i + 1}`} hideLabel>
                  <Input
                    value={r.label}
                    placeholder="Bakery"
                    onChange={(e) => {
                      setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)));
                      setError("");
                    }}
                  />
                </Field>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => setRows([...rows, { label: "" }])}>
            <Plus /> Add kind
          </Button>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
