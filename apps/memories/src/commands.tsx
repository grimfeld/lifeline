import { peopleNamed, type CommandDef } from "@lifeline/core";
import { Images } from "lucide-react";
import { NewMemoryDialog } from "./components/NewMemoryDialog";
import { addMemory } from "./data/repo";

/**
 * The Memories App's Commands. "memories.add" is also the agents'
 * `memories_add` (ADR 0136): its id makes the tool's name, so it keeps it.
 * Photos are chosen in the dialog only, never as an argument: an agent adds
 * a Memory without them.
 */
export const memoriesCommands: CommandDef[] = [
  {
    id: "memories.add",
    title: "New memory…",
    keywords: ["memory", "memories", "moment", "remember", "photo", "keep"],
    icon: Images,
    dialog: NewMemoryDialog,
    args: [
      { key: "title", label: "Title", kind: "text", required: true, hint: "What the moment was, in a few words (\"Dancing on the terrace\")." },
      { key: "date", label: "Date", kind: "date", hint: "Optional: the day it happened, YYYY-MM-DD; today when left out." },
      { key: "about", label: "About", kind: "links", hint: "Optional: what it remembers — Events, People, Places or any other Document — each by its name, an alias or an id." },
      { key: "body", label: "Body", kind: "longtext", hint: "Optional: the words of it, in markdown." },
    ],
    returnsDocument: true,
    agentDescription: "Keep a Memory: a moment worth remembering, with a title, its day, its words and what it is about. Photos are added by the user, never here.",
    async invoke(a) {
      const m = await addMemory({ title: String(a.title ?? ""), date: a.date as string | undefined, about: a.about as string[] | undefined, body: a.body as string | undefined });
      return { message: `Kept the memory “${m.title}”${await peopleNamed("about", m.about)}`, id: m.id };
    },
  },
];
