import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { Languages as LanguagesIcon, Plus, Settings2 } from "lucide-react";
import { setActiveLanguage, setLanguageArchived, useActiveLanguage, useDecks, useItems, useLanguageRecalls, useLanguages } from "../data/repo";
import { LanguageDialog } from "../components/LanguageDialog";
import { LanguageSelect } from "../components/LanguageSelect";
import { PracticeTab } from "./PracticeTab";
import { WordsTab } from "./WordsTab";
import { DecksTab } from "./DecksTab";

const TABS = ["practice", "words", "decks"] as const;
type Tab = (typeof TABS)[number];

/**
 * The Languages Module (CONTEXT.md "Languages"): one active Language at a
 * time, switched in the header, its settings a dialog off the switcher — and
 * three tabs: Practice, Words, Decks.
 */
export function LanguagesScreen() {
  const languages = useLanguages();
  const active = useActiveLanguage();
  const items = useItems(active?.id);
  const recalls = useLanguageRecalls(active?.id);
  const allDecks = useDecks();
  const decks = useMemo(() => allDecks.filter((d) => d.languageId === active?.id), [allDecks, active?.id]);
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "practice";
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const archived = languages.filter((l) => l.archived);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <LanguagesIcon className="size-5" />
        <h1 className="mr-2 text-lg font-semibold">Languages</h1>
        {active && <LanguageSelect languages={languages} value={active.id} onChange={setActiveLanguage} />}
        {active && (
          <Button size="icon" variant="ghost" onClick={() => setEditOpen(true)} aria-label={`${active.name} settings`} title={`${active.name} settings`}>
            <Settings2 />
          </Button>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setNewOpen(true)} aria-label="New language">
          <Plus /> <span className="max-sm:hidden">Language</span>
        </Button>
      </div>

      {!active ? (
        <Card>
          <CardContent className="grid justify-items-center gap-3 p-8 text-center">
            <p className="text-sm">Words and sentences you meet, kept from being forgotten.</p>
            <p className="text-muted-foreground text-sm">Start with the language you are keeping.</p>
            <Button onClick={() => setNewOpen(true)}>
              <Plus /> Add a language
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams(v === "practice" ? {} : { tab: v })}>
          <TabsList>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="words">Words ({items.length})</TabsTrigger>
            <TabsTrigger value="decks">Decks ({decks.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="practice" className="pt-3">
            <PracticeTab language={active} items={items} decks={decks} recalls={recalls} />
          </TabsContent>
          <TabsContent value="words" className="pt-3">
            <WordsTab items={items} decks={decks} recalls={recalls} />
          </TabsContent>
          <TabsContent value="decks" className="pt-3">
            <DecksTab language={active} decks={decks} items={items} />
          </TabsContent>
        </Tabs>
      )}

      {archived.length > 0 && (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          Archived:
          {archived.map((l) => (
            <button key={l.id} className="hover:text-foreground underline underline-offset-2" onClick={() => void setLanguageArchived(l.id, false)} title={`Bring ${l.name} back`}>
              {l.name}
            </button>
          ))}
        </p>
      )}

      <LanguageDialog open={newOpen} onOpenChange={setNewOpen} />
      <LanguageDialog open={editOpen} onOpenChange={setEditOpen} language={active} holds={items.length + decks.length} />
    </div>
  );
}
