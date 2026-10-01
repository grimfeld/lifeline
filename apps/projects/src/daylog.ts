import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { APP_ID, projectHref } from "./domain/types";
import { useMilestones, useProjects } from "./data/repo";

/**
 * The Daylog for Projects (ADR 0060): a Project started (became Active), one
 * of its Milestones reached, a Project finished. Never one dropped — letting
 * go is kept on the Project, not celebrated on the day.
 */
export const projectsDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const projects = useProjects();
    const milestones = useMilestones();
    const byId = new Map(projects.map((p) => [p.id, p]));
    const out: DaylogItem[] = [];
    for (const p of projects) {
      if (p.startedOn === date) out.push({ key: `${APP_ID}/start/${p.id}`, appId: APP_ID, itemId: p.id, kind: "Started", title: p.title, time: null, href: projectHref(p.id), tags: p.tags });
      if (p.stage === "done" && p.endedOn === date) out.push({ key: `${APP_ID}/done/${p.id}`, appId: APP_ID, itemId: p.id, kind: "Finished", title: p.title, subtitle: p.outcome || undefined, time: null, href: projectHref(p.id), tags: p.tags });
    }
    for (const m of milestones) {
      const p = byId.get(m.project);
      if (!p || m.reachedOn !== date) continue;
      out.push({ key: `${APP_ID}/milestone/${m.id}`, appId: APP_ID, itemId: m.id, kind: "Reached", title: m.title, subtitle: p.title, time: null, href: projectHref(p.id), tags: p.tags });
    }
    return out;
  },
};
