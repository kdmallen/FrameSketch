import test from "node:test";
import assert from "node:assert/strict";
import {
  frameAt,
  timecode,
  playbackRange,
  sourceType,
  newProject,
  validateProject,
} from "../src/core.js";
test("frame boundaries and video end are clamped", () => {
  assert.equal(frameAt(30 / 24, 24, 192), 30);
  assert.equal(frameAt(8, 24, 192), 191);
  assert.equal(frameAt(-1, 24, 192), 0);
});
test("timecode includes frame position", () => {
  assert.equal(timecode(30, 24), "00:00:01:06");
  assert.equal(timecode(24 * 3661 + 3, 24), "01:01:01:03");
});
test("A–B range is inclusive and accepts reversed markers", () => {
  assert.deepEqual(playbackRange(42, 30, 100), [30, 42]);
  assert.deepEqual(playbackRange(null, 42, 100), [0, 99]);
  assert.deepEqual(playbackRange(30, 30, 100), [30, 30]);
});
test("platform URLs are distinct from direct videos", () => {
  assert.equal(sourceType("https://youtu.be/dQw4w9WgXcQ").type, "embed");
  assert.equal(
    sourceType("https://www.youtube.com/watch?v=dQw4w9WgXcQ").embed,
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(sourceType("https://instagram.com/reel/abc").type, "social");
  assert.equal(sourceType("https://example.com/file.mp4").type, "direct");
  assert.throws(() => sourceType("javascript:alert(1)"));
  assert.throws(() => sourceType("https://youtube.com/"));
});
test("backup validation rejects unsafe URLs and corrupt strokes", () => {
  const p = newProject("Test");
  assert.equal(validateProject(p), p);
  p.media = { url: "javascript:alert(1)" };
  assert.throws(() => validateProject(p));
  p.media = null;
  p.layers[0].frames[3] = [
    { tool: "brush", color: "#ffffff", size: 4, points: [[0.2, NaN, 0.5]] },
  ];
  assert.throws(() => validateProject(p));
});
