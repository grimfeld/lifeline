# Lifeline extension: privacy

This is the privacy disclosure for both store listings (#125). Paste it as the
privacy policy, and use its parts for the Chrome Web Store's "Privacy practices"
tab and Firefox Add-ons' data-collection answers. If the extension changes what
it reads, change this page in the same PR.

## What the extension reads

Only when you choose **Send to Lifeline** (the context menu, the toolbar button or
its keyboard shortcut), and only from the tab you sent it from:

- the text you selected, if any, as markdown;
- the page's title and URL;
- the author and publication date the page itself declares in its `<meta>` tags,
  if it declares them. Nothing is guessed.

Before you send, it reads nothing from any page. It has no content scripts, and it
reads a page only through the `activeTab` permission your click grants.

## Where it goes

To Lifeline (`https://lifeline.grimfeld.tech`) and nowhere else. The extension opens
Lifeline's Handoff page in a small window, with what it read placed in the address's
`#` fragment. A browser never sends the fragment to a server, so the page reads it
in your browser. Nothing is written to your Lifeline until you save the dialog that
page opens. If you cancel, nothing is kept.

## What it stores

- **Nothing you send.** The extension keeps no copy of any text, title, URL or
  page. It has no history.
- **Lifeline's list of Intakes** (Quote, Task, Event…), fetched from Lifeline and
  kept in the browser's extension storage, so the context menu can show it when
  Lifeline cannot be reached. It holds no personal data.

It holds no token, password or cookie of its own. Lifeline's Handoff page uses the
sign-in you already have in that browser.

## What it never does

- It sends nothing to any third party: no analytics, no crash reporting, no ads.
- It doesn't sell, share or transfer data, and doesn't use it for anything
  except creating the Document you chose.
- It never reads a page you did not send, and never runs in the background on
  pages.

## Permissions, and why

| Permission | Why |
| --- | --- |
| `activeTab` | To read the tab you sent, at the moment you send it. |
| `scripting` | To run the one reader script in that tab when you send it. |
| `contextMenus` | For "Send to Lifeline › Quote / Task / Event…" on the right-click menu. |
| `storage` | To keep Lifeline's Intakes list for the menu (above). |
| Host `https://lifeline.grimfeld.tech/*` | To fetch the Intakes list, and to close the Handoff window once the dialog saves. |

## Contact

Questions: open an issue at https://github.com/grimfeld/lifeline/issues.
