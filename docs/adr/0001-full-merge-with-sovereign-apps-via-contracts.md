# Full merge into one app, with sovereign Apps integrating via Contracts

Five standalone apps (notch, nightstand, calendar, chore-scheduler, week-planner) are merged into one application, one backend, one schema — the alternatives (webview shell around untouched apps; monorepo of loosely federated modules keeping their own backends) were rejected because they make cross-app data cooperation impossible or brittle. Inside the merged app, domains stay sovereign: each App owns its entities and behavior, and interop happens only through Core-defined Contracts (first: Schedulable) that carry data shape *and* behavior hooks, so a consuming Surface (calendar) delegates semantics (what "completing" or "missing" a placement means) back to the owning App.

## Consequences

- chore-scheduler's founding "no cloud, no account" principle is deliberately abandoned; its local data is imported into the shared backend during its port.
- week-planner and calendar's task half dissolve into a single Tasks App; the week grid and calendar grid survive as Surfaces. Recurring Tasks are per-Occurrence only — period-reopen semantics are explicitly the Chore App's territory.
- The old apps retire one by one as each port reaches parity.
