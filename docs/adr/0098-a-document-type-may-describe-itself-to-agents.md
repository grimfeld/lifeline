---
status: accepted
---

# A document type may describe itself to agents

An agent reads a Document through the MCP server's `get_document` (ADR 0062), which answers with what Core knows of every Document: its fields, tags, folder and body. Some Documents mean more than their fields. A Project's worth is its Board: its Milestones and their progress, its Lanes with their Tasks in hand order, its next Task. Only the Projects App knows how to read those, and its Milestones and Lanes are internal types, refused by `get_document` outright.

**A document type may describe itself, and an internal type may name its owner.** `DocumentTypeDef` gains two optional hooks, both non-React and async:

- `describe(doc)` returns plain JSON, what the owning App's screens show of the Document beyond its fields. `get_document` merges it into its answer under `detail`. A type without one answers as before.
- `owner(doc)`, on an internal type, returns the Document that speaks for it. `get_document` on such an id answers as if asked for the owner, which must itself be within an agent's reach (not internal, not in the Private folder). An internal type without an owner is still refused.

The Projects App is the first to use both: a Project describes its stage, Outcome, dates, face, Milestones, Lanes with their Tasks, recurring Tasks and next Task, read by the same functions its screens use (`boardOf`, `progressOf`, `nextTaskOf`). Milestones and Lanes name their Project as owner. Internal types stay out of `search_documents` and `create_document`.

Only the MCP server reads these hooks. The UI keeps rendering through the App's own screens and Peek parts.

## Consequences

- The resolver that names a Milestone or Lane of one Project by id or title lives in the Tasks App (`resolveInProject`), not in Projects as the spec had it. Projects imports Tasks, never the reverse, and `tasks.add` takes a Milestone and a Lane too, so the shared code sits below both.
- The rule that a Task stands ticked in the done Lane and unticked in any other likewise lives in Tasks (`settleForLane`), used by the Board's drop and by `tasks.add`.

## Considered options

- **A Projects tool (`get_project_board`)**: rejected. It would be a second reading path beside `get_document`, and every App wanting the same would add its own tool. One hook on the type keeps `get_document` the one way in.
- **Making Milestones and Lanes visible types**: rejected. They exist only in a Project's service (ADR 0060), and listing them loose in search would show an agent pieces without the Board that orders them.
