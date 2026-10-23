import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";

/** Small text prompt (new folder, rename…). */
export function PromptDialog({
  open,
  title,
  label,
  initial = "",
  confirm = "OK",
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label?: string;
  initial?: string;
  confirm?: string;
  onOpenChange: (o: boolean) => void;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  async function submit() {
    if (!value.trim()) return;
    await onSubmit(value.trim());
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input aria-label={label} autoFocus placeholder={label} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={!value.trim()}>
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROOT = "__root__";

/** Pick a folder among the existing ones (root included). */
export function FolderPickerDialog({
  open,
  title,
  folders,
  initial = "",
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  folders: string[];
  initial?: string;
  onOpenChange: (o: boolean) => void;
  onSubmit: (folder: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Select value={value === "" ? ROOT : value} onValueChange={(v) => setValue(v === ROOT ? "" : v)}>
          <SelectTrigger aria-label="Folder" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROOT}>/ (root)</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={() => void onSubmit(value)}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
