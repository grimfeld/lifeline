// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Where "Scan barcode" is offered (#382), moved down from the e2e suite
 * (#583): on the phone only, with a camera, in a browser that reads EAN-13
 * itself. Scanning a book is library-barcode.spec.ts's.
 */

let phone = true;
vi.mock("@lifeline/ui", () => ({
  usePhone: () => phone,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}));

const { BarcodeScan } = await import("./BarcodeScan");

type Globals = { BarcodeDetector?: unknown };
const g = globalThis as Globals;

function detector(formats: string[]) {
  return class {
    static getSupportedFormats() {
      return Promise.resolve(formats);
    }
    detect() {
      return Promise.resolve([]);
    }
  };
}

function camera(devices: { kind: string }[]) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => Promise.reject(new Error("not here")), enumerateDevices: () => Promise.resolve(devices) },
  });
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  phone = true;
  g.BarcodeDetector = detector(["ean_13", "qr_code"]);
  camera([{ kind: "videoinput" }]);
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  delete g.BarcodeDetector;
});

async function offered(): Promise<boolean> {
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(<BarcodeScan onIsbn={() => {}} />));
  await act(async () => {});
  return document.body.textContent?.includes("Scan barcode") ?? false;
}

describe("Scan barcode is offered", () => {
  it("on a phone with a camera whose browser reads EAN-13", async () => {
    expect(await offered()).toBe(true);
  });

  it("never at the desk, even with a camera", async () => {
    phone = false;
    expect(await offered()).toBe(false);
  });

  it("not where the browser cannot read barcodes", async () => {
    delete g.BarcodeDetector;
    expect(await offered()).toBe(false);
  });

  it("not where the browser's reader takes no EAN-13", async () => {
    g.BarcodeDetector = detector(["qr_code"]);
    expect(await offered()).toBe(false);
  });

  it("not without a camera", async () => {
    camera([{ kind: "audioinput" }]);
    expect(await offered()).toBe(false);
  });
});
