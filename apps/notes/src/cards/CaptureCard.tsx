import { useState } from "react";
import { Input, toast } from "@lifeline/ui";
import { todayStr, type CardProps } from "@lifeline/core";
import { appendToDaily, ensureDailyNote, saveBody } from "../data/repo";
import { appendBullet } from "../domain/mentions";

/** Card: one input; Enter appends a line to today's daily note (knob: prefix — timestamp or plain bullet). */
export function CaptureCard({ settings }: CardProps) {
  const bullet = settings.prefix === "bullet";
  const [value, setValue] = useState("");

  async function capture() {
    const text = value.trim();
    if (!text) return;
    if (bullet) {
      const note = await ensureDailyNote(todayStr());
      await saveBody(note, appendBullet(note.body, text));
    } else {
      await appendToDaily(text);
    }
    setValue("");
    toast.success("Captured");
  }

  return (
    <div className="flex h-full items-center">
      <Input
        className="h-8 w-full"
        aria-label={bullet ? "Jot something" : "What's happening?"}
        placeholder={bullet ? "Jot something…" : "What's happening?"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void capture()}
      />
    </div>
  );
}
