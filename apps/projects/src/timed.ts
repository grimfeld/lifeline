import type { TimedProvider } from "@lifeline/core";
import { markersIn, parseMarkerId } from "./domain/board";
import { APP_ID, projectHref } from "./domain/types";
import { setDeadline, setMilestoneDeadline, useMilestones, useProjects } from "./data/repo";

/**
 * Deadlines on the time Surfaces (ADR 0061): each an all-day marker on its
 * day, taking no hours. Dragged to another day, the Deadline moves with it —
 * the Project's own, or a Milestone's. Nothing else about a marker is done
 * from a Surface: it opens in its Project.
 */
export const projectsTimed: TimedProvider = {
  appId: APP_ID,

  useItems(range) {
    const projects = useProjects();
    const milestones = useMilestones();
    return markersIn(projects, milestones, range);
  },

  async move(itemId, to) {
    const { projectId, milestoneId } = parseMarkerId(itemId);
    if (milestoneId) await setMilestoneDeadline(milestoneId, to);
    else await setDeadline(projectId, to);
  },

  href(itemId) {
    return projectHref(parseMarkerId(itemId).projectId);
  },
};
