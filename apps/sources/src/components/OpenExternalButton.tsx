import { Button, toast } from "@lifeline/ui";
import { openExternal } from "@lifeline/core";
import { ExternalLink } from "lucide-react";

export function OpenExternalButton({ url, className, iconOnly }: { url: string; className?: string; iconOnly?: boolean }) {
  const open = () => openExternal(url).catch((e: Error) => toast.error(e.message));
  return iconOnly ? (
    <Button size="icon" variant="ghost" className={className ?? "size-6"} aria-label="Open in browser" title="Open in browser" onClick={open}>
      <ExternalLink className="size-3.5" />
    </Button>
  ) : (
    <Button variant="outline" className={className ?? "h-8"} onClick={open}>
      <ExternalLink /> Open
    </Button>
  );
}
