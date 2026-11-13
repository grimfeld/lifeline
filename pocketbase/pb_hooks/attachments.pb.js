/// <reference path="../pb_data/types.d.ts" />

// ADR 0116: a video container is accepted by the `file` field only for an audio
// clip (attachment_guard.js). Handlers run in their own VM, hence the require.

onRecordCreateRequest((e) => {
  const file = e.record.get("file");
  const name = typeof file === "string" ? file : file && (Array.isArray(file) ? file[0] && file[0].name : file.name);
  const why = require(`${__hooks}/attachment_guard.js`).videoRefusal(e.record.getString("mime"), name || "");
  if (why) throw new BadRequestError(why);
  e.next();
}, "attachments");
