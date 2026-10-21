import { useDocumentTypes, VAULT_FRAME, type AppManifest } from "@lifeline/core";
import { FileText, Hash, LayoutDashboard, MapPin, Sun, Table2, Vault, Waypoints } from "lucide-react";
import { TodayCard } from "./surfaces/TodayCard";
import { AgendaCard } from "./surfaces/AgendaCard";
import { MapCard, useLocatableAppOptions } from "./surfaces/MapCard";
import { TagsCard } from "./surfaces/TagsCard";
import { CountTile, DocumentCard, useDocumentOptions, useViewOptions, ViewCard } from "./surfaces/DocumentCards";
import { GraphCard } from "./surfaces/GraphCard";
import { REPORT_KIND_OPTIONS, REPORT_WINDOW_OPTIONS, ReportCard, useReportDocumentOptions, useReportTitle, useReportTypeOptions } from "./surfaces/ReportCard";
import { VaultSidebar } from "./vault/VaultSidebar";
import { VaultDocPage } from "./vault/VaultDocPage";
import { VaultHome } from "./vault/VaultHome";

/**
 * The shell's own manifest: Core's Surfaces packaged like any App's cards
 * (so they appear in the card picker), the generic Document Cards (ADR 0018),
 * and the Vault — Core's raw editor for bodies (ADR 0068), as the Bases are for fields.
 */
export const hubApp: AppManifest = {
  id: "hub",
  title: "Lifeline",
  color: "var(--chart-yellow)",
  types: [],
  frame: {
    id: VAULT_FRAME,
    title: "Vault",
    icon: Vault,
    path: "/vault",
    sidebar: VaultSidebar,
  },
  screens: [
    // The raw editor's landing (ADR 0068): the Vault is no Module's layout, so it opens on nothing in particular.
    { id: "hub.vault", title: "Vault", path: "", frame: VAULT_FRAME, hidden: true, component: VaultHome },
    {
      id: "hub.doc",
      title: "Document",
      path: "d/:id",
      frame: VAULT_FRAME,
      hidden: true,
      component: VaultDocPage,
    },
  ],
  cards: [
    {
      id: "hub.today",
      title: "Today",
      description: "Everything scheduled or due today, across all apps",
      component: TodayCard,
      defaultSize: { w: 4, h: 7 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
    },
    {
      id: "hub.agenda",
      title: "Today's agenda",
      description: "Today's timed items on an hour scale, with a live now-line",
      component: AgendaCard,
      defaultSize: { w: 3, h: 8 },
      minSize: { w: 2, h: 4 },
      tagFilterable: true,
      settings: {
        startHour: { kind: "number", label: "From hour", default: 7, min: 0, max: 23 },
        endHour: { kind: "number", label: "To hour", default: 23, min: 1, max: 24 },
      },
      instanceTitle: (s) => (s.startHour === 7 && s.endHour === 23 ? "" : `Agenda · ${s.startHour}–${s.endHour}h`),
    },
    {
      id: "hub.map",
      title: "Map",
      description: "Every located Document, of every type, on an OpenStreetMap",
      component: MapCard,
      defaultSize: { w: 6, h: 8 },
      minSize: { w: 3, h: 4 },
      tagFilterable: true,
      settings: {
        app: { kind: "entity", label: "Type", useOptions: useLocatableAppOptions, anyLabel: "All types" },
      },
      instanceTitle: (s) => (s.app ? `Map · ${useLocatableAppOptions().find((o) => o.value === s.app)?.label ?? s.app}` : ""),
    },
    {
      id: "hub.tags",
      title: "Tags",
      description: "Every tag in use across Documents — expand one to see what carries it",
      component: TagsCard,
      defaultSize: { w: 3, h: 7 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "hub.view",
      title: "View",
      description: "A Base View on your Screen — any Document type, filtered and sorted as saved",
      component: ViewCard,
      defaultSize: { w: 4, h: 7 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
      settings: {
        view: { kind: "entity", label: "View", required: true, useOptions: useViewOptions },
        layout: {
          kind: "select",
          label: "Layout",
          default: "",
          options: [
            { value: "", label: "As saved" },
            { value: "list", label: "List" },
            { value: "table", label: "Table" },
            { value: "cards", label: "Cards" },
            { value: "gallery", label: "Gallery" },
            { value: "map", label: "Map" },
            { value: "board", label: "Board" },
            { value: "calendar", label: "Calendar" },
          ],
        },
      },
      instanceTitle: (s) => useViewOptions().find((o) => o.value === s.view)?.label ?? "",
    },
    {
      id: "hub.document",
      title: "Document",
      description: "One chosen Document — its fields and body, live",
      component: DocumentCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 2 },
      settings: {
        doc: { kind: "entity", label: "Document", required: true, useOptions: useDocumentOptions },
      },
      instanceTitle: (s) => useDocumentOptions().find((o) => o.value === s.doc)?.label.split(" · ")[0] ?? "",
    },
    {
      id: "hub.graph",
      title: "Graph",
      description: "One Document's neighbourhood — its links and backlinks, drawn as a local graph",
      component: GraphCard,
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: {
        doc: { kind: "entity", label: "Document", required: true, useOptions: useDocumentOptions },
        depth: {
          kind: "select",
          label: "Depth",
          default: "1",
          options: [
            { value: "1", label: "Direct links" },
            { value: "2", label: "Two steps" },
          ],
        },
      },
      instanceTitle: (s) => useDocumentOptions().find((o) => o.value === s.doc)?.label.split(" · ")[0] ?? "",
    },
    {
      id: "hub.count",
      title: "Count",
      description: "How many Documents a View holds, as one big number",
      component: CountTile,
      defaultSize: { w: 2, h: 2 },
      minSize: { w: 1, h: 2 },
      tagFilterable: true,
      settings: {
        view: { kind: "entity", label: "View", required: true, useOptions: useViewOptions },
      },
      instanceTitle: (s) => useViewOptions().find((o) => o.value === s.view)?.label ?? "",
    },
    {
      id: "hub.report",
      title: "Report",
      description: "A Report on a type or one Document: who comes up on the most Days, when it was last mentioned, a year as a heatmap",
      component: ReportCard,
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
      settings: {
        kind: { kind: "select", label: "Report", default: "top", options: REPORT_KIND_OPTIONS },
        type: { kind: "entity", label: "Type (for a ranking)", useOptions: useReportTypeOptions },
        window: { kind: "select", label: "Over", default: "month", options: REPORT_WINDOW_OPTIONS },
        n: { kind: "number", label: "How many", default: 5, min: 1, max: 50 },
        doc: { kind: "entity", label: "Document (for one Document's Report)", useOptions: useReportDocumentOptions },
      },
      instanceTitle: useReportTitle,
    },
  ],
  commands: [
    {
      id: "hub.go-screens",
      title: "Go to Screens",
      keywords: ["dashboard", "cards", "layout"],
      icon: LayoutDashboard,
      run: ({ navigate }) => navigate("/screens"),
    },
    {
      id: "hub.go-vault",
      title: "Go to Vault",
      keywords: ["raw", "markdown", "files", "folders", "editor", "bulk"],
      icon: Vault,
      run: ({ navigate }) => navigate("/vault"),
    },
    {
      id: "hub.go-bases",
      title: "Go to Bases",
      keywords: ["types", "documents", "table"],
      icon: Table2,
      run: ({ navigate }) => navigate("/base"),
    },
    {
      // Progress's Overview, "Today": the day's logging on one page. The built-in morning Macro ends here (ADR 0094).
      id: "hub.go-today",
      title: "Go to Today",
      keywords: ["today", "progress", "day", "morning", "overview"],
      icon: Sun,
      run: ({ navigate }) => navigate("/module/progress"),
    },
    {
      id: "hub.today-icon",
      title: "Go to Calendar",
      keywords: ["month", "schedule"],
      icon: Sun,
      run: ({ navigate }) => navigate("/calendar"),
    },
    {
      id: "hub.graph-go",
      title: "Go to Graph",
      keywords: ["links", "network", "backlinks", "vault"],
      icon: Waypoints,
      run: ({ navigate }) => navigate("/graph"),
    },
    {
      id: "hub.map-go",
      title: "Go to Map",
      keywords: ["places", "osm", "locations"],
      icon: MapPin,
      run: ({ navigate }) => navigate("/map"),
    },
  ],
  useCommands: () => {
    // One "Open <plural> Base" per Document type.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const types = useDocumentTypesForCommands();
    return types.map((t) => ({
      id: `hub.base.${t.id}`,
      title: `Open ${t.label} Base`,
      keywords: ["base", "documents", t.label.toLowerCase()],
      icon: t.icon ?? (t.body === "required" ? FileText : Hash),
      run: ({ navigate }) => navigate(`/base/${t.id}`),
    }));
  },
};

function useDocumentTypesForCommands() {
  return useDocumentTypes().filter((t) => !t.internal);
}
