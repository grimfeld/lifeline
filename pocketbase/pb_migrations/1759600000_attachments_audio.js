/// <reference path="../pb_data/types.d.ts" />

// ADR 0116: a Knowledge clip is an Attachment too (recorded or attached audio),
// so the file field takes audio beside images. The 20 MB ceiling is unchanged.
// PocketBase checks the type it sniffs from the bytes, and an audio-only WebM or
// MP4 sniffs as the container's video type: those two are allowed as well.

const AUDIO = ["audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac", "video/webm", "video/mp4"];

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("attachments");
    const f = c.fields.getByName("file");
    f.mimeTypes = [...f.mimeTypes.filter((m) => !AUDIO.includes(m)), ...AUDIO];
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("attachments");
    const f = c.fields.getByName("file");
    f.mimeTypes = f.mimeTypes.filter((m) => !AUDIO.includes(m));
    app.save(c);
  },
);
