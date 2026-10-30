import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocument } from "@lifeline/core";
import { Badge, Button, Page } from "@lifeline/ui";
import { PartsSection, WorkPage } from "@lifeline/parts";
import { ArrowLeft, ChevronDown, ListPlus } from "lucide-react";
import { workType } from "../domain/workTypes";
import { WORK_TYPE_IDS, type Work } from "../domain/types";
import { setReview } from "../domain/rules";
import { playlistsWith } from "../domain/playlist";
import { normalize, patchWork, usePlaylists } from "../data/repo";
import { APP_HREF } from "../constants";
import { cinemaParts } from "../parts";
import { Cover } from "../components/Cover";
import { WorkActionsMenu } from "../components/WorkActions";
import { LookupActions } from "../components/LookupActions";
import { CinemaWorkFields } from "../components/CinemaPeeks";
import { AddToPlaylistDialog } from "../components/AddToPlaylistDialog";

const back = (
  <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Cinema
  </Link>
);

/** "In playlists: …" with the way to add more. */
function Playlists({ item }: { item: Work }) {
  const inLists = playlistsWith(usePlaylists(), item.id);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {inLists.length > 0 && <span className="text-muted-foreground min-w-0 break-words">In {inLists.map((p) => p.title).join(", ")}</span>}
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setOpen(true)}>
        <ListPlus className="size-3" /> Add to playlist…
      </Button>
      <AddToPlaylistDialog item={item} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/**
 * The Work page (CONTEXT.md): one film or series in full — the shared frame
 * from the Parts kit, with the Cinema's Fields, its Shelf transitions, its
 * lookup, its Playlists and its Seasons and Episodes.
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
        <p className="text-muted-foreground text-sm">No such work.</p>
      </Page>
    );
  }

  const def = workType(item.type);
  return (
    <WorkPage
      work={item}
      onPatch={(patch) => patchWork(item, patch.body === undefined ? patch : { ...patch, ...setReview(patch.body) })}
      back={back}
      cover={<Cover item={item} size="fill" className="rounded-md border shadow" />}
      byline={
        <>
          {item.creator}
          {item.year ? `${item.creator ? " · " : ""}${item.year}` : ""}
          {item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
        </>
      }
      status={
        <Badge variant={item.engagement === "IN_PROGRESS" ? "default" : "secondary"}>
          {def.label} · {def.engagement[item.engagement]}
        </Badge>
      }
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
          <LookupActions item={item} />
        </>
      }
      fields={<CinemaWorkFields item={item} tags />}
      parts={<PartsSection kit={cinemaParts} work={item} />}
      dates={[
        { label: "Added", value: item.addedOn },
        { label: "Started", value: item.startedOn },
        { label: "Finished", value: item.finishedOn },
      ]}
    >
      <Playlists item={item} />
    </WorkPage>
  );
}
