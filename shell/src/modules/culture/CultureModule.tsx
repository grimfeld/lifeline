import { Clapperboard, Disc3, Gamepad2, Landmark, Library, Sparkles } from "lucide-react";
import { ModuleCard } from "../ModuleCard";
import { handModule, ModuleHomeHeader } from "../handModule";

/**
 * Culture's home: what is on the go right now — the book, the series, the
 * record, the game — and today's artwork from the Museum. Each shelf's own
 * "in progress" Card; the page is the whole of the present, which no one
 * shelf could show.
 */
function CultureNow() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <ModuleHomeHeader title="Now" />
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleCard cardId="library.in-progress" title="Reading" />
        <ModuleCard cardId="cinema.in-progress" title="Watching" />
        <ModuleCard cardId="discotheque.in-progress" title="Listening" />
        <ModuleCard cardId="arcade.in-progress" title="Playing" />
        <ModuleCard cardId="museum.on-display" className="md:col-span-2" />
      </div>
    </div>
  );
}

/**
 * Culture (ADR 0057): Now first, then each shelf. Library, Cinema,
 * Discotheque, Arcade and Museum keep their screens and their ownership;
 * Culture decides the arrangement.
 */
export const cultureShell = handModule({
  id: "culture",
  title: "Culture",
  places: [
    { key: "now", title: "Now", icon: Sparkles, page: "" },
    { key: "library", title: "Library", icon: Library, screen: "library.main" },
    { key: "cinema", title: "Cinema", icon: Clapperboard, screen: "cinema.main" },
    { key: "discotheque", title: "Discotheque", icon: Disc3, screen: "discotheque.main" },
    { key: "arcade", title: "Arcade", icon: Gamepad2, screen: "arcade.main" },
    { key: "museum", title: "Museum", icon: Landmark, screen: "museum.main" },
  ],
  pages: [{ path: "", component: CultureNow }],
});
