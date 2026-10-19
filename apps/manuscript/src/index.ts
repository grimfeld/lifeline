import type { AppManifest, CommandDef } from "@lifeline/core";
import { BookOpenText, FileText, Scissors } from "lucide-react";
import { ShelfScreen } from "./screens/ShelfScreen";
import { ManuscriptScreen } from "./screens/ManuscriptScreen";
import { chapterType, manuscriptType, outtakeType } from "./types";
import { SHELF_HREF } from "./domain/types";
import { ChapterPeek, ManuscriptPeek } from "./components/ManuscriptPeeks";

const commands: CommandDef[] = [
  { id: "manuscript.go", title: "Go to Manuscripts", keywords: ["manuscript", "novel", "poems", "book", "chapter", "writing", "fiction"], icon: BookOpenText, run: ({ navigate }) => navigate(SHELF_HREF) },
];

/**
 * The Manuscript App (ADR 0068): creative work written without distraction —
 * Manuscripts of ordered Chapters, their Outtakes, and a shelf of works. A
 * Chapter keeps Versions through the Research App's Versions panel.
 */
export const manuscriptApp: AppManifest = {
  id: "manuscript",
  module: "manuscript",
  title: "Manuscript",
  icon: BookOpenText,
  color: "var(--chart-blue)",
  types: [
    { ...manuscriptType, icon: BookOpenText, peekEdit: ManuscriptPeek },
    { ...chapterType, icon: FileText, peekEdit: ChapterPeek },
    { ...outtakeType, icon: Scissors },
  ],
  screens: [
    { id: "manuscript.shelf", title: "Manuscripts", path: "manuscripts", icon: BookOpenText, component: ShelfScreen },
    { id: "manuscript.one", title: "Manuscript", path: "manuscripts/m/:id", component: ManuscriptScreen, hidden: true },
  ],
  cards: [],
  commands,
};

export { MANUSCRIPT, CHAPTER, OUTTAKE, manuscriptHref, type Manuscript, type Chapter, type Outtake } from "./domain/types";
