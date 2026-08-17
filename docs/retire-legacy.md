# Retiring the legacy apps (roadmap 5)

Lifeline replaces notch, nightstand, calendar, week-planner and chore-scheduler
(ADR 0001). Retirement is: deploy Lifeline's backend, import each app's data,
verify, then destroy the old Fly apps. Nothing here is automatic — the last
step is irreversible and is done by hand.

## State found on 2026-08-16

| Legacy app     | Backend                          | Reachable? | Data                                  |
| -------------- | -------------------------------- | ---------- | ------------------------------------- |
| notch          | `https://notch-pb.fly.dev`       | yes (200)  | on Fly — import needs the user login  |
| nightstand     | `https://nightstand.fly.dev`     | **no DNS** | never deployed or already gone; the source repo has no `pb_data` |
| calendar       | local PocketBase, `pb_data/` on disk | n/a    | 5 seed/test events — imported at will |
| week-planner   | local PocketBase, no `pb_data/` on disk | n/a | none found                            |
| chore-scheduler| local-only, no cloud             | n/a        | already ported in the tracer bullet   |

`flyctl` is not installed on this machine; install it (`brew install flyctl`)
before deploying or destroying anything.

## 1. Deploy Lifeline's backend

```sh
cd pocketbase && fly launch --no-deploy && fly volumes create pb_data --size 1 && fly deploy
# then: create the superuser + one `users` record in https://lifeline-pb.fly.dev/_/
```

## 2. Import

Importers live in `scripts/import/` (plain Node 22, no install). Each one
dry-runs by default (prints the mapped records) and writes with `--apply`;
re-running is idempotent because legacy 15-char ids are kept.

```sh
export LIFELINE_PB_URL=https://lifeline-pb.fly.dev LIFELINE_EMAIL=… LIFELINE_PASSWORD=…

# notch → stats + stat_entries
NOTCH_EMAIL=… NOTCH_PASSWORD=… node scripts/import/import-notch.mjs [--apply]

# nightstand → media (books). Only if the instance comes back or a pb_data backup turns up:
NIGHTSTAND_PB_URL=… NIGHTSTAND_EMAIL=… NIGHTSTAND_PASSWORD=… node scripts/import/import-nightstand.mjs [--apply]

# calendar → events (reads the old sqlite directly)
node scripts/import/import-calendar.mjs --sqlite ../calendar/pocketbase/pb_data/data.db [--apply]

# week-planner → tasks + task_occurrences (point it at a running old instance)
WEEKPLANNER_PB_URL=http://127.0.0.1:8090 node scripts/import/import-week-planner.mjs [--apply]

# Obsidian vaults → notes (reads the .md files on disk; see below)
OBSIDIAN_VAULTS="/path/to/Journal,/path/to/Journal on MacOS" node scripts/import/import-obsidian.mjs [--apply]
```

Mappings worth knowing: notch keeps kinds/colors/units 1:1 and converts `ts`
to ISO; nightstand `UNREAD/READING/READ` → `UNSTARTED/IN_PROGRESS/DONE`,
`work_key` → `openlibrary:<key>`, `pages` → `size`; calendar instants become
local day + `HH:MM`; week-planner weekdays shift from Mon=0 to Sun=0, and a
recurring task's `createdAt` is pulled back to its earliest override so old
completions still land on generated Occurrences.

### Obsidian vaults → notes

`import-obsidian.mjs` walks the two Journal vaults (`~/private/Obsidian/Journal`
and `…/Journal on MacOS` by default; override with `OBSIDIAN_VAULTS`, comma
separated) and maps folders to Note types (ADR 0009): a `YYYY-MM-DD.md` under
`Journal/` or `<year>/<Month>/` → **daily** (body verbatim, `createdAt` = the
date); `Personnes/`, `People/` → **person**; `Lieux/`, `Places/` (any depth) →
**place**; everything else — `Films/`, `Livres/`, `Jeux/`, `Séries/`, `Games/`,
`Shows/`, `Bands/`, `Characters/`, `Companies/`, `Home.md`, `Mementos.md`, week
notes… — → **plain**, skipped when the body (minus frontmatter) is empty.
`Templates/`, `.obsidian/` and non-`.md` files are ignored.

Person/place frontmatter is rewritten with a small YAML subset: `alias:` folds
into the `aliases` list, an empty `locations:` is dropped, and a place whose body
has a `[label](geo:LAT,LNG)` link gets `location: [LAT, LNG]` (ADR 0011) + `address: label`
(the original line stays). People/places present in both vaults are merged by
title (case-insensitive): aliases are unioned, non-empty bodies concatenated
with a blank line, the earliest file date wins. Same-title dailies keep the
longer copy and are logged. Daily frontmatter is untouched.

Unlike the other importers there are no legacy ids to keep — every note gets a
fresh id, so **run `--apply` once**; a second run duplicates the notes. The
summary (counts per type, skipped empties, merges) goes to stderr; the record
dump to stdout.

## 3. Verify

Open the shell against the deployed backend (`VITE_PB_URL=https://lifeline-pb.fly.dev pnpm build`),
sign in, and check counts on each App screen against the legacy app. Local
Dexie data merges by LWW, so a device that already has records is fine.

## 4. Destroy

Only after step 3, per app: `fly apps destroy notch-pb` (and any other that
still exists — `fly apps list`). Keep the legacy repos; their ADRs are cited
from Lifeline's.

Folders (ADR 0013): dailies land in `Journal/YYYY/MM`, people in `People`, places in `Places`; other notes keep their vault directory as their folder.
