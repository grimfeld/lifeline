import { useNavigate } from "react-router";
import { Button, CardUnavailable } from "@lifeline/ui";
import { Maximize2 } from "lucide-react";
import type { CardOption, CardProps, CardSettings, CardSettingsSchema } from "@lifeline/core";
import { useEmbeds } from "../data/repo";
import { hostOf } from "../domain/url";
import { EmbedFrame } from "../components/EmbedFrame";
import { OpenExternalButton } from "../components/OpenExternalButton";
import { embedHref } from "../hrefs";

function useEmbedOptions(): CardOption[] {
  return useEmbeds()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ value: e.id, label: `${e.name} · ${hostOf(e.url)}` }));
}

const SCALES: CardOption[] = [
  { value: "1", label: "100%" },
  { value: "0.75", label: "75%" },
  { value: "0.5", label: "50%" },
];

export const embedCardSettings: CardSettingsSchema = {
  embed: { kind: "entity", label: "Embed", required: true, useOptions: useEmbedOptions },
  scale: { kind: "select", label: "Scale", default: "1", options: SCALES },
};

/** Instance title (a hook, per CardDef.instanceTitle): the chosen embed's name. */
export function useEmbedCardTitle(settings: CardSettings): string {
  return useEmbeds().find((e) => e.id === settings.embed)?.name ?? "";
}

/** Card (ADR 0016): one Embed in a frame, with "Open ↗" and a full-page view. Single-entity: not tagFilterable. */
export function EmbedCard({ settings, configure }: CardProps) {
  const navigate = useNavigate();
  const embed = useEmbeds().find((e) => e.id === settings.embed);
  const scale = Number(settings.scale) || 1;
  if (!embed) return <CardUnavailable message="That embed no longer exists." onConfigure={configure} />;
  return (
    <div className="group/embed relative h-full w-full">
      <EmbedFrame embed={embed} scale={scale} />
      <div className="card-action absolute top-1 right-1 flex items-center gap-0.5 rounded-md bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover/embed:opacity-100">
        <Button size="icon" variant="ghost" className="size-6" aria-label="Open full page" title="Open full page" onClick={() => navigate(embedHref(embed.id))}>
          <Maximize2 className="size-3.5" />
        </Button>
        <OpenExternalButton url={embed.url} iconOnly />
      </div>
    </div>
  );
}
