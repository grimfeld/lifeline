import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocument } from "@lifeline/core";
import { Button, Page, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { WorkPage } from "@lifeline/parts";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import { ACQ_LABEL, ACQUISITION, WORK_TYPE_IDS, type Acquisition, type Work } from "../domain/types";
import { acquisitionPatch } from "../domain/rules";
import { normalize, patchWork } from "../data/repo";
import { APP_HREF } from "../constants";
import { Cover } from "../components/Cover";
import { WorkActionsMenu } from "../components/WorkActions";
import { LookupActions } from "../components/LookupActions";
import { ArcadeWorkFields } from "../components/ArcadePeeks";

const back = (
  <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Arcade
  </Link>
);

/**
 * The Work page (CONTEXT.md) of a game — the shared frame from the Parts kit
 * with the Arcade's Fields, its Shelf and Owned transitions and its lookup.
 * Games keep no Parts, Marks or Review.
 */
export function WorkScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const row = useDocument<Work>(id);
  const item = useMemo(() => (row && !row.deleted && WORK_TYPE_IDS.includes(row.type) ? normalize(row) : undefined), [row]);

  if (!item) {
    return (
      <Page>
        {back}
        <p className="text-muted-foreground text-sm">No such game.</p>
      </Page>
    );
  }

  const def = workType(item.type);
  const status = [def.engagement[item.engagement], ACQ_LABEL[item.acquisition]].join(" · ");

  return (
    <WorkPage
      work={item}
      onPatch={(patch) => patchWork(item, patch)}
      back={back}
      cover={<Cover item={item} size="fill" className="rounded-md border shadow" />}
      byline={
        <>
          {item.creator}
          {item.year ? `${item.creator ? " · " : ""}${item.year}` : ""}
          {item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
        </>
      }
      status={status}
      review={false}
      actions={
        <>
          <WorkActionsMenu
            item={item}
            onDeleted={() => navigate(APP_HREF)}
            trigger={
              <Button size="sm" variant="outline">
                Shelf <ChevronDown />
              </Button>
            }
          />
          <Select value={item.acquisition} onValueChange={(v) => void patchWork(item, acquisitionPatch(v as Acquisition))}>
            <SelectTrigger size="sm" aria-label="Owned">
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
          <LookupActions item={item} />
        </>
      }
      fields={<ArcadeWorkFields item={item} tags />}
      dates={[
        { label: "Added", value: item.addedOn },
        { label: "Acquired", value: item.acquiredOn },
        { label: "Started", value: item.startedOn },
        { label: "Finished", value: item.finishedOn },
      ]}
    />
  );
}
