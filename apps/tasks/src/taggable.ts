import type { TaggableProvider, TaggedItem } from "@lifeline/core";
import { useTasks } from "./data/repo";
import { TASKS_HREF } from "./linkable";
import { APP_ID } from "./schedulable";
import { describeRecurrence } from "./domain/occurrences";

/**
 * The Taggable Contract for Tasks (ADR 0014): every live Task carrying at
 * least one tag. Tags live on the definition only — Occurrences inherit them
 * and are not reported separately.
 */
export const tasksTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged() {
    const tasks = useTasks();
    return tasks
      .filter((t) => t.status !== "archived" && (t.tags ?? []).length > 0)
      .map(
        (t): TaggedItem => ({
          appId: APP_ID,
          itemId: t.id,
          title: t.title,
          subtitle: t.recurrence ? describeRecurrence(t.recurrence) : undefined,
          tags: t.tags ?? [],
          href: TASKS_HREF,
        }),
      );
  },
};
