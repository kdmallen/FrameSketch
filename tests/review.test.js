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
  assert.equal(middle.width, 0.37);
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
