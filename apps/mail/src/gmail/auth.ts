import { useSyncExternalStore } from "react";

/**
 * Google Identity Services' browser token flow (ADR 0051): an access token
 * in memory for about an hour, asked for in a Google window on a user click
 * and never on the App's own initiative. No refresh token exists anywhere;
 * a lapsed token simply means the Mailbox is signed out on this device.
 */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const GSI_SRC = "https://accounts.google.com/gsi/client";
/** Renew this long before Google's own expiry so a request never lands on a dead token. */
const EXPIRY_MARGIN_MS = 60_000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; hint?: string }): void;
}
interface GsiOAuth2 {
  initTokenClient(config: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string; message?: string }) => void }): TokenClient;
  revoke(token: string, done?: () => void): void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GsiOAuth2 } };
  }
}

export function clientId(): string {
  return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ?? "";
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Why Mail cannot work here at all, or "" when it can. */
export function unavailableReason(): string {
  if (isTauri()) return "Mail works in the browser build only: Google's sign-in flow needs an http(s) origin, which the desktop shell does not have.";
  if (!clientId()) return "No Google client id is configured (VITE_GOOGLE_CLIENT_ID).";
  return "";
}

/** Tokens per Gmail address, this page only. */
const tokens = new Map<string, { token: string; expiresAt: number }>();
const listeners = new Set<() => void>();
let version = 0;
function notify() {
  version++;
  for (const l of listeners) l();
}

export function tokenFor(address: string): string | null {
  const t = tokens.get(address.toLowerCase());
  if (!t) return null;
  if (Date.now() > t.expiresAt - EXPIRY_MARGIN_MS) {
    tokens.delete(address.toLowerCase());
    queueMicrotask(notify);
    return null;
  }
  return t.token;
}

export function isSignedIn(address: string): boolean {
  return tokenFor(address) !== null;
}

/** Forget a token — after a 401, or on the user's "Sign out". Nothing at Google changes. */
export function forgetToken(address: string): void {
  if (tokens.delete(address.toLowerCase())) notify();
}

/** React: re-renders when any token appears or lapses. */
export function useSignedIn(address: string | undefined): boolean {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
  return address ? isSignedIn(address) : false;
}

let gsiLoading: Promise<GsiOAuth2> | null = null;
function loadGsi(): Promise<GsiOAuth2> {
  if (gsiLoading) return gsiLoading;
  gsiLoading = new Promise((resolve, reject) => {
    const ready = () => window.google?.accounts?.oauth2;
    if (ready()) return resolve(ready()!);
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => (ready() ? resolve(ready()!) : reject(new Error("Google sign-in did not load")));
    s.onerror = () => reject(new Error("Google sign-in could not be loaded (offline?)"));
    document.head.appendChild(s);
  });
  gsiLoading.catch(() => (gsiLoading = null));
  return gsiLoading;
}

/**
 * Ask Google for a token — a window opens (or flashes, when the Google
 * session is alive and consent was given before). `hint` picks the account;
 * with none, Google asks which. Resolves to the token and the address it is
 * for, read from Gmail's own profile so a Mailbox never gets another
 * account's token.
 */
export async function requestToken(opts: { hint?: string; selectAccount?: boolean } = {}): Promise<{ token: string; address: string; expiresAt: number }> {
  const reason = unavailableReason();
  if (reason) throw new Error(reason);
  const oauth2 = await loadGsi();
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId(),
      scope: GMAIL_SCOPE,
      callback: resolve,
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "Sign-in window closed" : (e.message ?? e.type))),
    });
    client.requestAccessToken({ prompt: opts.selectAccount ? "select_account" : "", hint: opts.hint });
  });
  if (!response.access_token) throw new Error(response.error_description ?? response.error ?? "No token");
  const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;
  const address = await profileAddress(response.access_token);
  if (opts.hint && address !== opts.hint.toLowerCase()) {
    throw new Error(`Signed in as ${address}, not ${opts.hint}. Pick the right Google account.`);
  }
  tokens.set(address, { token: response.access_token, expiresAt });
  notify();
  return { token: response.access_token, address, expiresAt };
}

async function profileAddress(token: string): Promise<string> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not read the Gmail profile (HTTP ${res.status})`);
  const p = (await res.json()) as { emailAddress?: string };
  if (!p.emailAddress) throw new Error("Gmail returned no address");
  return p.emailAddress.toLowerCase();
}
