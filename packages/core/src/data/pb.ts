import PocketBase from "pocketbase";
import { useSyncExternalStore } from "react";
import { isDemo } from "../demo";

// The Demo (ADR 0077) carries no backend URL: its client points nowhere and is never used.
const url = isDemo()
  ? ""
  : ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PB_URL ?? "http://127.0.0.1:8090");

export const pb = new PocketBase(url);
pb.autoCancellation(false);
// Nor has it an Account (CONTEXT.md "Demo"): a session this browser remembers
// is dropped, so everything that asks who is signed in hears "no one" and
// sync, the account rows and the pull markers stay out of the way.
if (isDemo()) pb.authStore.clear();

export async function login(email: string, password: string): Promise<void> {
  if (isDemo()) throw new Error("The Demo cannot sign in");
  await pb.collection("users").authWithPassword(email, password);
}

export function logout(): void {
  pb.authStore.clear();
}

function subscribeAuth(cb: () => void): () => void {
  return pb.authStore.onChange(cb);
}

export function useAuth(): { loggedIn: boolean; email: string | null } {
  const loggedIn = useSyncExternalStore(
    subscribeAuth,
    () => pb.authStore.isValid,
    () => false,
  );
  const record = pb.authStore.record as { email?: string } | null;
  return { loggedIn, email: record?.email ?? null };
}
