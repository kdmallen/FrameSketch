export async function downloadLinkedVideo(input, { fetcher = fetch } = {}) {
  const url = new URL(input);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP or HTTPS video link.");
  const host = url.hostname.replace(/^www\./, "");
  const platform = [
    "youtube.com",
    "m.youtube.com",
    "youtu.be",
    "x.com",
    "twitter.com",
    "mobile.twitter.com",
    "instagram.com",
    "sakugabooru.com",
  ].includes(host);
  let response;
  if (platform) {
    let ready = false;
    try {
      const r = await fetcher("./api/health", {
        signal: AbortSignal.timeout(4000),
      });
      const info = await r.json();
      ready = r.ok && info.ready && info.mode === "desktop";
    } catch {}
    if (!ready)
      throw new Error(
        "Social and Sakugabooru links need the free Windows helper. Open FrameSketch using START-FRAMESKETCH.cmd, or download the video with your existing extension and upload it.",
      );
    response = await fetcher("./api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.href }),
      signal: AbortSignal.timeout(190000),
    });
  } else
    response = await fetcher(url.href, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    let error = "";
    try {
      error = (await response.json()).error;
    } catch {}
    throw new Error(
      error ||
        `Download failed (HTTP ${response.status}). Try uploading the video file.`,
    );
  }
  const type = response.headers.get("content-type") || "";
  if (
    !type.startsWith("video/") &&
    !type.startsWith("application/octet-stream")
  )
    throw new Error(
      "That URL returned a page instead of a video. Paste a direct video URL or use the Windows helper for a platform post.",
    );
  if (+(response.headers.get("content-length") || 0) > 250 * 1024 * 1024)
    throw new Error("Video exceeds the 250 MB link import limit.");
  const blob = await response.blob();
  if (blob.size > 250 * 1024 * 1024)
    throw new Error("Video exceeds the 250 MB link import limit.");
  if (!blob.size) throw new Error("The downloaded video is empty.");
  return {
    blob,
    name: "linked-video" + (type.includes("webm") ? ".webm" : ".mp4"),
    source: url.href,
  };
}
