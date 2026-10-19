import { Checkbox, GeoField, Label } from "@lifeline/ui";
import { geocode, readGeo, suggestAddresses, writeGeo, type PeekProps } from "@lifeline/core";
import { PeekField, PeekInput } from "@lifeline/parts";
import { artForm } from "../domain/artForms";
import type { Artwork } from "../domain/types";
import { ensureArtist, normalizeArtwork, patchArtwork, useArtists } from "../data/repo";

/**
 * An Artwork's editable Peek (ADR 0085): the Museum's own Fields edited in
 * place — who made it (found or created by name, as the Artwork dialog does),
 * when, where it is, what it is made of, whether I have seen it. The title,
 * the body (why it is in my museum) and the user's own Fields are Core's.
 */
export function ArtworkPeek({ doc }: PeekProps) {
  const artwork = normalizeArtwork(doc as Artwork);
  const form = artForm(artwork.type);
  const artists = useArtists();
  const artist = artists.find((a) => a.id === artwork.artistId);
  const patch = (p: Record<string, unknown>) => void patchArtwork(artwork.id, p);
  const id = (key: string) => `peek-artwork-${key}`;

  // Naming the Artist links it, creating the record when it is new: written on leaving the box, not per keystroke.
  async function setArtist(name: string) {
    const n = name.trim();
    if (n === (artist?.title ?? "")) return;
    await patchArtwork(artwork.id, { artistId: n ? await ensureArtist({ name: n }) : "" });
  }

  return (
    <div className="grid gap-3">
      <PeekInput id={id("artist")} label={form.artistLabel} value={artist?.title ?? ""} delay={null} onCommit={(n) => void setArtist(n)} placeholder="Leonardo da Vinci" />
      <div className="grid grid-cols-2 gap-2">
        <PeekInput id={id("year")} label="Year" value={artwork.year} placeholder="c. 1503" onCommit={(year) => patch({ year })} />
        <PeekInput id={id("location")} label="Location" value={artwork.location} placeholder="Louvre, Paris" onCommit={(location) => patch({ location })} />
      </div>
      {form.hasMaterials && (
        <div className="grid grid-cols-2 gap-2">
          <PeekInput id={id("materials")} label="Materials" value={artwork.materials} placeholder="oil on canvas" onCommit={(materials) => patch({ materials })} />
          <PeekInput id={id("dimensions")} label="Dimensions" value={artwork.dimensions} placeholder="77 × 53 cm" onCommit={(dimensions) => patch({ dimensions })} />
        </div>
      )}
      {form.locatable && (
        <PeekField label="Coordinates">
          <GeoField
            value={readGeo(artwork.geo)}
            onChange={(c) => patch({ geo: writeGeo(c) })}
            query={[artwork.title, artwork.location].filter(Boolean).join(", ")}
            geocode={(q) => geocode(q)}
            suggest={(q) => suggestAddresses(q)}
          />
        </PeekField>
      )}
      <PeekInput id={id("image")} label="Image URL" type="url" value={artwork.imageUrl} placeholder="https://…" onCommit={(imageUrl) => patch({ imageUrl })} />
      <div className="flex items-center gap-2">
        <Checkbox id={id("seen")} checked={artwork.seen} onCheckedChange={(v) => patch({ seen: v === true })} />
        <Label htmlFor={id("seen")} className="text-sm font-normal">
          Seen in person
        </Label>
      </div>
    </div>
  );
}
