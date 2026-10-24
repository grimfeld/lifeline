---
status: accepted
---

# The Projects App may import the Tasks App, its partner in one Module; no other App imports another

No App imports another (ADR 0001, 0031, 0050): Apps work together only through Contracts defined by the Core. The codebase audit of 2026-10-22 found two exceptions. The Projects App imported `@lifeline/app-tasks` in fourteen places, and the Manuscript App imported the Version type id from the Writer (the Research App).

**Projects keeps its import of Tasks, as the one declared exception.** A Project is defined by its Tasks (ADR 0060). Its progress, its Board, its Lanes and its Milestones are all views of Tasks that link to it. The Projects Module shows its Board, Milestones and Peek with the Tasks App's own dialog and operations. Projects reads Tasks with `useTasks`, and changes them only through the operations the Tasks App exports: `addTask`, `placeTask`, `setCompleted`, `setTaskProject`, `releaseTasksOf` and the rest. So the Tasks App stays the only writer of a Task, and ownership is still whole. The dependency goes one way only: Tasks never imports Projects.

**The Version type id moves to `@lifeline/parts`.** The Writer still owns the Version type and registers it. The Manuscript App needs only its id, so that deleting a Chapter or a Manuscript takes the Chapter's Versions with it. A shared constant is enough for that, and no App import is needed.

`scripts/app-imports.test.mjs`, run by `pnpm check`, fails when an App's `package.json` or source names another App, except Projects naming Tasks.

## Considered options

- **A "task-like" Core Contract that Projects reaches Tasks through.** Rejected. It would have one implementer and one consumer, and it would have to carry the Task's whole shape and its dialog, so it would be the Tasks App's API under another name. Contracts are for Surfaces and Apps that do not know each other, such as the Calendar and every Schedulable type. Projects and Tasks know each other by design.
- **One App owning both Tasks and Projects.** Rejected. It would move a lot of code for no change the user can see, and Tasks also stand alone on every Surface, outside any Project.
- **A general rule that Apps sharing a Module may import each other.** Rejected. Money's Apps (Ledger, Pocket, Prices) and Culture's media Apps share Modules without needing to, and a general rule would make it easy to take the import instead of the Contract. The exception is named, and it stays one.

## Consequences

- `apps/projects/package.json` keeps `@lifeline/app-tasks`; `apps/manuscript/package.json` drops `@lifeline/app-writer` for `@lifeline/parts`.
- A new exception needs an ADR of its own and an entry in the allowed list of `scripts/app-imports.test.mjs`.
