import {
  BookOpen,
  CalendarDays,
  Clock,
  Columns3,
  Home,
  Landmark,
  LayoutDashboard,
  ListTodo,
  MapPin,
  NotebookText,
  TrendingUp,
  Waypoints,
} from "lucide-react";

/**
 * Pixels for Core's Modules and Surfaces. Both lists are Core's (ADR 0047,
 * ADR 0053) and the icons are the shell's, so Core keeps no view dependency
 * for the sake of a sidebar row or a Phone bar slot.
 */
export const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  house: Home,
  tasks: ListTodo,
  schedules: CalendarDays,
  culture: BookOpen,
  money: Landmark,
  notes: NotebookText,
  progress: TrendingUp,
};

export const SURFACE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: CalendarDays,
  week: Columns3,
  schedule: Clock,
  map: MapPin,
  graph: Waypoints,
};

/** What a Phone bar slot draws. A Screen has no icon of its own, and needs none. */
export function slotIcon(kind: string, id: string): React.ComponentType<{ className?: string }> {
  if (kind === "module") return MODULE_ICONS[id] ?? LayoutDashboard;
  if (kind === "surface") return SURFACE_ICONS[id] ?? LayoutDashboard;
  return LayoutDashboard;
}
