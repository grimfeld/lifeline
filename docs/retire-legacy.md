# Retiring the legacy apps (historical note)

Lifeline replaced a handful of earlier single-purpose apps (ADR 0001). While they were being retired, a set of
one-off Node importers copied their data, and an Obsidian vault's notes, into Lifeline. Each importer mapped a
legacy app's records onto Lifeline's original per-App PocketBase collections. Migration
`1756400000_documents.js` dropped those collections in favour of the single `documents` table (ADR 0018), so
the importers could no longer run, and they have been removed.
