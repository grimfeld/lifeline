import type { CommandDef } from "@lifeline/core";
import { DoorOpen, Landmark, Plus } from "lucide-react";
import { ArtworkDialog } from "./components/ArtworkDialog";
import { MUSEUM_HREF } from "./constants";

function AddArtworkCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ArtworkDialog {...props} />;
}

export const museumCommands: CommandDef[] = [
  { id: "museum.add", title: "Add artwork…", keywords: ["painting", "drawing", "photograph", "sculpture", "architecture", "art", "museum", "holdings"], icon: Plus, dialog: AddArtworkCommandDialog, capture: true },
  { id: "museum.open", title: "Go to Museum", keywords: ["museum", "art", "gallery", "exhibition", "holdings", "artwork"], icon: Landmark, run: ({ navigate }) => navigate(MUSEUM_HREF) },
  { id: "museum.exhibitions", title: "Go to Exhibitions", keywords: ["exhibition", "hang", "curate", "rooms", "museum"], icon: DoorOpen, run: ({ navigate }) => navigate(MUSEUM_HREF) },
];
