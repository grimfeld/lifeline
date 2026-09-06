import type { AppManifest, DaylogItem, DaylogProvider } from "@lifeline/core";
import { docHref } from "@lifeline/core";
import { Scissors } from "lucide-react";
import { ClipperScreen } from "./screens/ClipperScreen";
import { QuickClipCard } from "./cards/QuickClipCard";
import { RecentClippingsCard } from "./cards/RecentClippingsCard";
import { ClipDialog } from "./ClipDialog";
import { useClippings } from "./data";
import { APP_ID, CLIPPINGS_HREF, clippingType, hostOf } from "./types";

/** Daylog: what I clipped on a day. */
const clipperDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const clippings = useClippings();
    return clippings
      .filter((c) => String(c.capturedAt).slice(0, 10) === date)
      .map(
        (c): DaylogItem => ({
          key: `${APP_ID}/${c.id}`,
          appId: APP_ID,
          itemId: c.id,
          kind: "Clipped",
          title: c.title,
          subtitle: hostOf(String(c.source)) || undefined,
          time: String(c.capturedAt).slice(11, 16) || null,
          href: docHref(c),
          tags: c.tags,
        }),
      );
  },
};

/** The Clipper App (ADR 0019): owns `clipping` — text I paste from outside, kept with its source. Never fetches. */
export const clipperApp: AppManifest = {
  id: APP_ID,
  title: "Clipper",
  icon: Scissors,
  color: "var(--chart-orange)",
  types: [clippingType],
  screens: [{ id: "clipper.main", title: "Clippings", path: "clippings", icon: Scissors, group: "study", component: ClipperScreen }],
  cards: [
    {
      id: "clipper.quick",
      title: "Quick clip",
      description: "Paste text and its source — a Clipping in one go",
      component: QuickClipCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "clipper.recent",
      title: "Recent clippings",
      description: "The latest things you clipped",
      component: RecentClippingsCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      tagFilterable: true,
      settings: { count: { kind: "number", label: "How many", default: 8, min: 1, max: 50 } },
    },
  ],
  commands: [
    { id: "clipper.clip", title: "Clip…", keywords: ["clipping", "paste", "capture", "web"], icon: Scissors, dialog: ClipDialog, capture: true },
    { id: "clipper.go", title: "Go to Clippings", keywords: ["clipper"], icon: Scissors, run: ({ navigate }) => navigate(CLIPPINGS_HREF) },
  ],
  daylog: clipperDaylog,
  // Intake (ADR 0046): a text handed over from another App — a kept mail — becomes a Clipping, reviewed first.
  intakes: [{ id: "clipping", title: "Clipping", icon: Scissors, dialog: ClipDialog }],
};
