import { useNavigate } from "react-router";
import { appById, locatableProviders, useLocatablePins, type CardProps } from "@lifeline/core";
import { MapView } from "@lifeline/ui";

/** Options for the Map card's App filter: every App implementing Locatable. */
export function useLocatableAppOptions() {
  return locatableProviders().map((p) => ({ value: p.appId, label: appById(p.appId)?.title ?? p.appId }));
}

/** Hub card (ADR 0011): the map Surface on a Screen, optionally one App only. */
export function MapCard({ settings }: CardProps) {
  const navigate = useNavigate();
  const app = String(settings.app ?? "");
  const pins = useLocatablePins(app ? [app] : undefined);
  return <MapView pins={pins} zoomControl={false} onOpen={(p) => p.href && navigate(p.href)} />;
}
