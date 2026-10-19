import { useId } from "react";
import { Checkbox, CommitField, Field, GeoField, Label } from "@lifeline/ui";
import { geocode, readGeo, suggestAddresses, writeGeo, type PeekProps } from "@lifeline/core";
import { PEEK_WRITE_DELAY } from "@lifeline/parts";
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
  const patch = (p: Record<string, unknown>) => patchArtwork(artwork.id, p);
  const seenId = useId();

  // Naming the Artist links it, creating the record when it is new: written on leaving the box, not per keystroke.
  async function setArtist(name: string) {
    const n = name.trim();
    if (n === (artist?.title ?? "")) return;
    await patchArtwork(artwork.id, { artistId: n ? await ensureArtist({ name: n }) : "" });
  }

  return (
    <div className="grid gap-3">
      <CommitField label={form.artistLabel} value={artist?.title ?? ""} onCommit={setArtist} placeholder="Leonardo da Vinci" />
      <div className="grid grid-cols-2 gap-2">
        <CommitField label="Year" delay={PEEK_WRITE_DELAY} value={artwork.year} placeholder="c. 1503" onCommit={(year) => patch({ year })} />
        <CommitField label="Location" delay={PEEK_WRITE_DELAY} value={artwork.location} placeholder="Louvre, Paris" onCommit={(location) => patch({ location })} />
      </div>
      {form.hasMaterials && (
        <div className="grid grid-cols-2 gap-2">
          <CommitField label="Materials" delay={PEEK_WRITE_DELAY} value={artwork.materials} placeholder="oil on canvas" onCommit={(materials) => patch({ materials })} />
          <CommitField label="Dimensions" delay={PEEK_WRITE_DELAY} value={artwork.dimensions} placeholder="77 × 53 cm" onCommit={(dimensions) => patch({ dimensions })} />
        </div>
      )}
      {form.locatable && (
        <Field label="Coordinates">
          <GeoField
            value={readGeo(artwork.geo)}
            onChange={(c) => void patch({ geo: writeGeo(c) })}
            query={[artwork.title, artwork.location].filter(Boolean).join(", ")}
            geocode={(q) => geocode(q)}
            suggest={(q) => suggestAddresses(q)}
          />
        </Field>
      )}
      <CommitField label="Image URL" type="url" delay={PEEK_WRITE_DELAY} value={artwork.imageUrl} placeholder="https://…" onCommit={(imageUrl) => patch({ imageUrl })} />
      <div className="flex items-center gap-2">
        <Checkbox id={seenId} checked={artwork.seen} onCheckedChange={(v) => void patch({ seen: v === true })} />
        <Label htmlFor={seenId} className="text-sm font-normal">
          Seen in person
        </Label>
      </div>
    </div>
  );
}
