import { useNavigate } from "react-router";
import { type CardOption, type CardProps, type CardSettings, type CardSettingsSchema } from "@lifeline/core";
import { Button, cn, colorVar } from "@lifeline/ui";
import { useListRefresh, useUnreadCount } from "../data/cache";
import { signIn, useMailboxes } from "../data/mailboxes";
import { ALL, INBOX, mailHref, type Mailbox } from "../domain/types";
import { unavailableReason, useSignedIn } from "../gmail/auth";
import { toast } from "@lifeline/ui";

export function useMailboxOptions(): CardOption[] {
  return useMailboxes().map((m) => ({ value: m.id, label: `${m.title} · ${m.address}` }));
}

export const unreadCardSettings: CardSettingsSchema = {
  mailbox: { kind: "entity", label: "Mailbox", useOptions: useMailboxOptions, anyLabel: "All Mailboxes" },
};

export function useUnreadCardTitle(settings: CardSettings): string {
  const m = useMailboxes().find((x) => x.id === settings.mailbox);
  return m ? `Unread · ${m.title}` : "Unread";
}

/** Card: the Inbox unread count of one Mailbox or all. Reads on its period while a token is valid; otherwise says so and waits for a click. */
export function UnreadCard({ settings }: CardProps) {
  const mailboxes = useMailboxes();
  const chosen = String(settings.mailbox ?? "");
  const shown = chosen ? mailboxes.filter((m) => m.id === chosen) : mailboxes;
  return <UnreadTile mailboxes={shown} target={chosen || ALL} />;
}

function UnreadTile({ mailboxes, target }: { mailboxes: Mailbox[]; target: string }) {
  const navigate = useNavigate();
  const reason = unavailableReason();
  const count = useUnreadCount(mailboxes.map((m) => m.id));
  const list = useListRefresh(mailboxes, INBOX, !reason);
  const signedOut = mailboxes.filter((m) => list.signedOut.includes(m.id));
  return (
    <div className="flex h-full flex-col">
      <button type="button" className="flex min-h-0 flex-1 flex-col items-center justify-center" onClick={() => navigate(mailHref(target))}>
        <span className={cn("text-4xl font-semibold tabular-nums", signedOut.length === mailboxes.length && mailboxes.length > 0 && "opacity-40")}>{count ?? "—"}</span>
        <span className="text-muted-foreground text-xs">unread</span>
      </button>
      {reason ? (
        <p className="text-muted-foreground line-clamp-2 text-center text-[10px]">{reason}</p>
      ) : (
        signedOut.length > 0 && (
          <div className="grid gap-0.5">
            {signedOut.map((m) => (
              <SignInLine key={m.id} mailbox={m} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function SignInLine({ mailbox }: { mailbox: Mailbox }) {
  const signedIn = useSignedIn(mailbox.address);
  if (signedIn) return null;
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <span className="size-1.5 rounded-full opacity-40" style={{ background: colorVar(mailbox.color) }} />
      <span className="text-muted-foreground truncate">{mailbox.title} signed out</span>
      <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-[11px]" onClick={() => signIn(mailbox).catch((e: Error) => toast.error(e.message))}>
        Sign in
      </Button>
    </div>
  );
}
