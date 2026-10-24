import { documentsOf, getDocument, type Document } from "@lifeline/core";
import { PROJECT_LANE, PROJECT_MILESTONE } from "../domain/types";

export type ScopedKind = "milestone" | "lane";

/** What every Milestone or Lane of a Project has; `done` is a Lane's alone. */
export type ScopedDoc = Document & { project: string; done?: boolean };

const TYPE: Record<ScopedKind, string> = { milestone: PROJECT_MILESTONE, lane: PROJECT_LANE };

/**
 * Name a Milestone or Lane of one Project, by id or by title (case-insensitive),
 * looked up only among that Project's own: "To do" is this Project's "To do",
 * never another's. No match, or several, is refused with the candidates listed.
 * It lives here, below both Apps, so `tasks.add` and the Projects Commands share it.
 */
export async function resolveInProject<T extends ScopedDoc = ScopedDoc>(kind: ScopedKind, projectId: string, value: string): Promise<T> {
  const own = (await documentsOf<T>(TYPE[kind])).filter((d) => d.project === projectId);
  const byId = own.find((d) => d.id === value);
  if (byId) return byId;
  const wanted = value.trim().toLowerCase();
  const hits = own.filter((d) => d.title.trim().toLowerCase() === wanted);
  if (hits.length === 1) return hits[0]!;
  const project = (await getDocument(projectId))?.title ?? projectId;
  if (hits.length === 0) {
    const list = own.length ? `; ${project} has: ${own.map((d) => `“${d.title}” (${d.id})`).join(", ")}` : `; ${project} has none`;
    throw new Error(`No ${kind} called “${value}” in ${project}${list}`);
  }
  throw new Error(`${hits.length} ${kind}s in ${project} are called “${value}”; pass one id: ${hits.map((d) => d.id).join(", ")}`);
}
