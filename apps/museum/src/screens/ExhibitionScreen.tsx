import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { artForm } from "../domain/artForms";
import type { Artist, Artwork, Room } from "../domain/types";
import { STATE_LABELS, canHang, canReopen, canTakeDown, moveInRoom, removeFromRoom, roomsOf, swapOrders } from "../domain/rules";
import {
  addRoom, deleteRoom, hangExhibition, hangInRoom, renameRoom, reopenExhibition, setRoomArtworks, setRoomOrder, takeDownExhibition,
  useArtists, useArtworks, useExhibition, useRooms,
} from "../data/repo";
import { ArtworkImage } from "../components/ArtworkImage";
import { ArtworkDialog } from "../components/ArtworkDialog";
import { MUSEUM_HREF } from "../constants";

function placard(a: Artwork, artistOf: Map<string, Artist>): string {
  return [artistOf.get(a.artistId)?.title, a.year].filter(Boolean).join(", ");
}

/** One wall in the walk: the room's works at full aspect, each with its placard. */
function Wall({ room, byId, artistOf, onOpen }: { room: Room; byId: Map<string, Artwork>; artistOf: Map<string, Artist>; onOpen: (a: Artwork) => void }) {
  const works = room.artworkIds.map((id) => byId.get(id)).filter((a): a is Artwork => !!a);
  if (works.length === 0) return <p className="text-muted-foreground text-sm">This room is empty.</p>;
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-10 gap-y-8 py-6">
      {works.map((a) => {
        const detail = [a.materials, a.dimensions].filter(Boolean).join(" · ");
        return (
          <figure key={a.id} className="max-w-[28rem] min-w-40">
            <button type="button" className="block h-72 w-full cursor-zoom-in" title={a.title} onClick={() => onOpen(a)}>
              <span className="flex h-full items-end justify-center">
                <ArtworkImage artwork={a} size="wall" className="shadow-md" />
              </span>
            </button>
            <figcaption className="mt-2 grid gap-0.5 text-center">
              <span className="text-sm font-medium italic">{a.title}</span>
              <span className="text-muted-foreground text-xs">{placard(a, artistOf) || artForm(a.type).label}</span>
              {(detail || a.location) && <span className="text-muted-foreground text-[10px]">{[detail, a.location].filter(Boolean).join(" — ")}</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** Curation, one room at a time: rename, reorder, hang and re-hang works. */
function RoomEditor({ room, rooms, artworks, byId, artistOf, onOpen }: { room: Room; rooms: Room[]; artworks: Artwork[]; byId: Map<string, Artwork>; artistOf: Map<string, Artist>; onOpen: (a: Artwork) => void }) {
  const [name, setName] = useState(room.title);
  const [pick, setPick] = useState("");
  const idx = rooms.findIndex((r) => r.id === room.id);
  const candidates = artworks.filter((a) => !room.artworkIds.includes(a.id)).sort((a, b) => a.title.localeCompare(b.title));
  function swap(other: Room) {
    const [pa, pb] = swapOrders(room, other);
    void setRoomOrder(room.id, pa.order as number);
    void setRoomOrder(other.id, pb.order as number);
  }
  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== room.title && void renameRoom(room.id, name)} className="h-8 w-56 font-medium" aria-label="Room name" />
        <span className="text-muted-foreground text-xs">
          {room.artworkIds.length} work{room.artworkIds.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="size-7 p-0" disabled={idx <= 0} title="Earlier in the walk" onClick={() => swap(rooms[idx - 1])}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="size-7 p-0" disabled={idx >= rooms.length - 1} title="Later in the walk" onClick={() => swap(rooms[idx + 1])}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive size-7 p-0" title="Delete room (the works stay in the Holdings)" onClick={() => void deleteRoom(room.id)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {room.artworkIds.map((id) => {
          const a = byId.get(id);
          if (!a) return null;
          return (
            <li key={id} className="group relative w-28">
              <button type="button" className="block w-full" title={a.title} onClick={() => onOpen(a)}>
                <ArtworkImage artwork={a} size="tile" />
                <span className="line-clamp-1 text-[10px]">{a.title}</span>
                <span className="text-muted-foreground line-clamp-1 text-[9px]">{placard(a, artistOf)}</span>
              </button>
              <span className="absolute top-0.5 right-0.5 hidden gap-0.5 group-hover:flex">
                <Button size="sm" variant="secondary" className="size-5 p-0" title="Left" onClick={() => void setRoomArtworks(room.id, moveInRoom(room.artworkIds, id, -1))}>
                  <ArrowLeft className="size-3" />
                </Button>
                <Button size="sm" variant="secondary" className="size-5 p-0" title="Right" onClick={() => void setRoomArtworks(room.id, moveInRoom(room.artworkIds, id, 1))}>
                  <ArrowRight className="size-3" />
                </Button>
                <Button size="sm" variant="secondary" className="size-5 p-0" title="Take off the wall" onClick={() => void setRoomArtworks(room.id, removeFromRoom(room.artworkIds, id))}>
                  <X className="size-3" />
                </Button>
              </span>
            </li>
          );
        })}
        <li className="flex w-28 items-center">
          <Select value={pick} onValueChange={(v) => { setPick(""); const a = byId.get(v); if (a) void hangInRoom(room, a.id); }}>
            <SelectTrigger className="h-8 text-xs" aria-label="Hang an artwork">
              <SelectValue placeholder="Hang…" />
            </SelectTrigger>
            <SelectContent>
              {candidates.length === 0 && <div className="text-muted-foreground px-2 py-1.5 text-xs">Everything already hangs here.</div>}
              {candidates.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.title}
                  {artistOf.get(a.artistId) ? ` — ${artistOf.get(a.artistId)!.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </li>
      </ul>
    </section>
  );
}

/**
 * One Exhibition: in preparation it is the curation bench (rooms, walls,
 * ordering); hanging or archived it is the walk — one room at a time,
 * exactly the museum feel the rooms exist for (ADR 0022).
 */
export function ExhibitionScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const show = useExhibition(id);
  const allRooms = useRooms();
  const artworks = useArtworks();
  const artists = useArtists();
  const [roomIdx, setRoomIdx] = useState(0);
  const [newRoom, setNewRoom] = useState("");
  const [editing, setEditing] = useState<Artwork | null>(null);

  const rooms = useMemo(() => (show ? roomsOf(allRooms, show.id) : []), [allRooms, show]);
  const byId = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);
  const artistOf = useMemo(() => new Map(artists.map((a) => [a.id, a])), [artists]);

  if (!show) return <div className="text-muted-foreground p-4 text-sm">This exhibition does not exist (any more).</div>;
  const curating = show.state === "PREP";
  const current = rooms[Math.min(roomIdx, Math.max(0, rooms.length - 1))];

  return (
    <div className="grid content-start gap-4 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate(MUSEUM_HREF)}>
          <ChevronLeft className="size-4" /> Museum
        </Button>
        <h1 className="text-lg font-semibold">{show.title}</h1>
        <Badge variant={show.state === "HANGING" ? "default" : "outline"}>{STATE_LABELS[show.state]}</Badge>
        <div className="ml-auto flex gap-2">
          {canHang(show.state) && (
            <Button size="sm" onClick={() => void hangExhibition(show.id)}>
              Hang
            </Button>
          )}
          {canTakeDown(show.state) && (
            <Button size="sm" variant="outline" onClick={() => void takeDownExhibition(show.id)}>
              Take down
            </Button>
          )}
          {canReopen(show.state) && (
            <Button size="sm" variant="outline" title="Back to preparation" onClick={() => void reopenExhibition(show.id)}>
              Reopen
            </Button>
          )}
        </div>
      </header>
      {show.body && !curating && <p className="text-muted-foreground max-w-prose text-sm whitespace-pre-wrap">{show.body}</p>}

      {curating ? (
        <>
          {rooms.length === 0 && <p className="text-muted-foreground text-sm">An exhibition is a set of rooms — add the first one.</p>}
          {rooms.map((r) => (
            <RoomEditor key={r.id} room={r} rooms={rooms} artworks={artworks} byId={byId} artistOf={artistOf} onOpen={setEditing} />
          ))}
          <div className="flex max-w-sm gap-2">
            <Input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="New room — “The Dutch wall”" onKeyDown={(e) => { if (e.key === "Enter" && newRoom.trim()) { void addRoom(show.id, newRoom); setNewRoom(""); } }} />
            <Button variant="outline" disabled={!newRoom.trim()} onClick={() => { void addRoom(show.id, newRoom); setNewRoom(""); }}>
              <Plus className="size-4" /> Add room
            </Button>
          </div>
        </>
      ) : rooms.length === 0 ? (
        <p className="text-muted-foreground text-sm">This show has no rooms.</p>
      ) : (
        <>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={roomIdx <= 0} onClick={() => setRoomIdx((i) => i - 1)} aria-label="Previous room">
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-center">
              <div className="text-sm font-medium">{current?.title}</div>
              <div className="text-muted-foreground text-xs">
                Room {Math.min(roomIdx + 1, rooms.length)} of {rooms.length}
              </div>
            </div>
            <Button variant="outline" size="sm" disabled={roomIdx >= rooms.length - 1} onClick={() => setRoomIdx((i) => i + 1)} aria-label="Next room">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {current && <Wall room={current} byId={byId} artistOf={artistOf} onOpen={setEditing} />}
        </>
      )}

      <ArtworkDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} artwork={editing} />
    </div>
  );
}
