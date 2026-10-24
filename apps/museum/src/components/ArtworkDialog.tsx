import { useEffect, useMemo, useState } from "react";
import {
  Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, GeoField, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, Textarea, toast,
} from "@lifeline/ui";
import { geocode, initialList, initialText, normalizeTag, readGeo, suggestAddresses, useTagVocabulary, writeGeo } from "@lifeline/core";
import { Search, Trash2 } from "lucide-react";
import { ART_FORMS, artForm, isArtForm, type ArtFormId } from "../domain/artForms";
import type { Artwork } from "../domain/types";
import { applyHit } from "@lifeline/parts";
import { resolveHit, searchWikidata, type ArtworkHit } from "../data/wikidata";
import { addArtwork, deleteArtwork, ensureArtist, patchArtwork, useArtists } from "../data/repo";

/** One Wikidata candidate: label — description. Claims are pulled on pick. */
function HitRow({ hit, onPick, disabled }: { hit: ArtworkHit; onPick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} className="hover:bg-accent flex w-full flex-col rounded-md border p-2 text-left disabled:opacity-50" onClick={onPick}>
      <span className="truncate text-sm font-medium">{hit.title}</span>
      {hit.description && <span className="text-muted-foreground truncate text-xs">{hit.description}</span>}
    </button>
  );
}

/**
 * Add or edit one Artwork. The Wikidata search (by the typed title) fills
 * empty fields only — never what the user typed (ADR 0022, Media's
 * semantics). Saving links the artist by name, creating the record when it
 * is new (ensureArtist).
 */
export function ArtworkDialog({ open, onOpenChange, artwork = null, defaultForm = "painting", initial }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artwork?: Artwork | null;
  defaultForm?: ArtFormId;
  /** Create mode, the palette's inline line (CommandDialogProps.initial). */
  initial?: Record<string, unknown>;
}) {
  const artists = useArtists();
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  const [form, setForm] = useState<ArtFormId>(artwork?.type ?? defaultForm);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [artistKey, setArtistKey] = useState("");
  const [year, setYear] = useState("");
  const [location, setLocation] = useState("");
  const [materials, setMaterials] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [seen, setSeen] = useState(false);
  const [geo, setGeo] = useState<[number, number] | null>(null);
  const [externalKey, setExternalKey] = useState("");
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [hits, setHits] = useState<ArtworkHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const def = artForm(form);
  const linkedArtist = useMemo(() => artists.find((a) => a.id === artwork?.artistId), [artists, artwork]);

  useEffect(() => {
    if (!open) return;
    setForm(artwork?.type ?? (isArtForm(initialText(initial, "form")) ? (initialText(initial, "form") as ArtFormId) : defaultForm));
    setTitle(artwork?.title ?? initialText(initial, "title"));
    setArtistName(linkedArtist?.title ?? initialText(initial, "artist"));
    setArtistKey("");
    setYear(artwork?.year ?? initialText(initial, "year"));
    setLocation(artwork?.location ?? initialText(initial, "location"));
    setMaterials(artwork?.materials ?? initialText(initial, "materials"));
    setDimensions(artwork?.dimensions ?? initialText(initial, "dimensions"));
    setImageUrl(artwork?.imageUrl ?? "");
    setSeen(artwork ? !!artwork.seen : ["true", "yes", "1"].includes(String(initial?.seen).toLowerCase()));
    setGeo(artwork?.geo ?? null);
    setExternalKey(artwork?.externalKey ?? "");
    setComment(artwork?.body ?? initialText(initial, "comment"));
    setTags(artwork?.tags ?? initialList(initial, "tags"));
    setHits(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seeds the form when it opens or its subject changes, by id: a re-read of the same records must not wipe what was typed
  }, [open, artwork?.id, linkedArtist?.id, initial]);

  async function search() {
    const q = title.trim();
    if (!q) return;
    setSearching(true);
    setHits(null);
    try {
      setHits(await searchWikidata(form)(q));
    } catch (e) {
      toast.error((e as Error).message || "Wikidata search failed");
    } finally {
      setSearching(false);
    }
  }

  async function pick(hit: ArtworkHit) {
    setSearching(true);
    try {
      const full = await resolveHit(hit);
      const patch = applyHit({ year, imageUrl, location, materials, dimensions, externalKey }, full, ["year", "imageUrl", "location", "materials", "dimensions"]);
      if (typeof patch.year === "string") setYear(patch.year);
      if (typeof patch.imageUrl === "string") setImageUrl(patch.imageUrl);
      if (typeof patch.location === "string") setLocation(patch.location);
      if (typeof patch.materials === "string") setMaterials(patch.materials);
      if (typeof patch.dimensions === "string") setDimensions(patch.dimensions);
      if (typeof patch.externalKey === "string") setExternalKey(patch.externalKey);
      if (!artistName && full.artistName) {
        setArtistName(full.artistName);
        setArtistKey(full.artistKey);
      }
      if (def.locatable && !geo && typeof full.lat === "number" && typeof full.lon === "number") setGeo([full.lat, full.lon]);
      if (!title.trim()) setTitle(full.title);
      setHits(null);
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const name = artistName.trim();
      const keptArtist = linkedArtist && name === linkedArtist.title;
      const artistId = keptArtist ? linkedArtist.id : name ? await ensureArtist({ name, externalKey: artistKey || undefined }) : "";
      const fields = {
        artistId,
        year: year.trim(),
        imageUrl: imageUrl.trim(),
        location: location.trim(),
        materials: def.hasMaterials ? materials.trim() : "",
        dimensions: def.hasMaterials ? dimensions.trim() : "",
        seen,
        geo: def.locatable ? geo : null,
        externalKey,
      };
      if (artwork) {
        await patchArtwork(artwork.id, { ...fields, title: t, body: comment, tags });
        toast.success("Artwork updated");
      } else {
        const id = await addArtwork({ form, title: t, ...fields, tags });
        if (comment.trim()) await patchArtwork(id, { body: comment });
        toast.success(`Added to the Holdings: ${t}`);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!artwork) return;
    setBusy(true);
    try {
      await deleteArtwork(artwork.id);
      toast.success("Removed from the Holdings");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{artwork ? `Edit ${artForm(artwork.type).label.toLowerCase()}` : "Add artwork"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {!artwork && (
            <div className="grid gap-1.5">
              <Label htmlFor="aw-form">Art form</Label>
              <Select value={form} onValueChange={(v) => setForm(v as ArtFormId)}>
                <SelectTrigger id="aw-form">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ART_FORMS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="aw-title">Title</Label>
            <div className="flex gap-2">
              <Input id="aw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mona Lisa" autoFocus onKeyDown={(e) => e.key === "Enter" && void search()} />
              <Button type="button" variant="outline" size="icon" title="Search Wikidata" aria-label="Search Wikidata" disabled={searching || !title.trim()} onClick={() => void search()}>
                <Search className="size-4" />
              </Button>
            </div>
          </div>
          {hits !== null && (
            <div className="grid max-h-48 gap-1 overflow-y-auto">
              {hits.length === 0 && <p className="text-muted-foreground text-sm">Nothing on Wikidata for that title.</p>}
              {hits.map((h) => (
                <HitRow key={h.externalKey} hit={h} disabled={searching} onPick={() => void pick(h)} />
              ))}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="aw-artist">{def.artistLabel}</Label>
            <Input id="aw-artist" list="aw-artist-options" value={artistName} onChange={(e) => { setArtistName(e.target.value); setArtistKey(""); }} placeholder="Leonardo da Vinci" />
            <datalist id="aw-artist-options">
              {artists.map((a) => (
                <option key={a.id} value={a.title} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="aw-year">Year</Label>
              <Input id="aw-year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="c. 1503" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="aw-location">Location</Label>
              <Input id="aw-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Louvre, Paris" />
            </div>
          </div>
          {def.hasMaterials && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="aw-materials">Materials</Label>
                <Input id="aw-materials" value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="oil on canvas" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="aw-dimensions">Dimensions</Label>
                <Input id="aw-dimensions" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="77 × 53 cm" />
              </div>
            </div>
          )}
          {def.locatable && (
            <div className="grid gap-1.5">
              <Label>Coordinates</Label>
              <GeoField
                value={readGeo(geo)}
                onChange={(c) => setGeo(writeGeo(c) as [number, number] | null)}
                query={[title, location].filter(Boolean).join(", ")}
                geocode={(q) => geocode(q)}
                suggest={(q) => suggestAddresses(q)}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="aw-image">Image URL</Label>
            <Input id="aw-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            {imageUrl && <img src={imageUrl} alt="" className="max-h-40 w-fit rounded object-contain" />}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="aw-comment">Why it's in my museum</Label>
            <Textarea id="aw-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="aw-tags">Tags</Label>
            <TagInput id="aw-tags" value={tags} onChange={setTags} suggestions={tagSuggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={seen} onCheckedChange={(v) => setSeen(v === true)} /> Seen in person
          </label>
        </div>
        <DialogFooter className="gap-2">
          {artwork && (
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()} className="mr-auto">
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !title.trim()} onClick={() => void save()}>
            {artwork ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
