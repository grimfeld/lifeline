import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@lifeline/ui";
import {
  allCommands,
  appById,
  db,
  registeredApps,
  useLiveQuery,
  type CommandDef,
  type UserScreen,
} from "@lifeline/core";
import { CalendarDays, Columns3, LayoutDashboard, MapPin, Terminal } from "lucide-react";

type DialogCommand = CommandDef & { appId: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogCommand | null>(null);
  const navigate = useNavigate();

  const screens = useLiveQuery(
    () => db().collection<UserScreen>("screens").where("deleted").equals(0).sortBy("sort"),
    [],
    [] as UserScreen[],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  const commands = allCommands();
  const ActiveDialogComponent = activeDialog?.dialog;

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            {screens.map((s) => (
              <CommandItem key={s.id} onSelect={() => pick(() => navigate(`/screen/${s.id}`))}>
                <LayoutDashboard /> {s.name}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => pick(() => navigate("/calendar"))}>
              <CalendarDays /> Calendar
            </CommandItem>
            <CommandItem onSelect={() => pick(() => navigate("/week"))}>
              <Columns3 /> Week
            </CommandItem>
            <CommandItem onSelect={() => pick(() => navigate("/map"))}>
              <MapPin /> Map
            </CommandItem>
            {registeredApps()
              .flatMap((a) => a.screens)
              .filter((s) => !s.hidden)
              .map((s) => {
                const Icon = s.icon ?? LayoutDashboard;
                return (
                  <CommandItem
                    key={s.id}
                    onSelect={() => pick(() => navigate(`/app/${s.path}`))}
                  >
                    <Icon /> {s.title}
                  </CommandItem>
                );
              })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Commands">
            {commands
              .filter((c) => c.dialog || c.run)
              .map((c) => {
                const Icon = c.icon ?? Terminal;
                return (
                  <CommandItem
                    key={c.id}
                    keywords={c.keywords}
                    onSelect={() =>
                      pick(() => {
                        if (c.dialog) setActiveDialog(c);
                        else void c.run?.({ navigate });
                      })
                    }
                  >
                    <Icon /> {c.title}
                    <span className="text-muted-foreground ml-auto text-xs">
                      {appById(c.appId)?.title}
                    </span>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {ActiveDialogComponent && (
        <ActiveDialogComponent
          open={activeDialog !== null}
          onOpenChange={(o) => !o && setActiveDialog(null)}
        />
      )}
    </>
  );
}
