import { Settings2 } from "lucide-react";
import { Button } from "./button";

/**
 * Empty state for a Card instance whose configured target is missing
 * (deleted Stat, gone Event…) or which was never configured. The instance
 * stays on the Screen; the user retargets it.
 */
export function CardUnavailable({ message, onConfigure }: { message: string; onConfigure?: () => void }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center text-sm">
      <span>{message}</span>
      {onConfigure && (
        <Button size="sm" variant="outline" onClick={onConfigure}>
          <Settings2 /> Configure…
        </Button>
      )}
    </div>
  );
}
