import { useEffect, useRef } from "react";
import { toast } from "@lifeline/ui";
import { useTasks } from "@lifeline/app-tasks/data";
import { progressOf } from "./domain/board";
import { isOpenStage } from "./domain/types";
import { setStage, useProjects } from "./data/repo";

/**
 * Ticking a Project's last open Task — anywhere, on any Surface — *offers*
 * to finish it, and never finishes it (ADR 0060): the outcome is not the task
 * list. Watches each open Project's count of open Tasks and speaks when it
 * falls to zero during this session, never on load.
 */
export function useOfferFinish(): void {
  const projects = useProjects();
  const tasks = useTasks();
  const seen = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    const now = new Map<string, number>();
    for (const p of projects) {
      if (!isOpenStage(p.stage)) continue;
      const { done, total } = progressOf(tasks, p.id);
      now.set(p.id, total - done);
    }
    const before = seen.current;
    seen.current = now;
    // The first reading is the page loading, not a tick.
    if (!before || tasks.length === 0) return;
    for (const p of projects) {
      const was = before.get(p.id);
      if (was !== undefined && was > 0 && now.get(p.id) === 0) {
        toast(`Every task of ${p.title} is done`, {
          description: p.outcome ? `Outcome: ${p.outcome}` : "Is the outcome reached?",
          action: { label: "Finish project", onClick: () => void setStage(p.id, "done") },
          duration: 10_000,
        });
      }
    }
  }, [projects, tasks]);
}
