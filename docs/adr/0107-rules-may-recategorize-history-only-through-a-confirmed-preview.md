---
status: accepted
---

# Rules may recategorize history, only through a confirmed preview


ADR 0040 refused applying rules retroactively over the ledger: a rule shapes what is *suggested*, and the Auto-categorize sweep covers the inbox. That left no way to move transactions that already carry a Category when a rule is added (Uber rides filed under Taxi by history, then a rule `uber → Uber`) short of recategorizing each by hand. The principle behind the refusal stands — nothing is written into the ledger unwitnessed — but a preview is a witness, so the refusal is narrowed: a Categorize rule may recategorize history, **only through a preview the user confirms**, never as a silent rewrite on save.

**Apply to history** is an action on each Category rule in the Rules tab (never on a never rule: a veto must not clear Categories already chosen). It lists every expense/income Transaction, all time and every Account, that the rule *decides* (precedence applied over all rules, so a stronger rule's rows are left out) and whose Category differs, inbox rows included. The user unticks exceptions and confirms; only ticked rows are written, one at a time through the existing set-the-category call, stopping and reporting how far it got on a failure.

## Considered options

- **Apply on save, silently** — rejected: it is the very rewrite ADR 0040 refused.
- **Use history's last-used reading to recategorize categorized rows** — rejected: read against already-categorized rows it is circular.
- **Store whether a Category was set by hand or by rule, and skip hand-set rows** — rejected: a schema change and a migration for what unticking in the preview already does.

## Consequences

- Past months' spending, Budget screens, Money reports and accumulating pots change; the preview states how many months it touches.
- The Auto-categorize sweep keeps its meaning: the uncategorized inbox only.
- The apply code returns the changes it made, with each previous Category, so an Undo can restore them exactly.
