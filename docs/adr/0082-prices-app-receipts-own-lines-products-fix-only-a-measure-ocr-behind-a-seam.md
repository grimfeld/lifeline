---
formerly: 0045
---

# Prices is its own App: Receipts own Lines, Products fix only a measure, the receipt reader sits behind one seam

Tracking what groceries and other regular purchases cost, per shop and over time, could have lived in the Ledger (a receipt import that also posts the Transaction) or in Pantry (Provisions gaining a price history). Both were rejected: the Ledger accepts only bank facts (ADR 0033, 0042) and a receipt total typed from a photo would duplicate the bank row that arrives later; Pantry chose a bare counter with no bookkeeping beyond a tap (ADR 0043) and receipt lines would reintroduce batches through the back door. The decision is a **separate App, Prices**, with no reference to either — the Pocket precedent (ADR 0081): a cross-App link can come later through a Contract if by-eye comparison is shown to hurt.

Its fact is the **Line**, internal to a **Receipt** (one Shop, one day, a printed total kept as read, an optional branch note, the photo embedded in an optional body as an Attachment). A Line carries the printed label, an amount, the price paid after discount and a promo flag, and is matched to at most one **Product**. A Product fixes only a **measure** (kg, L, piece) — not a pack size: the user chose fewer Products over cleaner rows, so a litre and a six-pack are one Product with different amounts, and every reading works on the derived **unit price**. A **Shop** is a chain, never a branch. Products remember the labels each Shop prints for them, so imports resolve on their own; unmatched Lines are an inbox in the Ledger's uncategorized style, never blocking a save. The **price change** reading is per Shop only (earliest to latest non-promo unit price in the span; median across Products for the whole), because a switch of Shop is not inflation.

The receipt photo is read by **Tesseract on the device** first, chosen over a vision model behind a PocketBase route because it costs nothing and needs no key; the user expects to switch to a cloud model if it reads too poorly. The reader therefore sits behind one seam — an image in, a draft Receipt (shop guess, date, total, lines) out — and nothing else in the App may depend on which reader produced the draft. The draft is always reviewed and confirmed before it becomes a Receipt; nothing is saved from OCR alone. OCR runs on the full photo before Core's Attachment downscale (2048 px would leave receipt print unreadable), and only the stored copy is shrunk.

## Considered options

- **Product carries a fixed pack size; a different size is a different Product** — rejected by the user: cleanest rows, too many Products. Measure on the Product plus amount on the Line keeps comparison honest at the cost of retyping the amount, which OCR mostly supplies.
- **Shelf price and discount both recorded, paid derived** — rejected: doubles entry for a number the surrounding non-promo points recover; paid plus a flag is what the receipt proves.
- **Save the OCR result at once, correct later** — rejected: Tesseract will misread often enough to fill history with noise before it is noticed.
- **A Core attachment field kind so the photo is a proper field** — deferred: widens what an Attachment is for one App; the body embed costs nothing new. Reopen when a second App needs a file field.
- **Basket comparison across Shops** — deferred, additive over the same Lines.
- **Delete a referenced Product and drop its Lines to unmatched** — rejected: a slip loses a year of matching; merge instead.

## Consequences

- Types: `product` (Linkable, Taggable, bodiless, measure fixed after creation, remembered labels per Shop as an App-guarded field), `shop` (Linkable, Taggable, bodiless), `receipt` (Taggable, optional body, derived title "Lidl · 4 Sept 2026", Daylog), internal `receipt_line` (bodiless, `receipt` and optional `product` links, label, amount, cents, promo). Amounts in cents in the app-wide currency, as the Ledger's and Pocket's are.
- Derived, never stored: unit price, a Product's history per Shop, cheapest Shop, sum of Lines and its mismatch with the printed total, the price change reading, the unmatched inbox.
- Lifecycle: deleting a Receipt deletes its Lines (Pocket precedent); deleting a referenced Product or Shop is blocked; Products merge (same measure only), carrying Lines and labels; unmatching a Line forgets that label on the Product.
- Surfaces: one App screen with three readings — Product history (unit price per Shop over time, promo points marked, latest non-promo per Shop), Receipt register with the unmatched filter, and the price change reading over a chosen span; one configurable Card, **Product price**; two capture Commands, **Scan receipt…** and **Add price…**. Recent receipts and the inbox count are a View card and a Count tile, no App code.
- Nav: Prices joins the **Money** group beside Ledger and Pocket.
- `tesseract.js` is a new shell dependency loaded lazily on first scan; its language data is fetched from the network, so the first scan on a device is online-only. If the reader is replaced by a cloud model, the seam, the review dialog and this ADR's second paragraph are what change.

## Amendment (2026-10-18): Lifeline reads no photo

Superseded by ADR 0075 in the part about the reader: the third paragraph (Tesseract on the device, the reader seam, OCR before the downscale) and the `tesseract.js` consequence. Tesseract read too poorly, and the reading moved to the person's own agent, which runs **Add receipt…** headless over MCP; "Scan receipt…" is gone. The rule that a reading is reviewed before it is saved stands — by the person with the agent, in the conversation.

## Amendment (2026-10-19): measures change

Superseded by ADR 0084 in the part about the measure: a Product's measure is a dimension (mass, volume, count, length) with a reading unit, a count Product may carry a secondary measure, the measure can change after creation, and Products of different measures merge. ADR 0084 also adds the Sighting (a Receipt marked noticed, not bought) and the Overpaid comparison, which leaves the per-Shop-only price change untouched.
