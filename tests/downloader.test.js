import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  platformURL,
  sakugaFile,
  createDownloaderServer,
} from "../scripts/link-downloader.mjs";
import { downloadLinkedVideo } from "../src/link-import.js";
test("platform links require a single supported public post and reject unsafe URLs", () => {
  assert.equal(
    platformURL("https://youtu.be/dQw4w9WgXcQ?t=3"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(
    platformURL("https://www.sakugabooru.com/post/show/318602"),
    "https://www.sakugabooru.com/post/show/318602",
  );
  assert.throws(() => platformURL("http://127.0.0.1/"));
  assert.throws(() =>
    platformURL("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
  );
  assert.throws(() => platformURL("https://instagram.com/username/"));
  assert.throws(() => platformURL("https://user:password@x.com/a/status/123"));
});
test("Sakugabooru resolver uses matching post video URL, not thumbnails or another host", () => {
  assert.equal(
    sakugaFile(
      [{ id: 318602, file_url: "https://www.sakugabooru.com/data/test.mp4" }],
      318602,
    ),
    "https://www.sakugabooru.com/data/test.mp4",
  );
  assert.throws(() =>
    sakugaFile(
      [{ id: 1, file_url: "https://www.sakugabooru.com/data/test.jpg" }],
      1,
    ),
  );
  assert.throws(() =>
    sakugaFile([{ id: 1, file_url: "https://internal.test/movie.mp4" }], 1),
  );
});
test("desktop API downloads video bytes and blocks foreign origins", async () => {
  const port = 4399,
    server = createDownloaderServer({
      port,
      download: async (_, dir) => {
        const file = path.join(dir, "video.mp4");
        await writeFile(file, "test-video-bytes");
        return file;
      },
    });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(base + "/api/health");
    assert.equal((await health.json()).mode, "desktop");
    const media = await fetch(base + "/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        url: "https://www.sakugabooru.com/post/show/318602",
      }),
    });
    assert.equal(media.status, 200);
    assert.equal(media.headers.get("content-type"), "video/mp4");
    assert.equal(await media.text(), "test-video-bytes");
    const denied = await fetch(base + "/api/import", {
      method: "POST",
      headers: { Origin: "https://evil.test" },
    });
    assert.equal(denied.status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("website reports missing helper without pretending a social page is playable", async () => {
  await assert.rejects(
    () =>
      downloadLinkedVideo("https://x.com/a/status/123", {
        fetcher: async () => new Response("<html/>", { status: 404 }),
      }),
    /free Windows helper/,
  );
});
