import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Card, CardContent, PhoneDock, Tabs, TabsContent, TabsList, TabsTrigger, usePhone } from "@lifeline/ui";
import { Brain, Plus, Settings2 } from "lucide-react";
import { setActiveTopic, setTopicArchived, useActiveTopic, useDecks, useItems, useMaterial, useTopicRecalls, useTopics } from "../data/repo";
import { TopicDialog } from "../components/TopicDialog";
import { TopicSelect } from "../components/TopicSelect";
import { PracticeTab } from "./PracticeTab";
import { WordsTab } from "./WordsTab";
import { DecksTab } from "./DecksTab";

const TABS = ["practice", "words", "decks"] as const;
type Tab = (typeof TABS)[number];

/**
 * The Knowledge Module (CONTEXT.md "Knowledge"): one active Topic at a
 * time, switched in the header, its settings a dialog off the switcher — and
 * three tabs: Practice, Kept, Decks.
 */
export function KnowledgeScreen() {
  const topics = useTopics();
  const active = useActiveTopic();
  const items = useItems(active?.id);
  const material = useMaterial(active?.id);
  const recalls = useTopicRecalls(active?.id);
  const allDecks = useDecks();
  const decks = useMemo(() => allDecks.filter((d) => d.languageId === active?.id), [allDecks, active?.id]);
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "practice";
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const archived = topics.filter((l) => l.archived);
  const phone = usePhone();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Brain className="size-5" />
        <h1 className="mr-2 text-lg font-semibold">Knowledge</h1>
        <PhoneDock>
          {active && <TopicSelect topics={topics} value={active.id} onChange={setActiveTopic} className="w-40 max-md:w-auto" />}
          {active && (
            <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} aria-label={`${active.name} settings`} title={`${active.name} settings`}>
              <Settings2 />
            </Button>
          )}
          <span className="flex-1 max-md:hidden" />
          <Button size={phone ? "icon" : "sm"} variant="outline" onClick={() => setNewOpen(true)} aria-label="New topic" title="New topic">
            <Plus /> {!phone && <span className="max-sm:hidden">Topic</span>}
          </Button>
        </PhoneDock>
      </div>

      {!active ? (
        <Card>
          <CardContent className="grid justify-items-center gap-3 p-8 text-center">
            <p className="text-sm">What you chose to keep, kept from being forgotten.</p>
            <p className="text-muted-foreground text-sm">Start with a topic — Spanish, History, Philosophy.</p>
            <Button onClick={() => setNewOpen(true)}>
              <Plus /> Add a topic
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams(v === "practice" ? {} : { tab: v })}>
          <PhoneDock order={1}>
            <TabsList>
              <TabsTrigger value="practice">Practice</TabsTrigger>
              <TabsTrigger value="words">Kept ({items.length})</TabsTrigger>
              <TabsTrigger value="decks">Decks ({decks.length})</TabsTrigger>
            </TabsList>
          </PhoneDock>
          <TabsContent value="practice" className="pt-3">
            <PracticeTab topic={active} items={material} decks={decks} recalls={recalls} />
          </TabsContent>
          <TabsContent value="words" className="pt-3">
            <WordsTab items={items} decks={decks} recalls={recalls} />
          </TabsContent>
          <TabsContent value="decks" className="pt-3">
            <DecksTab topic={active} decks={decks} items={items} />
          </TabsContent>
        </Tabs>
      )}

      {archived.length > 0 && (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          Archived:
          {archived.map((l) => (
            <button key={l.id} className="hover:text-foreground underline underline-offset-2" onClick={() => void setTopicArchived(l.id, false)} title={`Bring ${l.name} back`}>
              {l.name}
            </button>
          ))}
        </p>
      )}

      <TopicDialog open={newOpen} onOpenChange={setNewOpen} />
      <TopicDialog open={editOpen} onOpenChange={setEditOpen} topic={active} holds={items.length + decks.length} />
    </div>
  );
}
