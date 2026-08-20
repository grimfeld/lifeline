import { useDocumentTypes, VAULT_WORKSPACE, type AppManifest } from "@lifeline/core";
import { FileText, Hash, LayoutDashboard, MapPin, Sun, Table2, Vault } from "lucide-react";
import { TodayCard } from "./surfaces/TodayCard";
import { AgendaCard } from "./surfaces/AgendaCard";
import { lastLocation } from "./components/WorkspaceSwitcher";
import { MapCard, useLocatableAppOptions } from "./surfaces/MapCard";
import { TagsCard } from "./surfaces/TagsCard";
import { CountTile, DocumentCard, useDocumentOptions, useViewOptions, ViewCard } from "./surfaces/DocumentCards";
import { VaultSidebar } from "./vault/VaultSidebar";
import { VaultDocPage } from "./vault/VaultDocPage";

/**
 * The shell's own manifest: Core's Surfaces packaged like any App's cards
 * (so they appear in the card picker), the generic Document Cards (ADR 0018),
 * and the Vault workspace (ADR 0012, amended).
 */
export const hubApp: AppManifest = {
  id: "hub",
  title: "Lifeline",
  color: "var(--chart-yellow)",
  types: [],
  workspace: {
    id: VAULT_WORKSPACE,
    title: "Vault",
    icon: Vault,
    path: "/vault",
    sidebar: VaultSidebar,
    home: "journal",
  },
  screens: [
    {
      id: "hub.doc",
      title: "Document",
      path: "d/:id",
      workspace: VAULT_WORKSPACE,
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
  ],
  commands: [
    {
      id: "hub.go-dashboard",
      title: "Go to Dashboard",
      keywords: ["workspace", "screens"],
      icon: LayoutDashboard,
      run: ({ navigate }) => navigate(lastLocation("dashboard")),
    },
    {
      id: "hub.go-vault",
      title: "Go to Vault",
      keywords: ["workspace", "notes", "journal", "editor"],
      icon: Vault,
      run: ({ navigate }) => navigate(lastLocation(VAULT_WORKSPACE)),
    },
    {
      id: "hub.go-bases",
      title: "Go to Bases",
      keywords: ["types", "documents", "table"],
      icon: Table2,
      run: ({ navigate }) => navigate("/base"),
    },
    {
      id: "hub.today-icon",
      title: "Go to Calendar",
      keywords: ["month", "schedule"],
      icon: Sun,
      run: ({ navigate }) => navigate("/calendar"),
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
