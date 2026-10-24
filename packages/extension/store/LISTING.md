# Lifeline extension: store listings

Drafts for the Chrome Web Store and Firefox Add-ons (#125). The privacy disclosure is
in `PRIVACY.md`. Submitting is manual: it needs the developer accounts, and each
store reviews the extension.

## Name and summary

- **Name:** Lifeline (from `src/manifest.ts`; it must match the manifest)
- **Summary** (Chrome ≤ 132 characters, Firefox ≤ 250). This is the manifest's
  `description`:
  > Send the page in front of you — or what you selected on it — to Lifeline, as a Task, a Quote, an Event…
- **Category:** Chrome: Productivity › Workflow & planning. Firefox: Productivity.

## Description

> Keep what you find on the web in Lifeline, without copying and pasting.
>
> Select a passage, right-click, and choose **Send to Lifeline › Quote**: it arrives as
> a Quote, with its links, emphasis and lists kept, and with the author and date the
> page declares. Send a booking confirmation as an **Event**, a request in an email as
> a **Task**, a word you just met as a **Word** to learn. The menu lists every kind of
> Document Lifeline can make from what you send.
>
> Nothing selected? The toolbar button or **Alt+Shift+L** (rebindable) sends the page's
> title and link, and Lifeline asks what to make of it.
>
> Lifeline opens in a small window over the page, with its own dialog already filled
> in. You finish it in Lifeline's words, pick the Workspace if you have several, and
> save. The window closes and you're back where you were. Nothing is written until
> you save.
>
> **Private by design.** The extension reads a page only when you send it, and only
> the selection, title, URL and the author and date the page declares. It sends them
> to your Lifeline and nowhere else, keeps no copy, and holds no password or token. It
> uses the Lifeline sign-in you already have.
>
> Requires a Lifeline account at lifeline.grimfeld.tech.

## Images

| Asset | Chrome | Firefox | Source |
| --- | --- | --- | --- |
| Icon | 128×128 PNG | from the package | `static/icon-128.png` |
| Screenshots | 1–5, 1280×800 or 640×400 | 1+, any size | to take (below) |
| Small promo tile | 440×280 (optional) | — | to make |

Screenshots to take on the deployed Lifeline, desktop, light theme:

1. A selected passage on an article, with the context menu open on **Send to Lifeline › Quote**.
2. The Handoff window over the page, with the Quote dialog filled in (text, author, date, source).
3. An email in Gmail on the web sent as a Task: the Task dialog prefilled.
4. The Handoff page asking which Intake to use (sent from the toolbar button, nothing selected).

## Chrome Web Store: privacy practices tab

- **Single purpose:** Send the current page or selection to the user's Lifeline as a new Document.
- **Permission justifications:** copy the table in `PRIVACY.md`.
- **Remote code:** No. Everything runs from the package.
- **Data usage:** tick *Website content* (the selection, title and URL, sent only at the
  user's request). Certify that it isn't sold, isn't used for anything unrelated to
  the single purpose, and isn't used for creditworthiness.
- **Privacy policy URL:** `PRIVACY.md` at its GitHub URL on master, or the same text on a page of the Lifeline site.

## Firefox Add-ons

- **Add-on id:** `send-to-lifeline@grimfeld.tech` (`GECKO_ID`). Never change it after the first upload.
- **Source code:** the upload is bundled by Vite, so AMO asks for the source. Upload
  a zip of the repository at the tagged commit, and give these build steps:
  `pnpm install && pnpm --filter @lifeline/extension build`, output in
  `packages/extension/dist/firefox`.
- **Data collection:** none is sent anywhere except the user's own Lifeline, at their request (see `PRIVACY.md`).

## Submitting

- [ ] Chrome Web Store developer account opened (one-time fee) and Firefox Add-ons account opened
- [ ] `version` raised in `src/manifest.ts` if this isn't the first upload (each store refuses a version it already has)
- [ ] `pnpm --filter @lifeline/extension build`, then zip the *contents* of `dist/chrome` and of `dist/firefox`, with `manifest.json` at the root of each zip
- [ ] Screenshots taken (above)
- [ ] Chrome: upload the zip, then fill in the listing, privacy tab and distribution (public)
- [ ] Firefox: upload the zip and the source zip, then fill in the listing
- [ ] Both pass review
- [ ] The repository README links both listings, and #125 is closed
