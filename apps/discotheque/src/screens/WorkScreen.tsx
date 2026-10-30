import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocument } from "@lifeline/core";
import { Button, Page } from "@lifeline/ui";
import { PartsSection, WorkPage } from "@lifeline/parts";
import { ArrowLeft, ChevronDown, ListPlus } from "lucide-react";
import { workType } from "../domain/workTypes";
import { WORK_TYPE_IDS, type Work } from "../domain/types";
import { playlistsWith } from "../domain/playlist";
import { normalize, patchWork, usePlaylists } from "../data/repo";
import { APP_HREF } from "../constants";
import { discothequeParts } from "../parts";
import { Cover } from "../components/Cover";
import { WorkActionsMenu } from "../components/WorkActions";
import { LookupActions } from "../components/LookupActions";
import { AddToPlaylistDialog } from "../components/AddToPlaylistDialog";
import { DiscothequeWorkFields } from "../components/DiscothequePeeks";

const back = (
  <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Discotheque
  </Link>
);

/** "In playlists: …" with the way to add more. */
function Playlists({ item }: { item: Work }) {
  const inLists = playlistsWith(usePlaylists(), item.id);
  const [open, setOpen] = useState(false);
  return (
    <section className="grid min-w-0 gap-2" aria-label="Playlists">
      <h2 className="text-muted-foreground text-sm font-medium">Playlists</h2>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {inLists.length > 0 ? <span className="min-w-0 break-words">In {inLists.map((p) => p.title).join(", ")}</span> : <span className="text-muted-foreground">In no playlist yet.</span>}
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <ListPlus /> Add to playlist…
        </Button>
      </div>
      <AddToPlaylistDialog item={item} open={open} onOpenChange={setOpen} />
    </section>
  );
}

/**
 * The Work page (CONTEXT.md): one album in full — the shared frame from the
 * Parts kit, with the Discotheque's Fields, its Shelf menu, its lookup, its
 * Tracks and Discs and the Playlists it sits in.
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
        <p className="text-muted-foreground text-sm">No such album.</p>
      </Page>
    );
  }

  const def = workType(item.type);

  return (
    <WorkPage
      work={item}
      onPatch={(patch) => patchWork(item, patch)}
      back={back}
      cover={<Cover item={item} size="fill" className="rounded-md border shadow" />}
      byline={
        <span className="break-words">
          {item.creator}
          {item.year ? `${item.creator ? " · " : ""}${item.year}` : ""}
          {item.size ? ` · ${item.size} ${def.sizeUnit}` : ""}
        </span>
      }
      status={def.engagement[item.engagement]}
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
      fields={<DiscothequeWorkFields item={item} tags />}
      parts={<PartsSection kit={discothequeParts} work={item} />}
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
