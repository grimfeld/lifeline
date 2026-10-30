import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocument } from "@lifeline/core";
import { Button, cn, Page, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { LookupActions, PartsSection, Section, WorkPage } from "@lifeline/parts";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import { ACQ_LABEL, ACQUISITION, WORK_TYPE_IDS, type Acquisition, type Work } from "../domain/types";
import { acquisitionPatch, slotAge } from "../domain/rules";
import { sameSeries } from "../domain/browse";
import { normalize, patchWork, useWorks, useLookupSettings } from "../data/repo";
import { APP_HREF, workHref } from "../constants";
import { libraryParts } from "../parts";
import { Cover } from "../components/Cover";
import { AuthorNames } from "../components/AuthorNames";
import { WorkActionsMenu } from "../components/WorkActions";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "../components/FindMetadataDialog";
import { LibraryWorkFields } from "../components/LibraryPeeks";

const back = (
  <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Library
  </Link>
);

/** The other works of its series on the shelf, in series order, itself among them. */
function SeriesList({ work, all }: { work: Work; all: Work[] }) {
  const series = useMemo(() => sameSeries(work, all), [work, all]);
  if (series.length < 2) return null;
  return (
    <Section title={work.series} label="Series">
      <ol className="grid gap-1">
        {series.map((w) => {
          const here = w.id === work.id;
          return (
            <li key={w.id} className={cn("flex min-w-0 items-center gap-3 rounded-md px-2 py-1", here && "bg-accent")}>
              <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">{w.seriesNumber ? `#${w.seriesNumber}` : ""}</span>
              <Cover item={w} className="shrink-0" />
              {here ? (
                <span className="min-w-0 flex-1 truncate text-sm font-medium" aria-current="page">
                  {w.title}
                </span>
              ) : (
                <Link to={workHref(w.id)} className="min-w-0 flex-1 truncate text-sm underline-offset-2 hover:underline">
                  {w.title}
                </Link>
              )}
              <span className="text-muted-foreground shrink-0 text-xs">{workType(w.type).engagement[w.engagement]}</span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/**
 * The Work page (CONTEXT.md): one book, comic or manga in full — the shared
 * frame from the Parts kit, with the Library's Fields, its Shelf, Acquisition
 * and Nightstand transitions, its lookup and its series.
 */
export function WorkScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const row = useDocument<Work>(id);
  const settings = useLookupSettings();
  const all = useWorks();
  const item = useMemo(() => (row && !row.deleted && WORK_TYPE_IDS.includes(row.type) ? normalize(row) : undefined), [row]);

  if (!item) {
    return (
      <Page>
        {back}
        <p className="text-muted-foreground text-sm">No such work.</p>
      </Page>
    );
  }

  const def = workType(item.type);
  const age = slotAge(item);
  const status = [def.label, def.engagement[item.engagement], item.slot > 0 ? `Nightstand #${item.slot}${age !== null ? `, ${age}d` : ""}` : ""].filter(Boolean).join(" · ");

  return (
    <WorkPage
      work={item}
      onPatch={(patch) => patchWork(item, patch)}
      back={back}
      cover={<Cover item={item} size="fill" className="rounded-md border shadow" />}
      byline={
        <>
          <AuthorNames item={item} />
          {item.year ? `${item.authors.length ? " · " : ""}${item.year}` : ""}
          {item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
        </>
      }
      status={status}
      actions={
        <>
          <WorkActionsMenu
            item={item}
            all={all}
            onDeleted={() => navigate(APP_HREF)}
            trigger={
              <Button size="sm" variant="outline">
                Shelf <ChevronDown />
              </Button>
            }
          />
          <Select value={item.acquisition} onValueChange={(v) => void patchWork(item, acquisitionPatch(v as Acquisition))}>
            <SelectTrigger size="sm" aria-label="Acquisition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACQUISITION.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACQ_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LookupActions
            available={lookupFor(item.type, settings) !== null}
            canRefresh={!!item.externalKey}
            refresh={() => refreshFromSource(item, settings)}
            findDialog={(onClose) => <FindMetadataDialog item={item} onClose={onClose} />}
          />
        </>
      }
      fields={<LibraryWorkFields item={item} tags />}
      parts={<PartsSection kit={libraryParts} work={item} />}
      dates={[
        { label: "Added", value: item.addedOn },
        { label: "Acquired", value: item.acquiredOn },
        { label: "Slotted", value: item.slottedOn },
        { label: "Started", value: item.startedOn },
        { label: "Finished", value: item.finishedOn },
      ]}
    >
      <SeriesList work={item} all={all} />
    </WorkPage>
  );
}

