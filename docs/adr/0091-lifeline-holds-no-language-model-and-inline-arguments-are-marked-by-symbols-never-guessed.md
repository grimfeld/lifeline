---
status: accepted
---

# Lifeline holds no language model, and inline arguments are marked by symbols, never guessed


The palette could only find a Command and open its dialog; CONTEXT.md promised that "inline parsing may come later". We wanted to type a Command and its arguments in one line, and to talk to Lifeline in plain language.

**Lifeline holds no language model.** Plain-language requests belong to an agent outside Lifeline, which acts through the MCP server's headless Commands (ADR 0062), Macros included, and can make and change Macros there. Inside Lifeline every result is deterministic, works offline, costs nothing and sends nothing anywhere.

**Inline arguments are marked, never guessed.** In the palette, `!` marks the Command, wherever it sits in the line, and then each argument carries its own mark: `/` a date or time (read in English and French, with a preferred language settling words that mean different things in each, such as `mar`), `#` a select option or Tag, `@` a link by title, and `key:` any other argument by name. Unmarked words are the content (the first text argument), and quotes turn marks off. A mark counts only when a letter follows it straight away, so "Super !" stays text. Every mark autocompletes. The grammar is derived from each headless Command's argument signature, the same for every App, which can add keywords but no parser of its own. The palette shows what it understood before Enter. When something is missing or ambiguous, Enter opens the Command's dialog, pre-filled. One line runs one Command. Without `!`, the palette searches as before. One exception, ADR 0088: a query that is nothing but a date or a Journal period offers that period in the Journal, above the search results.

    !task call mum /fri 5pm #family

## Considered options

- **A model in the app reading free text into Commands**: rejected. It brings cost, latency, data leaving the device, and a different answer to the same words.
- **Rules that spot dates and options in bare words**: rejected. They steal words from titles ("Watch The Day After Tomorrow" gets a due date), and the user cannot see the rule that misfired.
- **Selecting the Command by search and Tab instead of `!`**: rejected. A mark is what lets the Commands autocomplete for someone who has not memorised them.
- **The palette handing unreadable text to an agent as a queued request**: deferred. It is a mailbox with no listener guaranteed.
