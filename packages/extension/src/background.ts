/**
 * The Lifeline extension's background (ADR 0080): Send to Lifeline from the
 * toolbar button, its shortcut (Alt+Shift+L, `_execute_action`) or the context
 * menu reads the page and opens the Handoff page in a small window, which it
 * closes when that window reaches the done address. Thin glue: what is sent is
 * reader.ts, where it goes is lifeline.ts, the menu's Intakes menu.ts.
 */
import { handoffUrl, type Handoff } from "@lifeline/handoff";
import { DEFAULT_LIFELINE_URL, HANDOFF_WINDOW, LIFELINE_URL_KEY, isDoneUrl, lifelineUrl, tabHandoff } from "./lifeline";
import { fetchIntakes, intakeOfMenuItem, menuEntries, type IntakesCache } from "./menu";

const MENU_CONTEXTS: chrome.contextMenus.CreateProperties["contexts"] = ["page", "selection", "link", "image", "frame", "editable"];
/** The storage.local key of the Intakes list last fetched (menu.ts). */
const INTAKES_KEY = "intakes";

/**
 * The menu, from the Intakes the person's Lifeline publishes (kept for when it
 * cannot be reached); plain Send to Lifeline when there are none. Rebuilt on
 * install, on browser start and when the Lifeline URL changes.
 */
async function buildMenu(): Promise<void> {
  const cache: IntakesCache = {
    get: async () => (await chrome.storage.local.get(INTAKES_KEY))[INTAKES_KEY] as Awaited<ReturnType<IntakesCache["get"]>>,
    set: (value) => chrome.storage.local.set({ [INTAKES_KEY]: value }),
  };
  const intakes = await fetchIntakes(await lifelineBase(), { fetch: (url) => fetch(url, { cache: "no-cache" }), cache });
  await chrome.contextMenus.removeAll();
  for (const { id, title, parentId, type } of menuEntries(intakes)) chrome.contextMenus.create({ id, title, parentId, type, contexts: MENU_CONTEXTS });
}
chrome.runtime.onInstalled.addListener(() => void buildMenu());
chrome.runtime.onStartup.addListener(() => void buildMenu());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && LIFELINE_URL_KEY in changes) void buildMenu();
});

chrome.action.onClicked.addListener((tab) => void send(tab));
chrome.contextMenus.onClicked.addListener((info, tab) => void send(tab, intakeOfMenuItem(info.menuItemId), info.selectionText));

/** The Lifeline the person set in the options, else the deployed one. */
async function lifelineBase(): Promise<string> {
  const stored = (await chrome.storage.sync.get(LIFELINE_URL_KEY))[LIFELINE_URL_KEY];
  return (typeof stored === "string" && lifelineUrl(stored)) || DEFAULT_LIFELINE_URL;
}

async function send(tab: chrome.tabs.Tab | undefined, intake?: string, selectionText?: string): Promise<void> {
  const handoff = tab ? await read(tab) : tabHandoff({});
  // A selection the reader could not reach (inside a frame) still goes, as the browser's plain text of it.
  if (!handoff.text && selectionText) handoff.text = selectionText;
  const base = await lifelineBase();
  await chrome.windows.create({ url: handoffUrl(base, handoff, intake), type: "popup", ...HANDOFF_WINDOW });
}

/** The page's Handoff, read in the page; a page the extension may not script sends its tab's title and URL. */
async function read(tab: chrome.tabs.Tab): Promise<Handoff> {
  if (tab.id === undefined) return tabHandoff(tab);
  const target = { tabId: tab.id };
  try {
    await chrome.scripting.executeScript({ target, files: ["reader.js"] });
    const [frame] = await chrome.scripting.executeScript({
      target,
      func: () => (globalThis as { __lifelineReadPage?: () => unknown }).__lifelineReadPage?.(),
    });
    const handoff = frame?.result as Handoff | undefined;
    return handoff && typeof handoff.title === "string" ? handoff : tabHandoff(tab);
  } catch {
    return tabHandoff(tab);
  }
}

// The Handoff page moves to its done address once the Intake's dialog has saved: close its window.
chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
  if (!change.url) return;
  void (async () => {
    if (!isDoneUrl(change.url, await lifelineBase())) return;
    const win = await chrome.windows.get(tab.windowId);
    // Only the window Send to Lifeline opened: a person's own tab at the done address stays.
    if (win.type === "popup") await chrome.windows.remove(tab.windowId);
  })();
});
