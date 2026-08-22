import type { CardProps } from "@lifeline/core";
import { QuickAdd } from "../components/QuickAdd";
import { mediumOf } from "./shared";

/** Card: the one-line quick add for a chosen medium. */
export function QuickAddCard({ settings }: CardProps) {
  const medium = mediumOf(settings) || "movie";
  return (
    <div className="flex h-full flex-col justify-center">
      <QuickAdd compact defaultType={medium} />
    </div>
  );
}
