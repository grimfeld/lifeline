import type { CommandDef } from "@lifeline/core";
import { BookMarked, Plus } from "lucide-react";
import { AddMediaDialog } from "./components/AddMediaDialog";

function AddMediaCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <AddMediaDialog {...props} />;
}

export const mediaCommands: CommandDef[] = [
  { id: "media.add", title: "Add media", keywords: ["book", "movie", "series", "album", "game", "comic", "read", "watch"], icon: Plus, dialog: AddMediaCommandDialog },
  { id: "media.open", title: "Go to Nightstand", keywords: ["media", "books", "reading"], icon: BookMarked, run: ({ navigate }) => navigate("/app/media") },
];
