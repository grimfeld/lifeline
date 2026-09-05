import { useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { Camera, Image } from "lucide-react";
import type { ReceiptDraft } from "../domain/parse";
import { readReceipt, type ReadProgress } from "../domain/reader";
import { matchProduct } from "../domain/derive";
import { useProducts, useShops } from "../data/repo";
import { ReceiptDialog } from "./ReceiptDialog";

/**
 * "Scan receipt…" (ADR 0045): a photo goes through the reader seam on the
 * full-resolution file, the draft is matched to Products through label
 * memory, and the review dialog opens. Nothing is saved until the review
 * is confirmed; the photo is stored (downscaled) only then.
 */
export function ScanReceiptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const shops = useShops();
  const products = useProducts();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);

  async function read(f: File) {
    setFile(f);
    setProgress({ stage: "loading", progress: 0 });
    try {
      const d = await readReceipt(f, shops, setProgress);
      for (const l of d.lines) l.productId = matchProduct(products, d.shopId, l.label)?.id ?? "";
      if (d.lines.length === 0) toast.info("Nothing readable on that photo — the lines can be typed in");
      setDraft(d);
    } catch (e) {
      toast.error(`Could not read the receipt: ${(e as Error).message}`);
      setFile(null);
    } finally {
      setProgress(null);
    }
  }

  function closeAll(o: boolean) {
    if (o) return;
    setDraft(null);
    setFile(null);
    onOpenChange(false);
  }

  if (draft) return <ReceiptDialog open onOpenChange={closeAll} draft={draft} photo={file} />;

  const pct = progress ? Math.round(progress.progress * 100) : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan receipt</DialogTitle>
        </DialogHeader>
        {progress ? (
          <div className="grid gap-2 py-2">
            <p className="text-sm">{progress.stage === "loading" ? "Loading the reader…" : "Reading the receipt…"}</p>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-muted-foreground text-xs">{progress.stage === "loading" ? "The first scan on a device fetches the language data." : `${pct}%`}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="text-muted-foreground text-sm">Flat, well lit, the whole ticket in frame. You review every line before anything is saved.</p>
            <Button type="button" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" /> Take a photo
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Image className="size-4" /> Choose an image
            </Button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
