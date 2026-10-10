import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, CardContent, PhoneDock } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { entriesByStat, useEntries, useStats } from "../data/repo";
import { StatCard } from "../components/StatCard";
import { StatEditorDialog } from "../components/StatEditorDialog";

export function StatsScreen() {
  const stats = useStats();
  const entries = useEntries();
  const navigate = useNavigate();
  const [editorOpen, setEditorOpen] = useState(false);
  const byStat = useMemo(() => entriesByStat(entries), [entries]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <PhoneDock row className="justify-end">
          <Button onClick={() => setEditorOpen(true)}>
            <Plus /> New stat
          </Button>
        </PhoneDock>
      </div>
      {stats.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">No stats yet. Carve your first notch.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <StatCard key={s.id} stat={s} entries={byStat.get(s.id) ?? []} onOpen={() => navigate(`/app/stats/${s.id}`)} />
          ))}
        </div>
      )}
      <StatEditorDialog open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  );
}
