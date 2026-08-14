import PocketBase from "pocketbase";
import { useSyncExternalStore } from "react";

const url =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PB_URL ??
  "http://127.0.0.1:8090";

export const pb = new PocketBase(url);
pb.autoCancellation(false);

export async function login(email: string, password: string): Promise<void> {
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
