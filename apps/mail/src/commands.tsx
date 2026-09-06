import type { CommandDef } from "@lifeline/core";
import { toast } from "@lifeline/ui";
import { Mail, MailPlus } from "lucide-react";
import { connectMailbox } from "./data/mailboxes";
import { MAIL_HREF, mailHref } from "./domain/types";
import { unavailableReason } from "./gmail/auth";

export const mailCommands: CommandDef[] = [
  { id: "mail.go", title: "Go to Mail", keywords: ["mail", "email", "gmail", "inbox"], icon: Mail, run: ({ navigate }) => navigate(MAIL_HREF) },
  {
    id: "mail.connect",
    title: "Connect a Mailbox…",
    keywords: ["mail", "gmail", "account", "sign in", "mailbox"],
    icon: MailPlus,
    run: async ({ navigate }) => {
      const reason = unavailableReason();
      if (reason) return void toast.error(reason);
      try {
        const { mailbox, created } = await connectMailbox();
        toast.success(created ? `Connected ${mailbox.address}` : `${mailbox.title} signed in`);
        navigate(mailHref(mailbox.id));
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
  },
];
