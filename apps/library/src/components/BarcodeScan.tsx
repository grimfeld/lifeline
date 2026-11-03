import { useEffect, useRef, useState } from "react";
import { Button, usePhone } from "@lifeline/ui";
import { ScanBarcode } from "lucide-react";
import { readBarcode } from "../data/barcode";

/** The platform's Shape Detection API (Chrome on Android): not in TypeScript's DOM types yet. */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface DetectorClass {
  new (opts?: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

const detectorClass = () => (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;

/** What the scanner asks for: a book's EAN-13, and the codes it might be confused with, so they can be reported. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];

/**
 * Whether this device can scan a book: the phone, a camera, and a browser that
 * reads EAN-13 itself. No fallback decoder is shipped: where the platform cannot
 * read barcodes, the ISBN is typed.
 */
async function canScan(): Promise<boolean> {
  const Det = detectorClass();
  if (!Det || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const [formats, devices] = await Promise.all([Det.getSupportedFormats(), navigator.mediaDevices.enumerateDevices()]);
    return formats.includes("ean_13") && devices.some((d) => d.kind === "videoinput");
  } catch {
    return false;
  }
}

function useCanScan(): boolean {
  const phone = usePhone();
  const [able, setAble] = useState(false);
  useEffect(() => {
    if (!phone) return setAble(false);
    let live = true;
    void canScan().then((ok) => live && setAble(ok));
    return () => {
      live = false;
    };
  }, [phone]);
  return phone && able;
}

/**
 * "Scan barcode" for a lookup box, on the phone only: the back camera, read a
 * few times a second, until a book's ISBN shows (ADR 0108 — it finds the work,
 * and is never stored). Any other barcode is reported and scanning goes on.
 */
export function BarcodeScan({ onIsbn }: { onIsbn: (isbn: string) => void }) {
  const able = useCanScan();
  const [open, setOpen] = useState(false);
  if (!able) return null;
  if (!open)
    return (
      <Button variant="outline" size="sm" className="justify-start" onClick={() => setOpen(true)}>
        <ScanBarcode /> Scan barcode
      </Button>
    );
  return (
    <Scanner
      onClose={() => setOpen(false)}
      onIsbn={(isbn) => {
        setOpen(false);
        onIsbn(isbn);
      }}
    />
  );
}

function Scanner({ onIsbn, onClose }: { onIsbn: (isbn: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [note, setNote] = useState("Point the camera at the barcode on the back.");
  const found = useRef(onIsbn);
  found.current = onIsbn;

  useEffect(() => {
    const Det = detectorClass();
    if (!Det) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    let last = "";

    async function start() {
      try {
        const formats = (await Det!.getSupportedFormats()).filter((f) => FORMATS.includes(f));
        const detector = new Det!({ formats });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!live) return stream.getTracks().forEach((t) => t.stop());
        const el = video.current!;
        el.srcObject = stream;
        await el.play().catch(() => {});
        const tick = async () => {
          if (!live) return;
          const codes = await detector.detect(el).catch(() => []);
          const raw = codes[0]?.rawValue;
          if (raw && raw !== last) {
            last = raw;
            const read = readBarcode(raw);
            if ("isbn" in read) return found.current(read.isbn);
            setNote(`${read.notIsbn} is not an ISBN. Try the barcode that starts 978 or 979.`);
          }
          timer = setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch (e) {
        if (live) setNote((e as Error).name === "NotAllowedError" ? "Camera not allowed. Type the ISBN instead." : "The camera could not start. Type the ISBN instead.");
      }
    }
    void start();
    return () => {
      live = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="grid gap-2">
      <video ref={video} aria-label="Camera" muted playsInline className="bg-muted aspect-video w-full rounded-md object-cover" />
      <p className="text-muted-foreground min-w-0 text-xs break-words" role="status">
        {note}
      </p>
      <Button variant="ghost" size="sm" className="justify-start" onClick={onClose}>
        Stop scanning
      </Button>
    </div>
  );
}
