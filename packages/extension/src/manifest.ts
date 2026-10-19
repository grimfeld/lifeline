/**
 * The Lifeline extension's manifest: one Manifest V3 source, written out per
 * browser by scripts/build.mjs. Chrome runs the background as a service
 * worker; Firefox as an event page (`scripts`) and wants an add-on id. Nothing
 * else differs.
 */
import { DEFAULT_LIFELINE_URL, lifelineHostPattern } from "./lifeline";

export type Browser = "chrome" | "firefox";

/** The id Firefox Add-ons knows the extension by; it must never change once published. */
export const GECKO_ID = "send-to-lifeline@grimfeld.tech";

/** The keys the build writes; a loose shape — the browsers check the rest. */
export interface Manifest {
  manifest_version: 3;
  name: string;
  short_name: string;
  description: string;
  version: string;
  icons: Record<number, string>;
  action: { default_title: string; default_icon: Record<number, string> };
  permissions: string[];
  host_permissions: string[];
  commands: Record<string, { suggested_key: { default: string }; description: string }>;
  background: { service_worker: string } | { scripts: string[] };
  browser_specific_settings?: { gecko: { id: string; strict_min_version: string } };
}

export function manifest(browser: Browser): Manifest {
  const common: Omit<Manifest, "background"> = {
    manifest_version: 3,
    name: "Lifeline",
    short_name: "Lifeline",
    description: "Send the page in front of you — or what you selected on it — to Lifeline, as a Task, a Quote, an Event…",
    version: "0.1.0",
    icons: { 48: "icon-48.png", 128: "icon-128.png" },
    action: { default_title: "Send to Lifeline", default_icon: { 32: "icon-32.png", 48: "icon-48.png" } },
    // Nothing is read from a page until the person sends it: activeTab + scripting, no content scripts.
    permissions: ["contextMenus", "activeTab", "scripting", "storage"],
    // Lifeline, and nowhere else: the extension fetches its Intakes list, and sees its window reach the done address and closes it.
    host_permissions: [lifelineHostPattern(DEFAULT_LIFELINE_URL)],
    commands: {
      _execute_action: { suggested_key: { default: "Alt+Shift+L" }, description: "Send to Lifeline" },
    },
  };
  if (browser === "chrome") return { ...common, background: { service_worker: "background.js" } };
  return {
    ...common,
    background: { scripts: ["background.js"] },
    // 109: the first Firefox with Manifest V3.
    browser_specific_settings: { gecko: { id: GECKO_ID, strict_min_version: "109.0" } },
  };
}
