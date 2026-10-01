# The Projects Module: declared outcomes, per-Project Lanes, no subtasks

The Tasks Module becomes the **Projects Module**: the Tasks App beside a new Projects App. A **Project** is an outcome the user can declare finished — never an ongoing area, which Tags, Workspaces and Modules already cover. Its shape follows from three choices, each against a common alternative.

- **Done is declared, never derived.** A Project moves through five stages (Planned, Active, Paused, Done, Dropped) only by the user's hand. Ticking its last Task *offers* to finish it. The outcome is not the task list: the last tile laid reveals cracked grout, and a Project that closed itself would have to be reopened. Milestones follow the same rule.
- **A Task belongs to at most one Project, by a link on the Task.** The Project keeps no list; its Tasks, like an Author's works, are what link to it. Many-to-many was rejected because one tick would count as progress in two Projects. Recurring Tasks may belong to one, but they have no single done state, so they count toward no progress and stand on no Board.
- **Lanes are user-defined and belong to one Project.** Each Project has its own kanban flow ("Quote → Ordered → Delivered → Installed"), seeded with To do / Doing / Done. One Lane may be the done Lane, which ticks the Task through the Tasks App. Hand order within a Lane is the priority; there is no priority field.

## Considered options

- **Fixed lanes (To do / Doing / Waiting) on every Task.** Rejected by the user in favour of flows that fit each Project. The cost is that no Board crosses Projects, and loose Tasks have none. Across Projects, the Module shows the Projects themselves by stage.
- **One global set of user-defined lanes.** Rejected. User-defined columns only pay off when they fit the work, and a global set drifts back to a generic To do / Doing / Done.
- **Subtasks.** Rejected. Work big enough to have parts is a Milestone or a Project. A tree would also force answers to questions with no good answer: does the parent go on the Schedule, and does ticking a child roll up?
- **Cascade on delete.** Rejected. Deleting a Project *releases* its Tasks, which stay as loose Tasks with their done ones still the record of their days. Dropped is how a Project is let go; delete is for mistakes.

## Consequences

- The Task gains `project`, `milestone`, `lane` and a hand `rank`. These are guarded and owned by the Tasks App. Moving a Task to another Project clears its Milestone and puts it in the new Project's first Lane.
- Milestones and Lanes are internal Documents of the Projects App. They follow their Project across Workspaces, and a moved Project takes its Tasks with it (ADR 0048).
- The Writer's pad's free-text `project` field is retired in favour of Folders (`Writings/<name>`), so the word means one thing.
