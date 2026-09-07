import type { AppManifest, DocumentTypeDef } from "@lifeline/core";
import { COLOR_SLOTS } from "@lifeline/ui";
import { Mail } from "lucide-react";
import { MailScreen } from "./screens/MailScreen";
import { UnreadCard, unreadCardSettings, useUnreadCardTitle } from "./cards/UnreadCard";
import { LatestMailCard, latestMailSettings, useLatestMailTitle } from "./cards/LatestMailCard";
import { mailCommands } from "./commands";
import { APP_ID, MAIL_CACHE, MAIL_COLOR, MAILBOX, mailHref, type Mailbox } from "./domain/types";

/**
 * The `mailbox` type (ADR 0051): one connected Gmail address. The address is
 * its identity, fixed at connect (guarded); the title is the display name;
 * no credential is ever a field. Linkable, so a Note can say [[work mail]].
 */
const mailboxType: DocumentTypeDef = {
  id: MAILBOX,
  label: "Mailboxes",
  singular: "Mailbox",
  icon: Mail,
  iconName: "mail",
  titleRule: "name",
  body: "none",
  fields: [
    { key: "address", label: "Address", kind: "text", guarded: true, required: true, column: true },
    { key: "color", label: "Colour", kind: "select", options: COLOR_SLOTS.map((c) => ({ value: c, label: c })), column: true },
  ],
  linkable: { subtitle: (d) => String((d as Mailbox).address ?? "") },
  href: (d) => mailHref(d.id),
  order: 75,
  builtIn: true,
};

/**
 * The Mail App (ADR 0051): a window onto Gmail — Threads read live and
 * triaged at Google, kept only in a local cache, and handed to other Apps'
 * Intakes (ADR 0050) when worth keeping. Never sends.
 */
export const mailApp: AppManifest = {
  id: APP_ID,
  title: "Mail",
  icon: Mail,
  color: MAIL_COLOR,
  types: [mailboxType],
  // Local-only cache of Threads, Messages and Labels (never synced — leading underscore).
  localTables: [{ name: MAIL_CACHE, indexes: ["kind", "[mailboxId+kind]", "threadId", "date"] }],
  // Names no Module (ADR 0047), so the screen stays a top-level sidebar row —
  // present in every Workspace: no shelf fits, and one screen does not earn a new one.
  screens: [{ id: "mail.main", title: "Mail", path: "mail", icon: Mail, component: MailScreen }],
  cards: [
    {
      id: "mail.unread",
      title: "Unread",
      description: "How many Inbox threads are unread — one Mailbox or all",
      component: UnreadCard,
      defaultSize: { w: 2, h: 3 },
      minSize: { w: 2, h: 2 },
      settings: unreadCardSettings,
      instanceTitle: useUnreadCardTitle,
    },
    {
      id: "mail.latest",
      title: "Latest mail",
      description: "The newest Inbox threads — one Mailbox or all; a row opens it",
      component: LatestMailCard,
      defaultSize: { w: 3, h: 6 },
      minSize: { w: 2, h: 3 },
      settings: latestMailSettings,
      instanceTitle: useLatestMailTitle,
    },
  ],
  commands: mailCommands,
};

export { MAILBOX, MAIL_HREF, mailHref } from "./domain/types";
export type { Mailbox, Thread, Message, Label } from "./domain/types";
