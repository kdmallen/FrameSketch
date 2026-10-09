import { uid } from "./core.js";
import { spherePose } from "./review-tools.js";
export const rangeCount = (ranges) =>
  ranges.reduce((n, r) => n + r.end - r.start + 1, 0);
export function sourceFrame(ranges, n) {
  if (!ranges?.length) return n;
  for (const r of ranges) {
    const size = r.end - r.start + 1;
    if (n < size) return r.start + n;
    n -= size;
  }
  return ranges.at(-1).end;
}
export function logicalFrame(ranges, n) {
  if (!ranges?.length) return n;
  let offset = 0;
  for (const r of ranges) {
    if (n >= r.start && n <= r.end) return offset + n - r.start;
    offset += r.end - r.start + 1;
  }
  return null;
}
export function remapProject(p, oldRanges, newRanges) {
  const oldLayers = structuredClone(p.layers);
  const map = (n) => logicalFrame(newRanges, sourceFrame(oldRanges, +n));
  for (const l of p.layers)
    l.frames = Object.fromEntries(
      Object.entries(l.frames)
        .map(([n, strokes]) => [map(n), strokes])
        .filter(([n]) => n !== null),
    );
  p.groups = (p.groups || []).flatMap((g) =>
    newRanges.flatMap((r) => {
      const oldStart = logicalFrame(oldRanges, r.start),
        oldEnd = logicalFrame(oldRanges, r.end);
      const a = Math.max(g.start, oldStart ?? Infinity),
        b = Math.min(g.end, oldEnd ?? -Infinity);
      if (a > b) return [];
      const start = map(a),
        end = map(b);
      p.layers.forEach((l, index) => {
        const shared = oldLayers[index].frames[g.start];
        if (shared) l.frames[start] = structuredClone(shared);
      });
      return [{ ...g, id: uid(), start, end }];
    }),
  );
  for (const s of p.spheres || []) {
    const original = structuredClone(s);
    s.keys = Object.fromEntries(
      Object.entries(s.keys)
        .map(([n, v]) => [map(n), v])
        .filter(([n]) => n !== null),
    );
    for (const r of newRanges) {
      for (const n of [r.start, r.end]) {
        const old = logicalFrame(oldRanges, n),
          next = logicalFrame(newRanges, n);
        if (old !== null) s.keys[next] = spherePose(original, old);
      }
    }
    delete s.draft;
  }
  p.highlights = (p.highlights || []).map(map).filter((n) => n !== null);
  p.frame = map(p.frame) ?? 0;
  p.a = null;
  p.b = null;
  p.clipRanges = newRanges;
  p.duration = rangeCount(newRanges) / p.fps;
}
