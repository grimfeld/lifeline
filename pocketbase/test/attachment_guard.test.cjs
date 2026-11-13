// node --test pocketbase/test/attachment_guard.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { videoRefusal } = require("../pb_hooks/attachment_guard.js");

test("an audio clip may be an audio-only WebM or MP4 container", () => {
  assert.equal(videoRefusal("audio/webm", "Clip 1.webm"), "");
  assert.equal(videoRefusal("audio/mp4", "clip.mp4"), "");
  assert.equal(videoRefusal("audio/webm;codecs=opus", "clip.webm"), "");
});

test("video is refused unless the declared mime is audio", () => {
  assert.notEqual(videoRefusal("image/png", "movie.webm"), "");
  assert.notEqual(videoRefusal("video/mp4", "movie.mp4"), "");
  assert.notEqual(videoRefusal("", "movie.MOV"), "");
});

test("images pass", () => {
  assert.equal(videoRefusal("image/png", "Pasted image.png"), "");
});
