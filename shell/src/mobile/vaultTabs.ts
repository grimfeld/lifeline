import { useEffect } from "react";
import { useLocation } from "react-router";
import { isWithin, useAllDocuments, useDocument, vaultDocPath, type Document } from "@lifeline/core";
import { Feather, Lightbulb, Quote } from "lucide-react";

export interface VaultTab {
  id: string;
  title: string;
  /** The Folder this tab is: a Document under it belongs to this tab. */
  folder: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * The Vault's phone tabs (ADR 0021, amended): Folders, fixed in code the way
 * `NAV_GROUPS` is (ADR 0041). Pinnable tabs were considered and deferred —
 * phone chrome preferences are per-device and unsynced, so a hand-pinned set
 * would not follow the user to another device.
 *
 * Journal is deliberately absent: every tab is a Folder you browse, and
 * `Journal/YYYY/MM` is auto-filed and dated — you go to *today*, not to it. It
 * keeps its slot on the Dashboard's bar instead.
 */
export const VAULT_TABS: VaultTab[] = [
  { id: "thoughts", title: "Thoughts", folder: "Thoughts", icon: Lightbulb },
  { id: "quotes", title: "Quotes", folder: "Quotes", icon: Quote },
  { id: "writings", title: "Writings", folder: "Writings", icon: Feather },
];

const LAST_KEY = (id: string) => `vault:tab:last:${id}`;

/** The tab a Folder belongs to, if any. */
export function tabOfFolder(folder: string | undefined): VaultTab | undefined {
  if (!folder) return undefined;
  return VAULT_TABS.find((t) => isWithin(folder, t.folder));
}

function remembered(tabId: string): string | undefined {
  try {
    return localStorage.getItem(LAST_KEY(tabId)) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remembers the Document last opened under each tab — so returning to Writings
 * returns you to the writing rather than to a list you have to re-navigate —
 * and reports which tab the open Document belongs to, which is what makes a tab
 * read as current. Per-device, like every other piece of phone chrome state.
 *
 * Activeness comes from the open Document's Folder rather than from comparing
 * hrefs: you are "in Notes" whenever the Document you have open lives there,
 * whatever the tab would navigate to.
 */
export function useVaultTabMemory(): VaultTab | undefined {
  const location = useLocation();
  const id = /^\/vault\/d\/([^/?]+)/.exec(location.pathname)?.[1];
  const doc = useDocument(id);
  const tab = tabOfFolder(doc?.folder);
  const docId = doc?.id;
  const tabId = tab?.id;
  useEffect(() => {
    if (!docId || !tabId) return;
    try {
      localStorage.setItem(LAST_KEY(tabId), docId);
    } catch {
      /* private mode: the tab falls back to the folder's newest Document */
    }
  }, [docId, tabId]);
  return tab;
}

/**
 * Where a tab goes: the Document last opened under it, else the folder's most
 * recently touched one, else the Vault's root so the tree can be used. A
 * remembered Document that has since been deleted or moved out is ignored.
 */
export function useTabHref(tab: VaultTab): string {
  const docs = useAllDocuments();
  const under = (d: Document) => isWithin(d.folder, tab.folder);
  const last = remembered(tab.id);
  const kept = last ? docs.find((d) => d.id === last && under(d)) : undefined;
  if (kept) return vaultDocPath(kept.id);
  const newest = docs.filter(under).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return newest ? vaultDocPath(newest.id) : "/vault";
}
