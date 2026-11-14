import type { ContactDetail, ContactKind } from "./types";

/** What a click on a Contact detail opens: a link the browser hands to the phone, the mail app or a new tab. */
export interface ContactAction {
  href: string;
  /** Opens in a new tab (a service's page), not the device's phone or mail app. */
  external: boolean;
}

export const CONTACT_KINDS: readonly ContactKind[] = ["phone", "email", "handle"];
export const KIND_LABELS: Record<ContactKind, string> = { phone: "Phone", email: "Email", handle: "Handle" };

/** The services a handle's label can name: where `@name` is a page. Kept small on purpose; a typed web address needs no entry. */
const SERVICES: { names: string[]; url: (name: string) => string }[] = [
  { names: ["instagram", "insta", "ig"], url: (n) => `https://instagram.com/${n}` },
  { names: ["x", "twitter"], url: (n) => `https://x.com/${n}` },
  { names: ["github"], url: (n) => `https://github.com/${n}` },
  { names: ["telegram"], url: (n) => `https://t.me/${n}` },
  { names: ["tiktok"], url: (n) => `https://tiktok.com/@${n}` },
  { names: ["linkedin"], url: (n) => `https://linkedin.com/in/${n}` },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[\w.-]+$/;

function handleAction(label: string, raw: string): ContactAction | null {
  const value = raw.trim();
  // A typed web address opens as it is; any other scheme (javascript:, ftp:…) matches none of the shapes below, so never does.
  if (/^https?:\/\/\S+$/i.test(value)) return { href: value, external: true };
  if (/^(www\.)?[\w-]+(\.[\w-]+)+\/\S*$/i.test(value)) return { href: `https://${value}`, external: true };
  // @user@host is a Fediverse address: the server is the host.
  const fedi = /^@?([\w.-]+)@([\w-]+(?:\.[\w-]+)+)$/.exec(value);
  if (fedi) return { href: `https://${fedi[2]}/@${fedi[1]}`, external: true };
  const name = value.replace(/^@/, "");
  const service = SERVICES.find((s) => s.names.includes(label.trim().toLowerCase()));
  if (service && NAME.test(name)) return { href: service.url(name), external: true };
  return null;
}

/** The click action of a current Contact detail; null for a former one (history, no action) or a value that is not usable. */
export function contactAction(detail: ContactDetail): ContactAction | null {
  if (detail.former) return null;
  const value = detail.value.trim();
  if (detail.kind === "phone") {
    const digits = value.replace(/[^\d+]/g, "");
    return /\d{3,}/.test(digits) && /^[\d\s()+.-]+$/.test(value) ? { href: `tel:${digits}`, external: false } : null;
  }
  if (detail.kind === "email") return EMAIL.test(value) ? { href: `mailto:${value}`, external: false } : null;
  return handleAction(detail.label, value);
}

/**
 * One of the Person page's Call, Email and Profile buttons (#422): it acts on its
 * kind's first current detail, or, with no usable one (`action` null), adds one of `kind`.
 */
export type QuickContact =
  | { kind: ContactKind; detail: ContactDetail; action: ContactAction }
  /** `detail` is the unusable current one, or null when there is none. */
  | { kind: ContactKind; detail: ContactDetail | null; action: null };

/** The Call, Email and Profile buttons, one per kind: each its kind's first current detail (a former one is skipped). */
export function quickContacts(person: { contactDetails?: unknown }): QuickContact[] {
  const details = contactDetailsOf(person);
  return CONTACT_KINDS.map((kind) => {
    const detail = details.find((c) => c.kind === kind && !c.former) ?? null;
    const action = detail && contactAction(detail);
    return detail && action ? { kind, detail, action } : { kind, detail, action: null };
  });
}

export interface DetailInput {
  id?: string;
  label: string;
  kind: ContactKind;
  value: string;
}

/** What a kind's value is called: "Give the number." */
const VALUE_NOUNS: Record<ContactKind, string> = { phone: "number", email: "address", handle: "handle" };

/** What is wrong with a Contact detail's label, for the form to show under it; null when nothing. */
export function detailLabelProblem(input: Pick<DetailInput, "label">): string | null {
  return input.label.trim() ? null : "Give it a label.";
}

/** What is wrong with a Contact detail's value, for the form to show under it; null when nothing. */
export function detailValueProblem(input: Pick<DetailInput, "kind" | "value">): string | null {
  return input.value.trim() ? null : `Give the ${VALUE_NOUNS[input.kind]}.`;
}

/** A Person's Contact details as stored, tolerating a row that has none or a damaged entry. */
export function contactDetailsOf(doc: { contactDetails?: unknown }): ContactDetail[] {
  if (!Array.isArray(doc.contactDetails)) return [];
  return doc.contactDetails.flatMap((c): ContactDetail[] => {
    if (!c || typeof c !== "object") return [];
    const { id, label, kind, value, former } = c as Record<string, unknown>;
    if (typeof id !== "string" || typeof label !== "string" || typeof value !== "string" || !CONTACT_KINDS.includes(kind as ContactKind)) return [];
    return [{ id, label, kind: kind as ContactKind, value, former: former === true }];
  });
}

/** Add (no id) or edit (an id of the list) one; an edit keeps the entry's place and whether it is former. */
export function saveDetail(list: readonly ContactDetail[], input: DetailInput, newId: () => string = () => crypto.randomUUID()): ContactDetail[] {
  const fields = { label: input.label.trim(), kind: input.kind, value: input.value.trim() };
  if (input.id && list.some((c) => c.id === input.id)) return list.map((c) => (c.id === input.id ? { ...c, ...fields } : c));
  return [...list, { id: newId(), ...fields, former: false }];
}

export const markFormer = (list: readonly ContactDetail[], id: string, former: boolean): ContactDetail[] => list.map((c) => (c.id === id ? { ...c, former } : c));
