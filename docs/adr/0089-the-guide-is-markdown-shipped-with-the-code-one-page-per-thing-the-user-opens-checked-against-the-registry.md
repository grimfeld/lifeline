---
status: accepted
amends: ADR 0053 (in part — Settings is no longer the only page that serves no Documents)
---

# The Guide is Markdown shipped with the code, one page per thing the user opens, checked against the registry

Lifeline has grown to some twenty-six Apps behind eleven Modules, three Surfaces and a dozen Core ideas (Bases, Screens, the Capture sheet, Peek, the Vault…). Nothing in the app says what exists or how to use it, and its own author forgets. So Lifeline gets a **Guide**: its manual, read inside the app.

**The pages are Markdown files in the repository** (`packages/guide/pages/`), bundled into the shell and the MCP server. They are never Documents. A change to a feature and the change to the page describing it land in the same PR, and an agent making the change can keep the page true. Text in the database could do neither.

**Pages follow what the user opens, never the Apps behind it.** There is one page per Module, with a part for each App it shelves, one per Surface, and one per Core concept, plus a home ("Getting around"). The Calendar App, which has no Module, is covered on the Calendar Surface's page, and Core's own Cards on the Screens page. A page has a fixed shape: what it is for, then what you can do (one line per Command, view or Card, with where to find it), Capture, Ask Claude, Tips and Related. Pages are text only, because a screenshot goes stale with any UI change and no test can tell.

**The Guide is a Core page**, `/guide` and `/guide/:page`. With Settings it is one of the two kinds of page that serve no Documents: Settings configures the app, the Guide explains it. It is reached from the foot of the Rail (and so from the phone drawer), from a "?" in the phone header, and through the palette, which lists every page as "Guide · <title>". The Rail's link and the "?" open the page for where the user stands: the open Module's, the Surface's, a Core page's own, or the home.

**A test keeps it current.** `shell/src/guide/guide.test.ts` fails when a Module or Surface has no page, when an App is answered for by no page or by more than one, or when the title of an App's Command or Card is not named on its page. A new feature is not done until the Guide says it exists. A deliberate omission is listed with its reason. Behaviour that changes under an unchanged title escapes the test, and is the agent instructions' job (`CLAUDE.md`, `packages/guide/AUTHORING.md`).

**Claude reads the same text.** The MCP server's `guide` tool returns the list of pages or one page, answered by the server itself with no Account's data.

## Considered options

- **Guide pages as Documents in the user's store**: rejected. Agents could not update them with the code, and every Account would hold its own copy, out of date.
- **A separate docs site**: rejected. The question "what can this do?" comes up while using the app, often on a phone, so the answer belongs one tap away. A site also drifts from the code with nothing to check it.
- **A page per App, or fragments in each App's directory stitched into Module pages**: rejected. The user never opens an App. One Module page assembled from five directories is harder to write as one coherent page than it is to edit in one file.
- **Instructions alone, no test**: rejected. A rule nothing checks is forgotten.
- **A "?" inside every Module's and Surface's own header**: rejected for now. Each Module draws its own chrome, so this would be eleven hand-placed buttons. One context-aware link in Core's chrome (the Rail and the phone header) does the same job.
