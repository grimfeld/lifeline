# Pantry counts Provisions per Storage — no batches, no events

The Pantry App tracks what food the household holds. Its unit is the **Provision**: one Document per product *per Storage*, carrying a plain integer quantity (with an optional free-text unit label), an optional Minimum, and two optional dates — *expires*, a check-by hint meaning "the earliest unit you own", and *frozen on*. Storages are user-defined Documents ("Chest freezer", "Spice rack") of exactly one kind — freezer, fridge or shelf — and a product split across two places is simply two Provisions. Quantity changes are pure counter mutations: no per-pack batches, no consumption events, no Daylog or Loggable reporting. The deciding constraint is bookkeeping cost: a stock app is only as truthful as the discipline it demands, and a one-tap stepper is the most a grocery run will get. Quantity 0 keeps the Provision — it is a catalog entry that is out of stock, and with a Minimum set it surfaces in the *running low* reading, which is always derived, never a list you edit.

## Considered options

- **Per-unit/batch Documents with individual expiry dates** — rejected: honest for a freezer (packs frozen on different days) but the bookkeeping tax lands on every yogurt and every pasta bag, and stale records lie worse than absent ones. The single *expires* date is deliberately a hint, not an inventory.
- **Quantity split per location inside one product Document** — rejected: reintroduces the batch structure through the back door; two Documents are simpler than one structured counter.
- **Fuzzy levels (full/ok/low/out) instead of counts** — rejected as the primary model: great for staples, useless for "how many pizzas left". May return someday as a per-Provision toggle, but two quantity models in one App need proof of pain first.
- **Daylog/Loggable integration for restocks and run-outs** — rejected: daily grocery churn would drown the Daylog's real facts. Additive later if wanted; nothing in the model blocks it.

## Consequences

- Expiry precision is capped by design: the App can say "check the chicken", never "pack 3 of 4 expires Thursday".
- A new core nav group **Home** is added; Pantry lives there and Chores moves there from Planning.
- "Shopping list" stays a Library term (books); Pantry's word is the *running low* reading, backed by the per-Provision **Minimum**.
