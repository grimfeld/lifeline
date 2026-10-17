import {
  BookOpen,
  CalendarDays,
  Home,
  Landmark,
  Brain,
  LayoutDashboard,
  FolderKanban,
  Lightbulb,
  LibraryBig,
  Feather,
  BookOpenText,
  Mail,
  MapPin,
  NotebookText,
  TrendingUp,
  Waypoints,
} from "lucide-react";

/**
 * Pixels for Core's Modules and Surfaces. Both lists are Core's (ADR 0047,
 * ADR 0053) and the icons are the shell's, so Core keeps no view dependency
 * for the sake of a Rail icon or a Phone bar slot.
 */
export const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  house: Home,
  tasks: FolderKanban,
  culture: BookOpen,
  money: Landmark,
  journal: NotebookText,
  notes: LibraryBig,
  research: Feather,
  manuscript: BookOpenText,
  thoughts: Lightbulb,
  progress: TrendingUp,
  languages: Brain,
  mail: Mail,
};

export const SURFACE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: CalendarDays,
  map: MapPin,
  graph: Waypoints,
};

/** What a Phone bar slot draws. A Screen has no icon of its own, and needs none. */
export function slotIcon(kind: string, id: string): React.ComponentType<{ className?: string }> {
  if (kind === "module") return MODULE_ICONS[id] ?? LayoutDashboard;
  // A slot still pointed at the old Week or Schedule opens the Calendar's view (ADR 0063).
  if (kind === "surface") return SURFACE_ICONS[id] ?? (id === "week" || id === "schedule" ? CalendarDays : LayoutDashboard);
  return LayoutDashboard;
}
