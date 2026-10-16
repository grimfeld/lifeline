---
status: accepted
---

# One type, many Roles

A Person I know can also be an Author whose books sit in the Library; a film, a podcast episode, a person I heard speak can all be things I take Notes and Quotes from. Today a Document has exactly one `type` — an indexed column, branched on in about a hundred places — and that type alone decides its owner, title rule, body, Home Module, Peek and delete cascade.

A Document keeps **exactly one type** and may wear any number of **Roles**. A Role is a built-in type's fields and behaviour lent to a Document of another type: my user-defined Person `Ursula Le Guin` wears the **Author** Role, her books link to her, and Library counts her in its bibliographies. The type still decides owner, title, body and Home Module; a Role's fields belong to the App that defines the Role, so ownership stays whole on both sides. Taking a Role off keeps the Document and drops only that Role's fields. Every Role comes with a **home type** for Documents that are that and nothing else (Library's Author; the Notes App's Source for articles, podcasts, videos). **Source** and **Author** are the first Roles; my own words (Note, Quote, Thought, Day, Essay, Chapter) never wear Source.

## Considered options

- **True multi-typing (`types[]`)** — rejected: every per-type decision (owner, title rule, Home Module, title uniqueness, Peek, cascade) would need a rule for each pair of types, across the whole codebase.
- **Type inheritance (Author extends Person)** — rejected: Person is user-defined and Author built-in, and a built-in may never depend on user data (ADR 0019); inheritance also forces one hierarchy where a Document may be several unrelated things.
- **Same-as links between two Documents** — rejected: cheap, but still two Documents — two titles, two bodies, two places links land — merged only in display.

## Consequences

- The single `type` and everything branching on it stay; Roles add a `roles` set, Role fields, and Role-aware registry, link and Peek code.
- "Is a Source" and "is an Author" become questions about Roles, not types: Quote's old `mediaId` restriction to six work types gives way to "links to a Document wearing Source".
