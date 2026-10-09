import test from 'node:test';
import assert from 'node:assert/strict';
import { onionFrames } from '../src/onion.js';
test('onion opacity fades with distance and scales with the configured opacity', () => {
  const settings = { enabled: true, previous: 3, next: 2, opacity: 0.5 };
  const frames = onionFrames(5, 10, settings);
  assert.equal(frames.find(f => f.frame === 4).opacity, 0.5);
  assert.equal(frames.find(f => f.frame === 3).opacity, 0.25);
  assert.equal(frames.find(f => f.frame === 2).opacity, 0.5 / 3);
  const higher = onionFrames(5, 10, { ...settings, opacity: 1 });
  frames.forEach(f => assert.equal(higher.find(g => g.frame === f.frame).opacity, f.opacity * 2));
});
test('onion skin clips boundaries and excludes shared current drawings and duplicate groups', () => {
  const settings = { enabled: true, previous: 4, next: 4 };
  assert.deepEqual(onionFrames(0, 2, settings).map(f => f.frame), [1]);
  const grouped = onionFrames(3, 8, settings, n => n >= 2 && n <= 4 ? 2 : n);
  assert.ok(grouped.every(f => f.frame !== 2));
  assert.equal(new Set(grouped.map(f => f.frame)).size, grouped.length);
});
