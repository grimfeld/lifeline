import { useState } from "react";
import { Input, toast } from "@lifeline/ui";
import { todayStr, type CardProps } from "@lifeline/core";
import { addTask } from "../data/repo";

/** Card: one input; Enter adds a one-time Task to the Unassigned pool or Today. */
export function QuickAddCard({ settings }: CardProps) {
  const toToday = settings.target === "today";
  const [value, setValue] = useState("");

  async function add() {
    const title = value.trim();
    if (!title) return;
    await addTask({ title, date: toToday ? todayStr() : null });
    setValue("");
    toast.success("Added");
  }

  return (
    <div className="flex h-full items-center">
      <Input
        className="h-8 w-full"
        aria-label="Add a task"
        placeholder="Add a task…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void add()}
      />
    </div>
  );
}
