import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingFormat, exportSegments, composeExportFrame } from '../src/video-export.js';
test('export chooses Safari MP4 or falls back to WebM and reports unsupported browsers', () => {
  assert.equal(recordingFormat({ isTypeSupported: mime => mime.startsWith('video/mp4') }).extension, 'mp4');
  assert.equal(recordingFormat({ isTypeSupported: mime => mime.startsWith('video/webm') }).extension, 'webm');
  assert.equal(recordingFormat({ isTypeSupported: () => false }), null);
});
test('export maps an A–B range across kept slices without deleted footage', () => {
  assert.deepEqual(exportSegments([{start: 10, end: 15}, {start: 30, end: 35}], 3, 8), [
    {start: 13, end: 15, logicalStart: 3}, {start: 30, end: 32, logicalStart: 6}
  ]);
});
test('hidden footage is omitted and visible sketches follow the crop', () => {
  const calls = [], ctx = { canvas: {width: 200, height: 100}, fillRect() {}, drawImage(...args) {calls.push(args);} };
  const video = {videoWidth: 800, videoHeight: 400}, sketches = {width: 800, height: 400};
  composeExportFrame(ctx, {video, sketches, hideVideo: true, crop: {x: 0.25, y: 0, w: 0.5, h: 1}});
  assert.equal(calls.length, 1); assert.equal(calls[0][0], sketches);
  assert.deepEqual(calls[0].slice(1), [200, 0, 400, 400, 0, 0, 200, 100]);
});
