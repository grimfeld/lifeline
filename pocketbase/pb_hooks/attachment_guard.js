// ADR 0116: the attachments file field lets video/webm and video/mp4 through,
// because PocketBase sniffs an audio-only WebM or MP4 as its container's video
// type. That is for clips only: a record whose declared mime is not audio may not
// carry a video container. Pure, so node can test it; the hook is attachments.pb.js.

const VIDEO_EXTENSIONS = ["webm", "mp4", "m4v", "mov", "mkv", "ogv"];

/** The reason to refuse a create, or "" when it may go on. `mime` is the record's declared type, `fileName` the upload's name. */
function videoRefusal(mime, fileName) {
  const declared = String(mime || "").split(";")[0].trim().toLowerCase();
  if (declared.startsWith("audio/")) return "";
  const ext = String(fileName || "").split(".").pop().toLowerCase();
  if (declared.startsWith("video/") || VIDEO_EXTENSIONS.includes(ext)) return "Video cannot be attached; only images and audio clips";
  return "";
}

module.exports = { videoRefusal };
