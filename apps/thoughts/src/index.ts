import type { AppManifest } from "@lifeline/core";
import { Lightbulb } from "lucide-react";
import { ThoughtsScreen } from "./screens/ThoughtsScreen";
import { ThoughtScreen } from "./screens/ThoughtScreen";
import { RecentThoughtsCard } from "./cards/RecentThoughtsCard";
import { thoughtsCommands } from "./commands";
import { thoughtTypeDef } from "./types";
import { THOUGHT_KINDS, kindLabel } from "./domain/types";

/** Thoughts App (ADR 0068): what comes straight out of my head, kept as a stream. The Thoughts Module's only App. */
export const thoughtsApp: AppManifest = {
  id: "thoughts",
  module: "thoughts",
  title: "Thoughts",
  icon: Lightbulb,
  color: "var(--chart-yellow)",
  types: [{ ...thoughtTypeDef, icon: Lightbulb }],
  screens: [
    { id: "thoughts.main", title: "Thoughts", path: "thoughts", icon: Lightbulb, component: ThoughtsScreen },
    { id: "thoughts.one", title: "Thought", path: "thoughts/:id", component: ThoughtScreen, hidden: true },
  ],
  cards: [
    {
      id: "thoughts.recent",
      title: "Recent thoughts",
      description: "The newest thoughts, one line each",
      component: RecentThoughtsCard,
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: {
        count: { kind: "number", label: "How many", default: 6, min: 1, max: 30 },
        kind: { kind: "select", label: "Kind", default: "", options: [{ value: "", label: "Every kind" }, ...THOUGHT_KINDS.map((k) => ({ value: k.value, label: `${k.label}s` }))] },
      },
      instanceTitle: (s) => (kindLabel(String(s.kind ?? "")) ? `Recent ${kindLabel(String(s.kind))?.toLowerCase()}s` : "Recent thoughts"),
    },
  ],
  commands: thoughtsCommands,
};

export { THOUGHT, THOUGHT_KINDS, THOUGHTS_HREF, thoughtHref, type Thought, type ThoughtKind } from "./domain/types";
export { captureThought, useThoughts } from "./data/repo";
