import { useState } from "react";
import { Button, Input, toast } from "@lifeline/ui";
import { parsePaypalCsv, paypalIndex, type PaypalIndex } from "../domain/paypal";

/**
 * Loading the PayPal activity file — shared by the import preview and the
 * later sweep, because both do exactly the same thing with it: read it, keep
 * it in memory for the length of the dialog, never store it.
 */
export function usePaypalFile() {
  const [index, setIndex] = useState<PaypalIndex | null>(null);
  const [fileName, setFileName] = useState("");

  function load(file: File) {
    void file.text().then((text) => {
      try {
        const entries = parsePaypalCsv(text);
        if (entries.length === 0) return void toast.error("That PayPal file has no readable rows");
        setIndex(paypalIndex(entries));
        setFileName(file.name);
        toast.success(`${entries.length} PayPal transactions read`);
      } catch (err) {
        setIndex(null);
        setFileName("");
        toast.error(err instanceof Error ? err.message : "That file could not be read");
      }
    });
  }

  function clear() {
    setIndex(null);
    setFileName("");
  }

  return { index, fileName, load, clear };
}

/** The file row itself: a picker before, the file name and a way out after. */
export function PaypalFileInput({ file }: { file: ReturnType<typeof usePaypalFile> }) {
  if (file.index) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="truncate">
          {file.fileName} · {file.index.entries.length} PayPal transactions
        </span>
        <Button size="sm" variant="ghost" className="h-6" onClick={file.clear}>
          Remove
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <Input type="file" accept=".csv,text/csv" className="h-8 text-xs" onChange={(e) => e.target.files?.[0] && file.load(e.target.files[0])} />
      <p className="text-muted-foreground text-xs">paypal.com → Activity → Download → CSV, covering the same months. Read here and thrown away — only the merchant names are kept.</p>
    </div>
  );
}
