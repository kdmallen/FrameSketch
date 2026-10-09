export const uid = () => crypto.randomUUID();
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function frameAt(time, fps, count) {
  return clamp(Math.floor((time + 0.00001) * fps), 0, Math.max(0, count - 1));
}
export function timecode(frame, fps) {
  const rate = Math.round(fps),
    seconds = Math.floor(frame / fps);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
    Math.floor(frame % rate),
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function playbackRange(a, b, count) {
  return a !== null && b !== null
    ? [Math.min(a, b), Math.max(a, b)]
    : [0, Math.max(0, count - 1)];
}
export function sourceType(url) {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol))
    throw new Error("Use an HTTP or HTTPS video link.");
  const host = u.hostname.replace(/^www\./, "");
  if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    const id =
      host === "youtu.be"
        ? u.pathname.split("/")[1]
        : u.searchParams.get("v") ||
          u.pathname.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id))
      throw new Error("Paste a link to a specific YouTube video.");
    return {
      type: "embed",
      embed: `https://www.youtube-nocookie.com/embed/${id}`,
      platform: "YouTube",
    };
  }
  if (
    ["x.com", "twitter.com", "mobile.twitter.com", "instagram.com"].includes(
      host,
    )
  )
    return {
      type: "social",
      platform: host.includes("instagram") ? "Instagram" : "X / Twitter",
    };
  return { type: "direct" };
}
export function newLayer(name = "Sketch 01") {
  return {
    id: uid(),
    name,
    opacity: 1,
    visible: true,
    locked: false,
    frames: {},
  };
}
export function newProject(name) {
  return {
    id: uid(),
    name,
    created: Date.now(),
    updated: Date.now(),
    fps: 24,
    layers: [newLayer()],
    a: null,
    b: null,
    loop: true,
    highlights: [],
    frame: 0,
    media: null,
  };
}
export function validateProject(p) {
  if (
    !p ||
    typeof p.name !== "string" ||
    !Array.isArray(p.layers) ||
    p.layers.length > 100 ||
    !Number.isFinite(p.fps) ||
    p.fps < 1 ||
    p.fps > 120
  )
    throw new Error("Invalid FrameSketch project.");
  if (
    typeof p.id !== "string" ||
    !/^[a-zA-Z0-9-]+$/.test(p.id) ||
    p.name.length > 100 ||
    !Number.isInteger(p.frame) ||
    p.frame < 0 ||
    typeof p.loop !== "boolean" ||
    !Array.isArray(p.highlights) ||
    p.highlights.some((n) => !Number.isInteger(n) || n < 0) ||
    [p.a, p.b].some((n) => n !== null && (!Number.isInteger(n) || n < 0))
  )
    throw new Error("Invalid project settings.");
  if (
    p.media &&
    (!["file", "direct", "embed", "social"].includes(p.media.type) ||
      !["video", "gif"].includes(p.media.kind))
  )
    throw new Error("Invalid media type.");
  if (
    p.poster &&
    !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(p.poster)
  )
    p.poster = null;
  const ids = new Set();
  p.layers.forEach((l) => {
    if (
      typeof l.id !== "string" ||
      !/^[a-zA-Z0-9-]+$/.test(l.id) ||
      ids.has(l.id) ||
      typeof l.visible !== "boolean" ||
      typeof l.locked !== "boolean"
    )
      throw new Error("Invalid layer settings.");
    ids.add(l.id);
    if (
      typeof l.name !== "string" ||
      !l.frames ||
      typeof l.frames !== "object" ||
      !Number.isFinite(l.opacity) ||
      l.opacity < 0 ||
      l.opacity > 1
    )
      throw new Error("Invalid layer data.");
    Object.entries(l.frames).forEach(([key, strokes]) => {
      if (!/^\d+$/.test(key)) throw new Error("Invalid frame data.");
      if (!Array.isArray(strokes)) throw new Error("Invalid sketch data.");
      strokes.forEach((s) => {
        if (
          !["brush", "eraser"].includes(s.tool) ||
          typeof s.color !== "string" ||
          !Number.isFinite(s.size) ||
          s.size < 1 ||
          s.size > 100 ||
          !Array.isArray(s.points) ||
          s.points.some(
            (pt) =>
              !Array.isArray(pt) ||
              pt.length < 2 ||
              pt.some((n) => !Number.isFinite(n)),
          )
        )
          throw new Error("Invalid stroke data.");
      });
    });
  });
  if (p.groups !== undefined) {
    if (!Array.isArray(p.groups) || p.groups.length > 10000)
      throw new Error("Invalid frame groups.");
    const sorted = [...p.groups].sort((a, b) => a.start - b.start);
    sorted.forEach((g, i) => {
      if (
        typeof g.id !== "string" ||
        !Number.isInteger(g.start) ||
        !Number.isInteger(g.end) ||
        g.start < 0 ||
        g.end < g.start ||
        !/^#[a-fA-F0-9]{6}$/.test(g.color) ||
        (i && g.start <= sorted[i - 1].end)
      )
        throw new Error("Invalid frame groups.");
    });
  }
  if (p.sphere) {
    const sphere = p.sphere;
    const validPose = (pose) =>
      pose &&
      ["x", "y", "width", "height", "rx", "ry", "rz", "skew"].every((k) =>
        Number.isFinite(pose[k]),
      ) &&
      pose.width >= 0.02 &&
      pose.width <= 1 &&
      pose.height >= 0.02 &&
      pose.height <= 1 &&
      pose.x >= 0 &&
      pose.x <= 1 &&
      pose.y >= 0 &&
      pose.y <= 1 &&
      Math.abs(pose.skew) <= 1 &&
      ["rx", "ry", "rz"].every((k) => Math.abs(pose[k]) <= 180);
    if (
      !validPose(sphere.pose) ||
      typeof sphere.visible !== "boolean" ||
      !sphere.keys ||
      typeof sphere.keys !== "object" ||
      Array.isArray(sphere.keys)
    )
      throw new Error("Invalid sphere.");
    if (
      Object.entries(sphere.keys).some(
        ([key, pose]) => !/^\d+$/.test(key) || !validPose(pose),
      )
    )
      throw new Error("Invalid sphere keys.");
    if (
      sphere.draft &&
      (!Number.isInteger(sphere.draft.frame) ||
        sphere.draft.frame < 0 ||
        !validPose(sphere.draft.pose))
    )
      throw new Error("Invalid sphere draft.");
  }
  if (p.media?.url) sourceType(p.media.url);
  return p;
}
