import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocument } from "@lifeline/core";
import { Button, Page } from "@lifeline/ui";
import { LookupActions, PartsSection, PlaylistsSection, WorkPage } from "@lifeline/parts";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import { WORK_TYPE_IDS, type Work } from "../domain/types";
import { setReview } from "../domain/rules";
import { playlistsWith } from "../domain/playlist";
import { normalize, patchWork, usePlaylists, useLookupSettings } from "../data/repo";
import { APP_HREF } from "../constants";
import { cinemaParts } from "../parts";
import { Cover } from "../components/Cover";
import { WorkActionsMenu } from "../components/WorkActions";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "../components/FindMetadataDialog";
import { CinemaWorkFields } from "../components/CinemaPeeks";
import { AddToPlaylistDialog } from "../components/AddToPlaylistDialog";

const back = (
  <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Cinema
  </Link>
);

/**
 * The Work page (CONTEXT.md): one film or series in full — the shared frame
 * from the Parts kit, with the Cinema's Fields, its Shelf transitions, its
 * lookup, its Playlists and its Seasons and Episodes.
 */
export function WorkScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const row = useDocument<Work>(id);
  const playlists = usePlaylists();
  const settings = useLookupSettings();
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
  const inLists = playlistsWith(playlists, item.id);
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
      status={`${def.label} · ${def.engagement[item.engagement]}`}
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
          <LookupActions
            available={lookupFor(item.type, settings) !== null}
            canRefresh={!!item.externalKey}
            refresh={() => refreshFromSource(item, settings)}
            findDialog={(onClose) => <FindMetadataDialog item={item} onClose={onClose} />}
          />
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
      <PlaylistsSection titles={inLists.map((p) => p.title)} addDialog={(open, onOpenChange) => <AddToPlaylistDialog item={item} open={open} onOpenChange={onOpenChange} />} />
    </WorkPage>
  );
}
