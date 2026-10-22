---
status: accepted
supersedes: ADR 0082 (in part — the measure)
---

# Prices measures are dimensions that can change, Sightings are prices not purchases, Overpaid compares across Shops

ADR 0082 fixed a Product's measure at creation, from three (kilogram, litre, piece). In use that was too tight both ways: eggs started as pieces and wanted weighing, spices wanted €/100 g, detergent wanted €/wash, and a croissant pack is honestly counted *and* weighed. A **Measure** is now a **dimension** — mass, volume, count or length — with the unit it is read in (g or kg, ml or L, m; a count may wear its own name: roll, wash, sheet). A count Product may declare one **secondary** measure, mass or volume, and a Line may then carry a second amount ("4 pc · 240 g"), prefilled from that Product's last Line at the same Shop. The Product chooses which of the two it is **compared by**; that one drives cheapest Shop, Price change, Overpaid and the chart, the other is shown beside it. Lines without the second amount are left out of the readings that use it.

The measure **can change**. Within a dimension the amounts convert and nothing is lost. Across dimensions (12 pc → kg) no factor is trustworthy — packs differ — so the change applies at once and every Line of the Product becomes **needs amount**: an inbox in the unmatched style, never blocking, whose Lines still count as spend but stay out of every per-unit reading until their amount is typed. Merging Products of different measures follows the same rules, so merge is no longer same-measure only.

The new statistics — spend, buying rhythm, Shop visits and basket — need to know what was *bought*, which a noticed shelf price is not. A **Sighting** is a Receipt marked noticed, not bought: it feeds every price reading (history, cheapest, change, the Overpaid baseline) and nothing about spending (spend, share, rhythm, visits, basket, being judged Overpaid); it never reports to the Daylog and the duplicate rule never applies. It is a mark on the Receipt rather than a type of its own, so price history stays made of one fact, the Line. **Add price…** makes a Sighting unless "Bought it" is ticked; existing one-Line Receipts with no printed total become Sightings, the rare hand-typed purchase among them fixed by unticking.

**Overpaid** is a cross-Shop *comparison*: a bought Line against the cheapest usual price at another Shop, on or before its day, no older than 90 days. ADR 0082 forbids a cross-Shop *change* figure because a switch of Shop is not inflation; that stands — comparing what one paid with what another Shop asked at the same time is a different question, and the one a shopper asks.

## Considered options

- **Free-text unit per Product, no dimensions** — rejected: €/wash reads well but a measure change could never convert, and g vs kg would be two units.
- **A conversion factor typed once for a cross-dimension change** ("1 pc = 0.06 kg") — rejected by the user: one guessed factor rewrites a year of history wrongly; amounts are re-typed per Line instead.
- **Block a cross-dimension change until every Line is re-typed** — rejected: a Product with 80 Lines makes the change a chore; the inbox lets it happen now and be finished later.
- **Weight per piece on the Product** — rejected: pack weights differ by Shop, which is the very thing €/kg should show.
- **"No printed total" means noticed** — rejected: a hand-typed purchase may have no total too; the mark is explicit.
- **Overpaid against any point ever** — rejected: a year-old price elsewhere says little about today.

## Consequences

- Supersedes ADR 0082's "Products fix only a measure (kg, L, piece)", "measure fixed after creation" and "Products merge (same measure only)". The rest of 0082 stands.
- `price_product` gains the dimension, the reading unit, an optional count name, an optional secondary dimension and compare-by; `price_line` gains an optional second amount and the needs-amount state; `price_receipt` gains the noticed mark. A PocketBase migration marks the existing Sightings.
- Derived, never stored, beside 0082's: spend and share, buying rhythm, price spread, promo saving (against the latest usual price at the same Shop), Overpaid, the Shop figures, the needs-amount inbox.
- Surfaces: the Product page gains spend, rhythm, spread and promo figures; the App screen gains a fourth reading, **Overview** — spend, Shops, Overpaid, promo saved — over one shared span (default 12 months, "All" included). Shop spend is the printed total, else the sum of Lines; share is over every bought Line, unmatched included.
