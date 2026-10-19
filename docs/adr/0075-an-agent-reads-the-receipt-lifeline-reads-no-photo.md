# An agent reads the receipt; Lifeline reads no photo

ADR 0082 put Tesseract on the device behind one reader seam, an image in and a draft Receipt out, and expected a cloud model to replace it if it read too poorly. It did read too poorly: a receipt's columns, discounts and weights need a model that understands what it is looking at, not character recognition followed by a regex parser. Putting a vision model in the app would mean a PocketBase route holding an LLM API key, billed per scan. Instead, **the reading moves out of Lifeline**. The person hands the photo to an agent they already use (Claude on the phone, through the MCP server of ADR 0062), the agent reads it, and runs **Add receipt…** headless with the Receipt's Lines as structured arguments. Lifeline keeps no reader at all.

ADR 0082's rule that "the draft is always reviewed before it becomes a Receipt" survives in a new place. The person reviews what the agent read **in the conversation**, before the agent calls the tool, and the agent's call saves directly. There is no pending-draft state in the app: the unmatched inbox, the printed-total mismatch warning and the editable Receipt already catch what a review would, and an agent cannot delete.

## Considered options

- **A vision model behind a PocketBase route** — rejected: a key and a bill in the app for something the person's own agent does already.
- **Keep Tesseract as an offline fallback** — rejected: it was the thing not working, and the `parse.ts` heuristics would be kept alive for a path nobody uses.
- **The agent posts a draft that waits in the app for confirmation** — rejected: a second review on top of the conversation's, and a new Receipt state to build and explain.
- **A Prices-only MCP tool outside the Command registry** — rejected: ADR 0062 makes an agent's tools the Apps' own Commands, so the dialog and the agent run one operation.
- **Lines as a `json` argument validated by Prices** — rejected for a Core `rows` argument kind: the agent sees each column's label and hint in the schema, Core checks the types, and the next App with rows to capture gets it for free.
- **The receipt Command makes the Products it is missing** — rejected: whether "LAIT 1/2 ECR" is a new Product or an existing one is a decision, best taken (and asked about) explicitly by the agent, not a side effect.

## Consequences

- `tesseract.js`, the reader seam (`reader.ts`) and the text parser (`parse.ts`) are gone. "Scan receipt…" becomes **Add receipt…** (`prices.receipt`): the same Receipt dialog typed in by hand, still able to keep a photo; headless it takes `shop`, `date`, `total`, `branch` and `lines` (`label`, `price`, `amount`, `promo`, optional `product`).
- A Line matches the Product the agent names, otherwise the Shop's remembered labels, otherwise it waits in the inbox. A named Product learns the label, so the next receipt from that Shop resolves on its own.
- **New product…** and **New shop…** are headless (not capture): the agent makes what is missing first. A name already taken is refused, case and outer spaces aside — in the app's dialogs too.
- The one record that collides: a Receipt with the same Shop, day and non-zero printed total as an existing one is refused, wherever it is added from. Agents retry, and people send the same photo twice.
- The agent's answer carries the Line count, how many are unmatched and any gap between the Lines' sum and the printed total, so it can say "I probably missed a line".
- No photo travels over MCP. A Receipt an agent added has none until the person adds one in the app.
- Clearing the unmatched inbox stays in the app: no agent tool lists or matches Lines yet.
- CommandArg gains the `rows` kind with an `of` signature; the MCP schema renders it as an array of objects.
