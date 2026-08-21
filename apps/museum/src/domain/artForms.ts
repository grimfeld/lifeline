/**
 * The art-form registry (ADR 0022): each classical art form is its own
 * built-in Document type, all owned by the one Museum App — the Document
 * `type` IS the form (the ADR 0019 amendment pattern, as in Media). Adding
 * printmaking later is adding an entry here.
 */
export interface ArtFormDef {
  id: ArtFormId;
  label: string;
  plural: string;
  /** "Artist" / "Architect" / "Photographer" / "Sculptor" — the credit wording. */
  artistLabel: string;
  /** Object forms record materials and dimensions as free text; architecture does not. */
  hasMaterials: boolean;
  /** Architecture is Locatable: a building sits at a point on the earth. */
  locatable: boolean;
}

export const ART_FORM_IDS = ["painting", "drawing", "photography", "sculpture", "architecture"] as const;
export type ArtFormId = (typeof ART_FORM_IDS)[number];

export const ART_FORMS: ArtFormDef[] = [
  { id: "painting", label: "Painting", plural: "Paintings", artistLabel: "Artist", hasMaterials: true, locatable: false },
  { id: "drawing", label: "Drawing", plural: "Drawings", artistLabel: "Artist", hasMaterials: true, locatable: false },
  { id: "photography", label: "Photograph", plural: "Photographs", artistLabel: "Photographer", hasMaterials: true, locatable: false },
  { id: "sculpture", label: "Sculpture", plural: "Sculptures", artistLabel: "Sculptor", hasMaterials: true, locatable: false },
  { id: "architecture", label: "Building", plural: "Architecture", artistLabel: "Architect", hasMaterials: false, locatable: true },
];

export function artForm(id: ArtFormId): ArtFormDef {
  const def = ART_FORMS.find((f) => f.id === id);
  if (!def) throw new Error(`Unknown art form: ${id}`);
  return def;
}

export const isArtForm = (t: string): t is ArtFormId => (ART_FORM_IDS as readonly string[]).includes(t);
