import { BookOpen, CalendarDays, Home, Landmark, ListTodo, NotebookText, TrendingUp } from "lucide-react";

/**
 * Pixels for Core's Modules. The list itself is Core's (ADR 0047) and the
 * icons are the shell's, so Core keeps no view dependency for the sake of a
 * bottom bar.
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
