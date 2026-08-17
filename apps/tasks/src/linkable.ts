import type { LinkableProvider, LinkTarget } from "@lifeline/core";
import { useTasks } from "./data/repo";
import { APP_ID } from "./schedulable";

/** Where a Task opens: the App has no per-task route, so the main screen. */
export const TASKS_HREF = "/app/tasks";

/**
 * The Linkable Contract for Tasks: every active (non-archived) Task can be
 * the target of a `[[Title]]` wikilink. Occurrences are not separate targets —
 * they are facets of their recurring Task.
 */
export const tasksLinkable: LinkableProvider = {
  appId: APP_ID,
  useTargets() {
    const tasks = useTasks();
    return tasks
      .filter((t) => t.status === "active")
      .map(
        (t): LinkTarget => ({
          appId: APP_ID,
          itemId: t.id,
          name: t.title,
          subtitle: t.recurrence ? "recurring" : undefined,
          href: TASKS_HREF,
        }),
      );
  },
};
