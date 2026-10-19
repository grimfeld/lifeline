import { Clapperboard, Disc3, Gamepad2, Landmark, Library, Sparkles } from "lucide-react";
import { overviewPage } from "../Overview";
import { handModule } from "../handModule";

/**
 * Culture's Overview, "Now": what is on the go right now — the book, the
 * series, the record, the game — and today's artwork from the Museum. Each
 * shelf's own "in progress" Card; the page is the whole of the present, which
 * no one shelf could show. The default; each Workspace may rearrange it
 * (ADR 0066).
 */
const CultureNow = overviewPage({
  moduleId: "culture",
  title: "Now",
  defaults: [
    { cardId: "library.in-progress", title: "Reading" },
    { cardId: "cinema.in-progress", title: "Watching" },
    { cardId: "discotheque.in-progress", title: "Listening" },
    { cardId: "arcade.in-progress", title: "Playing" },
    { cardId: "museum.on-display", wide: true },
  ],
});

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
