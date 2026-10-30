---
status: accepted
amends: ADR 0097 (in part — the Permissions-Policy allows the camera to Lifeline's own origin)
---

# The phone scans a book's barcode with the platform's own reader, so the camera is allowed for Lifeline's origin

The ISBN is the most precise thing printed on a book (ADR 0108), and on the phone typing thirteen digits is the slow part. The barcode on the back is that ISBN as an EAN-13, so the Library's Add dialog and Find metadata offer **Scan barcode** on the phone.

- **The platform reads the barcode.** The browser's `BarcodeDetector` (Chrome on Android, where the phone runs Lifeline) reads frames from the back camera a few times a second. No decoder ships with Lifeline: where the browser has no `BarcodeDetector` that reads EAN-13, or there is no camera, or it is the desk, the button is not shown and the ISBN is typed.
- **Only a book's code is searched.** An EAN-13 starting 978 or 979 (but not 979-0, sheet music's ISMN) with a valid check digit is an ISBN, and fills the search as a typed one would. Anything else (a shop's product code, the price add-on beside the ISBN, a QR code) is reported, and scanning goes on.
- **The camera is allowed for Lifeline itself.** ADR 0097's `Permissions-Policy` denied the camera outright; it now reads `camera=(self)`. Embeds and every other origin are still denied it, and the microphone and location stay denied. The stream stops as soon as an ISBN is read or the scan is stopped, and no frame is kept.

## Considered options

- **A JavaScript or WebAssembly decoder (ZXing) as a fallback**: rejected for now. It is several hundred kilobytes for one button on one device that already reads barcodes natively. It can sit behind the same button if a phone without `BarcodeDetector` ever becomes the one in use.
- **A photo through the file picker (`capture`)**: rejected. It still needs a decoder, and a live view that stops on the first ISBN is quicker than taking and confirming a picture.

## Consequences

- An Android Tauri build, if one comes back, needs the camera permission in its manifest and its webview's permission request granted before the button works there.
