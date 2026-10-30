import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocument } from "@lifeline/core";
import { Button, Page } from "@lifeline/ui";
import { LookupActions, PartsSection, PlaylistsSection, WorkPage } from "@lifeline/parts";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import { WORK_TYPE_IDS, type Work } from "../domain/types";
import { playlistsWith } from "../domain/playlist";
import { normalize, patchWork, usePlaylists } from "../data/repo";
import { APP_HREF } from "../constants";
import { discothequeParts } from "../parts";
import { Cover } from "../components/Cover";
import { WorkActionsMenu } from "../components/WorkActions";
import { lookupFor } from "../data/lookup";
import { refreshFromSource } from "../data/enrichActions";
import { FindMetadataDialog } from "../components/FindMetadataDialog";
import { AddToPlaylistDialog } from "../components/AddToPlaylistDialog";
import { DiscothequeWorkFields } from "../components/DiscothequePeeks";

/** MusicBrainz is keyless — one stable empty-keys object. */
const NO_KEYS = {};

const back = (
  <Link to={APP_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
    <ArrowLeft className="size-4" /> Discotheque
  </Link>
);

/**
 * The Work page (CONTEXT.md): one album in full — the shared frame from the
 * Parts kit, with the Discotheque's Fields, its Shelf menu, its lookup, its
 * Tracks and Discs and the Playlists it sits in.
 */
export function WorkScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const row = useDocument<Work>(id);
  const playlists = usePlaylists();
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
  const inLists = playlistsWith(playlists, item.id);

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
          <LookupActions
            available={lookupFor(item.type, NO_KEYS) !== null}
            canRefresh={!!item.externalKey}
            refresh={() => refreshFromSource(item, NO_KEYS)}
            findDialog={(onClose) => <FindMetadataDialog item={item} onClose={onClose} />}
          />
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
      <PlaylistsSection titles={inLists.map((p) => p.title)} addDialog={(open, onOpenChange) => <AddToPlaylistDialog item={item} open={open} onOpenChange={onOpenChange} />} />
    </WorkPage>
  );
}
