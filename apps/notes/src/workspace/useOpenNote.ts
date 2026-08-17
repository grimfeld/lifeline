import { useLocation, useParams, useSearchParams } from "react-router";
import { todayStr } from "@lifeline/core";
import type { Note } from "../domain/types";

/** Route helpers for the Notes workspace (ADR 0012): /notes/journal?d=YYYY-MM-DD and /notes/n/:id. */
export const noteHref = (n: Pick<Note, "id" | "type" | "title">) => (n.type === "daily" ? `/notes/journal?d=${n.title}` : `/notes/n/${n.id}`);
export const journalHref = (date: string) => (date === todayStr() ? "/notes/journal" : `/notes/journal?d=${date}`);

/** The note currently open in the workspace, derived from the URL. */
export function useOpenNote(notes: Note[]): Note | undefined {
  const { pathname } = useLocation();
  const params = useParams();
  const [search] = useSearchParams();
  if (pathname.startsWith("/notes/journal")) {
    const d = search.get("d") ?? todayStr();
    return notes.find((n) => n.type === "daily" && n.title === d);
  }
  const id = params.id ?? pathname.match(/^\/notes\/n\/([^/]+)/)?.[1];
  return id ? notes.find((n) => n.id === id) : undefined;
}
