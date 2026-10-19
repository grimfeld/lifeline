import { documentsTable, inScope } from "./store";
import { workspaceScope } from "../workspaces";
import type { Document } from "./types";

/**
 * The one read in Core that goes around the Private gate (ADR 0038), and only
 * for link rewrites: a rename or move must rewrite `[[Old]]` in every body that
 * links to it, locked Private notes included, or their links break silently.
 * The rows never leave Core's rename operations: nothing here is returned to a
 * caller or shown, and the only thing written back is the rewritten link. Still
 * scoped to the Workspace — another Workspace's notes cannot resolve the name.
 *
 * Deliberately not exported from the package index.
 */
export async function documentsForLinkRewrite(): Promise<Document[]> {
  const scope = await workspaceScope();
  return (await documentsTable().where("deleted").equals(0).toArray()).filter((d) => inScope(d, scope));
}
