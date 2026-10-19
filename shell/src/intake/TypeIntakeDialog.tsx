import { useEffect, useState } from "react";
import { createFromHandoff, setCurrentWorkspace, singularOf, useCurrentWorkspaceId, useDocumentType, useWorkspaces, type IntakeDialogProps } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { TemplateSelect } from "@lifeline/editor";
import { Lock } from "lucide-react";

/**
 * Core's generic Intake (ADR 0086): a Handoff becomes a Document of a
 * user-defined type — a Place from a restaurant's page. The form holds the
 * title (the Handoff's), a Template when the type has a choice of them, and
 * the Workspace when there is more than one. Nothing is written until it
 * saves; the origin URL goes into the type's url Field, else the body.
 */
export function TypeIntakeDialog({ open, onOpenChange, handoff, onSaved, type }: IntakeDialogProps & { type: string }) {
  const def = useDocumentType(type);
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspaceId();
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(handoff.title);
    setTemplateId("");
    setWorkspaceId("");
    setError("");
  }, [open, handoff]);

  const what = def ? singularOf(def) : "Document";
  const wsValue = workspaceId || current || workspaces[0]?.id || "";

  async function save() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      // A Document lands in the current Workspace: the choice becomes it first, as on the Handoff page.
      if (wsValue && wsValue !== current) setCurrentWorkspace(wsValue);
      const doc = await createFromHandoff({ type, title: t, handoff, templateId: templateId || undefined });
      toast.success(`${what} saved`);
      onSaved?.(doc.id);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New {what.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="type-intake-title">Title</Label>
            <Input
              id="type-intake-title"
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && void save()}
            />
          </div>
          <TemplateSelect type={type} value={templateId} onChange={setTemplateId} />
          {workspaces.length > 1 && (
            <Select value={wsValue} onValueChange={setWorkspaceId}>
              <SelectTrigger size="sm" aria-label="Workspace" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.separated && <Lock />}
                    <span className="truncate">{w.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {handoff.url && <p className="text-muted-foreground truncate text-xs">{handoff.url}</p>}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!title.trim() || saving} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
