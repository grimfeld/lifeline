import { useMemo } from "react";
import { REPORT_KINDS, displayTitle, mentionable, reportKind, singularOf, todayStr, useAllDocuments, useDocumentFigures, useDocumentType, useDocumentTypes, useLinkIndex, type CardOption, type CardProps, type ReportKind, type ReportWindow } from "@lifeline/core";
import { DocumentReports, RankingReport, useOpenLinkRef } from "@lifeline/editor";

/**
 * Core's generic Report card (ADR 0076): any Report placed on a Screen or an
 * Overview — a ranking over a type's Documents in a window, or one Document's
 * figures. The same views the type's page and a Document's page show.
 */

export const REPORT_KIND_OPTIONS = REPORT_KINDS.map((k) => ({ value: k.kind, label: k.label }));
export const REPORT_WINDOW_OPTIONS = [
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

/** The types a Report can be about: those whose Documents a Day can name. */
export function useReportTypeOptions(): CardOption[] {
  const types = useDocumentTypes();
  return useMemo(() => types.filter((t) => mentionable(t)).map((t) => ({ value: t.id, label: t.label })), [types]);
}

/** Documents of those types, for a per-Document Report. */
export function useReportDocumentOptions(): CardOption[] {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => {
    const defs = new Map(types.filter((t) => mentionable(t)).map((t) => [t.id, t]));
    return docs
      .filter((d) => defs.has(d.type))
      .map((d) => ({ value: d.id, label: `${displayTitle(d, defs.get(d.type))} · ${singularOf(defs.get(d.type)!)}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [docs, types]);
}

function windowOf(name: string, today: string): ReportWindow {
  if (name === "month") return { from: `${today.slice(0, 7)}-01` };
  if (name === "year") return { from: `${today.slice(0, 4)}-01-01` };
  return {};
}

export function ReportCard({ settings, configure }: CardProps) {
  const index = useLinkIndex();
  const onOpen = useOpenLinkRef(index);
  const today = todayStr();
  const kind = (REPORT_KINDS.some((k) => k.kind === settings.kind) ? settings.kind : "top") as ReportKind;
  const def = useDocumentType(String(settings.type ?? "") || undefined);
  const docId = String(settings.doc ?? "");
  const doc = docId ? index.byId.get(docId) : undefined;
  const docDef = useDocumentType(doc?.type);
  const window = useMemo(() => windowOf(String(settings.window ?? "month"), today), [settings.window, today]);
  const figures = useDocumentFigures(index, docId, today);
  const choose = (what: string) => (
    <button type="button" className="text-muted-foreground flex h-full w-full items-center justify-center text-xs underline" onClick={configure}>
      Choose {what}…
    </button>
  );
  if (reportKind(kind).family === "document") {
    if (!doc) return choose("a Document");
    return (
      <div className="h-full min-w-0 overflow-y-auto p-1">
        <div className="mb-1 truncate text-sm font-medium">{displayTitle(doc, docDef)}</div>
        <DocumentReports index={index} def={docDef ? { ...docDef, reports: [{ kind }] } : undefined} docId={docId} />
        {figures.allTime === 0 && <p className="text-muted-foreground text-xs">No Day links to it yet.</p>}
      </div>
    );
  }
  if (!def) return choose("a type");
  return (
    <div className="h-full min-w-0 overflow-y-auto p-1">
      <RankingReport index={index} typeId={def.id} setting={{ kind, n: Number(settings.n ?? 5) || 5 }} window={window} title={`${def.label} · ${reportKind(kind).label}`} onOpen={onOpen} />
    </div>
  );
}

/** A placed card's title: the type or Document and the kind. */
export function useReportTitle(settings: CardProps["settings"]): string {
  const types = useDocumentTypes();
  const docs = useAllDocuments();
  const kind = REPORT_KINDS.find((k) => k.kind === settings.kind) ?? reportKind("top");
  if (kind.family === "document") {
    const d = docs.find((x) => x.id === settings.doc);
    return d ? `${d.title} · ${kind.label}` : kind.label;
  }
  const t = types.find((x) => x.id === settings.type);
  return t ? `${t.label} · ${kind.label}` : kind.label;
}
