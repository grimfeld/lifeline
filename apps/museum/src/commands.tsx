import type { CommandDef, CommandDialogProps } from "@lifeline/core";
import { DoorOpen, Landmark, Plus } from "lucide-react";
import { ArtworkDialog } from "./components/ArtworkDialog";
import { MUSEUM_HREF } from "./constants";
import { ART_FORMS, artForm, type ArtFormId } from "./domain/artForms";
import { addArtwork, allArtists, allArtworks, ensureArtist, patchArtwork } from "./data/repo";

function AddArtworkCommandDialog(props: CommandDialogProps) {
  return <ArtworkDialog {...props} />;
}

export const museumCommands: CommandDef[] = [
  {
    id: "museum.add",
    fold: "culture.add",
    foldLabel: "Artwork",
    title: "Add artwork…",
    keywords: ["painting", "drawing", "photograph", "sculpture", "architecture", "art", "museum", "holdings"],
    icon: Plus,
    dialog: AddArtworkCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "form", label: "Form", kind: "select", required: true, options: ART_FORMS.map((f) => ({ value: f.id, label: f.label })) },
      { key: "artist", label: "Artist", kind: "text", hint: "Their name; an Artist of that name is reused." },
      { key: "year", label: "Year", kind: "text" },
      { key: "location", label: "Where", kind: "text", hint: "Museum or place it is kept." },
      { key: "materials", label: "Materials", kind: "text", hint: "Not for buildings." },
      { key: "dimensions", label: "Dimensions", kind: "text", hint: "Not for buildings." },
      { key: "seen", label: "Seen in person", kind: "boolean" },
      { key: "comment", label: "Comment", kind: "longtext" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    returnsDocument: true,
    async invoke(a) {
      const form = a.form as ArtFormId;
      const def = artForm(form);
      const title = (a.title as string).trim();
      const name = ((a.artist as string | undefined) ?? "").trim();
      const artists = new Map((await allArtists()).map((x) => [x.id, x.title.trim().toLowerCase()]));
      const twin = (await allArtworks()).find((w) => w.title.trim().toLowerCase() === title.toLowerCase() && (artists.get(w.artistId) ?? "") === name.toLowerCase());
      if (twin) throw new Error(`“${twin.title}” is already in the Holdings; tell the user — nothing was changed`);
      const artistId = name ? await ensureArtist({ name }) : "";
      const id = await addArtwork({
        form,
        title,
        artistId,
        year: a.year as string | undefined,
        location: a.location as string | undefined,
        materials: def.hasMaterials ? (a.materials as string | undefined) : "",
        dimensions: def.hasMaterials ? (a.dimensions as string | undefined) : "",
        seen: !!a.seen,
        tags: a.tags as string[] | undefined,
      });
      if (a.comment) await patchArtwork(id, { body: a.comment as string });
      return { id, message: `Added to the Holdings: ${title}` };
    },
  },
  { id: "museum.open", title: "Go to Museum", keywords: ["museum", "art", "gallery", "exhibition", "holdings", "artwork"], icon: Landmark, run: ({ navigate }) => navigate(MUSEUM_HREF) },
  { id: "museum.exhibitions", title: "Go to Exhibitions", keywords: ["exhibition", "hang", "curate", "rooms", "museum"], icon: DoorOpen, run: ({ navigate }) => navigate(MUSEUM_HREF) },
];
