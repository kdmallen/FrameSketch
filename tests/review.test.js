import test from "node:test";
import assert from "node:assert/strict";
import { newProject, validateProject } from "../src/core.js";
import { defaultPose, spherePose, drawingFrame } from "../src/review-tools.js";
test("group drawing frame maps only its inclusive range", () => {
  const p = newProject("Groups");
  p.groups = [{ id: "test", start: 30, end: 32, color: "#a9baff" }];
  assert.equal(drawingFrame(p, 29), 29);
  assert.equal(drawingFrame(p, 31), 30);
  assert.equal(drawingFrame(p, 32), 30);
  assert.equal(drawingFrame(p, 33), 33);
  validateProject(p);
  p.groups.push({ id: "bad", start: 32, end: 35, color: "#ff0000" });
  assert.throws(() => validateProject(p));
});
test("sphere keys interpolate all attributes and hold before/after keys", () => {
  const a = defaultPose(),
    b = { ...a, x: 0.8, rx: 90, width: 0.5, skew: 0.4 };
  const s = { pose: a, keys: { 10: a, 20: b }, visible: true };
  const middle = spherePose(s, 15);
  assert.equal(middle.rx, 45);
  assert.equal(middle.width, 0.75);
  assert.equal(middle.skew, 0.2);
  assert.deepEqual(spherePose(s, 0), a);
  assert.deepEqual(spherePose(s, 30), b);
  s.draft = { frame: 15, pose: b };
  assert.deepEqual(spherePose(s, 15), b);
  const p = newProject("Sphere");
  p.sphere = s;
  validateProject(p);
  p.sphere.keys[20].width = Infinity;
  assert.throws(() => validateProject(p));
});
import { sourceFrame, logicalFrame, remapProject } from "../src/video-edits.js";
test("cuts remap frame annotations and retain shared drawings across removed group starts", () => {
  const p = newProject("Cuts");
  p.layers[0].frames[0] = [
    {
      id: "line",
      tool: "brush",
      size: 2,
      color: "#ffffff",
      points: [[0.5, 0.5, 0.5]],
    },
  ];
  p.groups = [{ id: "group", start: 0, end: 3, color: "#a9baff" }];
  const old = [{ id: "whole", start: 0, end: 5 }],
    next = [{ id: "keep", start: 2, end: 5 }];
  remapProject(p, old, next);
  assert.equal(sourceFrame(next, 0), 2);
  assert.equal(logicalFrame(next, 1), null);
  assert.equal(p.groups[0].start, 0);
  assert.equal(p.groups[0].end, 1);
  assert.equal(p.layers[0].frames[0][0].id, "line");
  validateProject(p);
  p.crop = { x: 0.8, y: 0, w: 0.5, h: 1 };
  assert.throws(() => validateProject(p));
});
