import { Navigate } from "react-router";
import { CalendarRange, LayoutTemplate, NotebookPen, Shapes } from "lucide-react";
import { handModule } from "../handModule";

/** Home: the Journal opens on today. */
function JournalHome() {
  return <Navigate to="/app/journal" replace />;
}

/**
 * The Journal (ADR 0068): living day to day in writing, in an interface of its
 * own — today's Day, the reviews of the week, month, quarter and year it sits
 * in, the user's own Types homed here, and every type's Templates. The
 * Vault is only the raw editor now.
 */
export const journalShell = handModule({
  id: "journal",
  title: "Journal",
  places: [
    { key: "today", title: "Today", icon: NotebookPen, screen: "notes.journal" },
    { key: "week", title: "This week", icon: CalendarRange, href: "/app/journal/p/week" },
    { key: "month", title: "This month", icon: CalendarRange, href: "/app/journal/p/month" },
    { key: "quarter", title: "This quarter", icon: CalendarRange, href: "/app/journal/p/quarter" },
    { key: "year", title: "This year", icon: CalendarRange, href: "/app/journal/p/year" },
    { key: "types", title: "Types", icon: Shapes, screen: "notes.types" },
    { key: "templates", title: "Templates", icon: LayoutTemplate, screen: "notes.templates" },
  ],
  pages: [{ path: "", component: JournalHome }],
});
