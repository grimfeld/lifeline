import type { CommandDef } from "@lifeline/core";
import { Globe } from "lucide-react";
import { EmbedDialog } from "./components/EmbedDialog";

function NewEmbedCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <EmbedDialog {...props} />;
}

export const sourcesCommands: CommandDef[] = [
  {
    id: "sources.new-embed",
    title: "New embed",
    keywords: ["url", "iframe", "web", "page", "source", "external"],
    icon: Globe,
    dialog: NewEmbedCommandDialog,
  },
];
