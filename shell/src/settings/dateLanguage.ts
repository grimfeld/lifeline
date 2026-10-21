import { useSyncExternalStore } from "react";
import { DATE_VOCABULARIES } from "@lifeline/core";

/**
 * The palette's preferred date language (ADR 0091): which language's meaning
 * a `/` word takes when two disagree (`mar`: March or mardi). Every language
 * is read either way. Per device and unsynced, like the Workspace this device
 * is in: it follows the keyboard and the person at it, and there is no
 * account-wide preferences record to put it in.
 */

const KEY = "lifeline.dates.language";
const DEFAULT = "en";
const listeners = new Set<() => void>();

function read(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v && v in DATE_VOCABULARIES ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current = read();

export function dateLanguage(): string {
  return current;
}

export function setDateLanguage(lang: string): void {
  if (lang === current || !(lang in DATE_VOCABULARIES)) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode: the choice lasts the session */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useDateLanguage(): string {
  return useSyncExternalStore(subscribe, dateLanguage, () => DEFAULT);
}
