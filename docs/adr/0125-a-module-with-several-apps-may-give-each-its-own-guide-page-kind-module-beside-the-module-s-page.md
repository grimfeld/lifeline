---
status: accepted
amends: ADR 0089 (in part — "one page per Module" admits a sub-page per App where a Module shelves several)
---

# A Module with several Apps may give each its own Guide page, kind module, beside the Module's page

ADR 0089 says Guide pages follow what the user opens, never the Apps behind it. World holds Contacts and Atlas side by side, and each is big enough that folding both into one page would bury the map and the Module's own idea. The People and Places pages were tagged `core` to slip past the rule, which misdescribed them: they are not Core concepts.

So where a Module shelves several Apps and one of them is too large for the Module's page, that App may have a page of its own, tagged `kind: "module"` like the Module's, and named from the Module's page. The Module's page stays the one the Guide opens for the Module (`module:` is set on it alone). Every other Module keeps one page; this is the exception, not a licence for a page per App. World is the first: `world` (the Module), `people` (Contacts), `places` (Atlas).

`kind: "core"` is for ideas of Core itself (Bases, Peek, the Vault), never an App's page.
