import type { CardProps } from "@lifeline/core";
import { QuickAdd } from "../components/QuickAdd";

/** Card: the one-line add/restock, with an optional default Storage. */
export function QuickAddCard({ settings }: CardProps) {
  const storageId = typeof settings.storage === "string" ? settings.storage : "";
  return (
    <div className="flex h-full flex-col justify-center">
      <QuickAdd defaultStorageId={storageId} />
    </div>
  );
}
