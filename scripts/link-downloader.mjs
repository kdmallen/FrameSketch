import http from "node:http";
import {
  readFile,
  writeFile,
  mkdtemp,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
export function platformURL(input) {
  const u = new URL(input);
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw new Error("Use an HTTPS post link.");
  const host = u.hostname.replace(/^www\./, "");
  let id;
  if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : u.searchParams.get("v") ||
          u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
    if (!/^[\w-]{11}$/.test(id || ""))
      throw new Error("Use a link to one YouTube video.");
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (["twitter.com", "x.com", "mobile.twitter.com"].includes(host)) {
    const m = u.pathname.match(/^\/([\w]+)\/status\/(\d+)\/?$/);
    if (m) return `https://x.com/${m[1]}/status/${m[2]}`;
  }
  if (host === "instagram.com") {
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([\w-]+)\/?$/);
    if (m) return `https://www.instagram.com/${m[1]}/${m[2]}/`;
  }
  if (host === "sakugabooru.com") {
    const m = u.pathname.match(/^\/post\/show\/(\d+)\/?$/);
    if (m) return `https://www.sakugabooru.com/post/show/${m[1]}`;
  }
  throw new Error(
    "Paste a specific YouTube, X/Twitter, Instagram or Sakugabooru video post.",
  );
}
export function sakugaFile(data, id) {
  const posts = Array.isArray(data) ? data : data.posts;
  const post = posts?.find((p) => String(p.id) === String(id));
  if (!post?.file_url)
    throw new Error("This Sakugabooru post has no downloadable video.");
  const u = new URL(post.file_url, "https://www.sakugabooru.com");
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !(
      u.hostname === "sakugabooru.com" ||
      u.hostname.endsWith(".sakugabooru.com")
    ) ||
    !/\.(mp4|webm|mov)$/i.test(u.pathname)
  )
    throw new Error("This post does not expose a supported video file.");
  return u.href;
}
const LIMIT = 250 * 1024 * 1024;
async function limitedDownload(url, file) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(120000),
    redirect: "error",
  });
  if (!res.ok) throw new Error(`Video host returned HTTP ${res.status}.`);
  if (+res.headers.get("content-length") > LIMIT)
    throw new Error("Video exceeds the 250 MB import limit.");
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > LIMIT) {
      await res.body.cancel().catch(() => {});
      throw new Error("Video exceeds the 250 MB import limit.");
    }
    chunks.push(chunk);
  }
  await writeFile(file, Buffer.concat(chunks));
}
export async function downloadPost(url, directory) {
  url = platformURL(url);
  if (url.includes("sakugabooru.com")) {
    const id = url.split("/").at(-1),
      res = await fetch(`https://www.sakugabooru.com/post.json?tags=id:${id}`, {
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    if (!res.ok) throw new Error(`Sakugabooru returned HTTP ${res.status}.`);
    const media = sakugaFile(await res.json(), id),
      file = path.join(
        directory,
        "video" + path.extname(new URL(media).pathname),
      );
    await limitedDownload(media, file);
    return file;
  }
  const python =
    process.env.FRAMESKETCH_PYTHON ||
    (process.platform === "win32" ? "python" : "python3");
  const hasFFmpeg =
    spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
  await new Promise((resolve, reject) => {
    const args = [
      "-m",
      "yt_dlp",
      "--ignore-config",
      "--no-playlist",
      "--playlist-items",
      "1",
      "--no-progress",
      "--no-warnings",
      "--socket-timeout",
      "20",
      "--retries",
      "1",
      "--max-filesize",
      "250M",
      "--js-runtimes",
      "node",
      "--format",
      hasFFmpeg ? "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" : "b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
      "--output",
      path.join(directory, "video.%(ext)s"),
      "--",
      url,
    ];
    const child = spawn(python, args, { shell: false, windowsHide: true });
    let error = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error("Download timed out. Try a shorter clip or upload a file."),
      );
    }, 180000);
    child.stderr.on("data", (b) => {
      error = (error + b.toString()).slice(-3000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Downloader could not start: ${e.message}`));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            error.replace(/https?:\/\/\S+/g, "[video host]").trim() ||
              "The site blocked this download or requires login. Use your existing downloader and upload the file.",
          ),
        );
    });
  });
  const files = (await readdir(directory)).filter((f) =>
    /^video\.(mp4|webm|mov|mkv)$/.test(f),
  );
  if (files.length !== 1)
    throw new Error("No complete playable video was downloaded.");
  const file = path.join(directory, files[0]);
  if ((await stat(file)).size > LIMIT)
    throw new Error("Video exceeds the 250 MB import limit.");
  return file;
}
export function createDownloaderServer({
  download = downloadPost,
  root = path.resolve(fileURLToPath(new URL("../dist", import.meta.url))),
  port = 4318,
} = {}) {
  let active = 0;
  const server = http.createServer(async (req, res) => {
    let directory;
    try {
      const host = `127.0.0.1:${port}`;
      if (
        req.headers.host !== host &&
        req.headers.host !== `localhost:${port}`
      ) {
        res.writeHead(403);
        res.end("Invalid host");
        return;
      }
      if (
        req.headers.origin &&
        !["http://" + host, `http://localhost:${port}`].includes(
          req.headers.origin,
        )
      ) {
        res.writeHead(403);
        res.end("Open the local FrameSketch app to import links.");
        return;
      }
      const route = new URL(req.url, "http://" + host).pathname;
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");
      if (route === "/api/health") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            ready: true,
            mode: "desktop",
            platforms: ["youtube", "x", "instagram", "sakugabooru"],
          }),
        );
        return;
      }
      if (route === "/api/import" && req.method === "POST") {
        if (active >= 2) {
          res.writeHead(429, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Two downloads are already running. Try again shortly.",
            }),
          );
          return;
        }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) throw new Error("Request too large.");
        }
        const url = platformURL(JSON.parse(body).url);
        directory = await mkdtemp(path.join(tmpdir(), "framesketch-import-"));
        active++;
        try {
          const file = await download(url, directory);
          const name = path.basename(file),
            mime = name.endsWith(".webm") ? "video/webm" : "video/mp4";
          res.writeHead(200, {
            "Content-Type": mime,
            "Content-Disposition": `attachment; filename="${name}"`,
          });
          await new Promise((resolve, reject) => {
            const stream = createReadStream(file);
            stream.on("error", reject);
            res.on("finish", resolve);
            res.on("close", resolve);
            stream.pipe(res);
          });
        } finally {
          active--;
          await rm(directory, { recursive: true, force: true });
          directory = null;
        }
        return;
      }
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end();
        return;
      }
      const relative =
          route === "/" ? "index.html" : decodeURIComponent(route).slice(1),
        file = path.resolve(root, relative);
      if (
        file !== path.resolve(root, "index.html") &&
        !file.startsWith(root + path.sep)
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      let data;
      try {
        data = await readFile(file);
      } catch {
        res.writeHead(404);
        res.end("Not found. Build the app with npm run build.");
        return;
      }
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".webmanifest": "application/manifest+json",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch (e) {
      if (directory)
        await rm(directory, { recursive: true, force: true }).catch(() => {});
      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      } else res.destroy();
    }
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = 4318;
  createDownloaderServer({ port }).listen(port, "127.0.0.1", () =>
    console.log(
      `FrameSketch desktop: http://127.0.0.1:${port}\nKeep this window open while importing videos.`,
    ),
  );
}
