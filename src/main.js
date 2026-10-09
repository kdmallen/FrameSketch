import {
  sourceFrame,
  logicalFrame,
  rangeCount,
  remapProject,
} from "./video-edits.js";
import { ReviewTools, drawingFrame } from "./review-tools.js";
let reviewTools = null;
import "./style.css";
import { parseGIF, decompressFrames } from "gifuct-js";
import {
  uid,
  clamp,
  frameAt,
  timecode,
  playbackRange,
  sourceType,
  newLayer,
  newProject,
  validateProject,
} from "./core.js";
import * as storage from "./storage.js";

const icons = {
  logo: '<path d="M5 19V5h14M5 12h9M14 20l6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  prev: '<path d="M5 5v14m14-14-11 7 11 7Z"/>',
  next: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',
  brush: '<path d="m9 15 10-10 2 2-10 10M9 15c-5-1-2 5-6 5 6 2 9-1 8-4"/>',
  eraser: '<path d="m4 14 10-10 7 7-9 9H9Zm4 6h13M9 9l7 7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  hidden: '<path d="m3 3 18 18M9 5c7-2 13 7 13 7l-4 4M6 6l-4 6s6 9 14 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock:
    '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0"/>',
  loop: '<path d="m17 2 4 4-4 4M21 6H7a4 4 0 0 0-4 4m4 12-4-4 4-4M3 18h14a4 4 0 0 0 4-4"/>',
  volume:
    '<path d="M3 9h4l5-4v14l-5-4H3Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3Zm13 0 6 6m0-6-6 6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  link: '<path d="m10 14 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4m12 0 2-2a4 4 0 0 1 6 6l-4 4"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4m-4 8h4M17 8h4m-4 8h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  marker: '<path d="M6 3h12v10l-6 7-6-7Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  pencil: '<path d="m4 16 12-12 4 4L8 20H4Zm9-9 4 4"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3Z"/>',
  hand: '<path d="M6 12V7a2 2 0 0 1 4 0v5-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v7c0 5-2 6-7 6H9l-6-7a2 2 0 0 1 3-2"/>',
};
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.film}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const $ = (s, root = document) => root.querySelector(s);
const app = $("#app");
let projects = [],
  project = null,
  activeLayer = null,
  tool = "brush",
  color = "#d3fa84",
  brushSize = 5,
  fps = 24,
  frame = 0,
  frameCount = 1,
  playing = false,
  zoom = 1,
  timelineZoom = 6,
  blobURL = null,
  video = null,
  gif = null,
  gifCanvas = null,
  gifTimes = [],
  gifIndex = 0,
  duration = 0,
  undo = [],
  redo = [],
  saveTimer,
  saveQueue = Promise.resolve(),
  saveFailed = false,
  audioContext = null,
  waveform = [],
  raf = 0,
  playbackStart = 0,
  playbackTime = 0,
  currentStroke = null,
  pointerId = null,
  thumbs = [],
  mediaLoaded = false,
  routeToken = 0,
  exporting = false,
  resizeObserver = null,
  frameDecoder = null,
  frameThumbs = new Map(),
  thumbBusy = false,
  thumbTimer = null;
let filter = "all",
  sort = "recent",
  search = "";
function toast(message, bad = false) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.append(el);
  }
  el.textContent = message;
  el.className = bad ? "error" : "";
  el.classList.add("show");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove("show"), 4500);
}
function button(name, title, id, cls = "") {
  return `<button class="icon-button ${cls}" ${id ? `id="${id}"` : ""} title="${title}" aria-label="${title}">${icon(name)}</button>`;
}
function persist(immediate = false) {
  if (!project) return;
  project.frame = frame;
  project.updated = Date.now();
  project.fps = fps;
  clearTimeout(saveTimer);
  $("#save-status") && ($("#save-status").textContent = "Saving…");
  const run = () => {
    const p = structuredClone(project);
    saveQueue = saveQueue
      .then(() => storage.saveProject(p))
      .then(() => {
        saveFailed = false;
        if (project?.id === p.id && $("#save-status"))
          $("#save-status").textContent = "Saved on this device";
      })
      .catch((e) => {
        saveFailed = true;
        toast(
          "Could not save: browser storage may be full. Export a backup.",
          true,
        );
        if ($("#save-status")) $("#save-status").textContent = "Save failed";
      });
    return saveQueue;
  };
  if (immediate) return run();
  saveTimer = setTimeout(run, 350);
}
function cleanup() {
  reviewTools?.destroy();
  reviewTools = null;
  routeToken++;
  clearTimeout(thumbTimer);
  frameThumbs.clear();
  frameDecoder?.removeAttribute("src");
  frameDecoder?.load();
  frameDecoder = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  cancelAnimationFrame(raf);
  playing = false;
  video?.pause();
  video?.removeAttribute("src");
  video?.load();
  video = null;
  if (blobURL) URL.revokeObjectURL(blobURL);
  blobURL = null;
  gif = null;
  gifCanvas = null;
  thumbs = [];
  waveform = [];
  undo = [];
  redo = [];
  frameCount = 1;
  duration = 0;
  mediaLoaded = false;
  currentStroke = null;
}
async function home() {
  if (project) await persist(true);
  cleanup();
  project = null;
  document.title = "FrameSketch — Your projects";
  try {
    projects = await storage.listProjects();
  } catch (e) {
    projects = [];
    toast(
      "Browser storage is unavailable. Enable website storage to save projects.",
      true,
    );
  }
  renderHome();
}
function renderHome() {
  const list = projects
    .filter(
      (p) =>
        (filter === "all" ||
          (filter === "sketched"
            ? p.layers.some((l) => Object.keys(l.frames).length)
            : !p.layers.some((l) => Object.keys(l.frames).length))) &&
        p.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.updated - a.updated,
    );
  app.innerHTML = `<div class="home-shell"><aside class="home-sidebar"><a class="brand" href="#">${icon("logo", 31)}<span>FrameSketch<span class="brand-dot">.</span></span></a><div class="workspace-label">YOUR WORKSPACE</div><nav><button class="nav-item ${filter === "all" ? "active" : ""}" data-filter="all">${icon("grid")} All projects <span>${projects.length}</span></button><button class="nav-item ${filter === "sketched" ? "active" : ""}" data-filter="sketched">${icon("brush")} With sketches</button><button class="nav-item ${filter === "new" ? "active" : ""}" data-filter="new">${icon("film")} Unreviewed</button></nav><div class="sidebar-bottom"><div class="device-note">${icon("check", 16)} Your ideas stay with you</div><p>Projects are saved in this browser.<br>Export a backup to keep them safe.</p><button id="help" class="text-button">${icon("help", 16)} Quick guide</button><div class="profile"><div class="avatar">FS</div><div>Personal workspace<small>Local storage · No account needed</small></div></div></div></aside><main class="home-main"><header class="home-top"><span>WORKSPACE <span class="slash">/</span> Projects</span><button id="import" class="text-button">${icon("upload", 16)} Import project</button></header><section class="home-content"><div class="heading-row"><div><div class="eyebrow">A CLOSER LOOK. A CLEARER IDEA.</div><h1>Your projects<span class="brand-dot">.</span></h1><p>Slow it down. Draw it out. Make every frame count.</p></div><button class="primary" id="new-project">${icon("plus")} New project</button></div><div class="welcome-banner"><div class="banner-icon">${icon("brush", 29)}</div><div><h3>Good feedback starts with a single frame.</h3><p>Bring your footage. Add your perspective. Pick up right where you left off.</p></div><span class="banner-tag">YOUR FRAME. YOUR CANVAS.</span></div><div class="project-toolbar"><div class="project-count">${filter === "all" ? "All projects" : filter === "sketched" ? "With sketches" : "Unreviewed"} <span>${list.length}</span></div><div class="list-controls"><input type="search" id="search" placeholder="Search projects…" value="${esc(search)}" aria-label="Search projects"/><select id="sort" aria-label="Sort projects"><option value="recent" ${sort === "recent" ? "selected" : ""}>Recently edited</option><option value="name" ${sort === "name" ? "selected" : ""}>Name A–Z</option></select></div></div><div class="project-grid">${list.map((p) => card(p)).join("")}<button class="new-card" id="new-card"><span>${icon("plus", 28)}</span><strong>Create a new project</strong><small>Upload a video from your device</small></button></div>${!projects.length ? `<div class="empty-tip">${icon("film", 19)} Start with your own footage, or <button id="demo" class="inline-button">explore a sample project ${icon("arrow", 14)}</button></div>` : ""}<footer class="home-footer"><span>MADE FOR THE DETAILS.</span><span>Apple Pencil & touch ready <span class="tiny-dot"></span> Safari on iPad</span></footer></section></main></div><input hidden type="file" id="import-file" accept=".framesketch,application/json"/>`;
  $("#new-project").onclick = () => createDialog();
  $("#new-card").onclick = () => createDialog();
  $("#help").onclick = helpDialog;
  $("#demo") && ($("#demo").onclick = createDemo);
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        renderHome();
      }),
  );
  $("#search").oninput = (e) => {
    search = e.target.value;
    const pos = e.target.selectionStart;
    renderHome();
    $("#search").focus();
    $("#search").setSelectionRange(pos, pos);
  };
  $("#sort").onchange = (e) => {
    sort = e.target.value;
    renderHome();
  };
  document
    .querySelectorAll("[data-open]")
    .forEach((b) => (b.onclick = () => openProject(b.dataset.open)));
  document
    .querySelectorAll("[data-delete]")
    .forEach((b) => (b.onclick = () => deleteDialog(b.dataset.delete)));
  $("#import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = (e) => importProject(e.target.files[0]);
}
function card(p) {
  const marks = p.layers.reduce((n, l) => n + Object.keys(l.frames).length, 0);
  return `<article class="project-card"><button class="card-preview" data-open="${p.id}" aria-label="Open ${esc(p.name)}">${p.poster ? `<img src="${esc(p.poster)}" alt=""/>` : `<div class="placeholder-art">${icon("film", 42)}<div class="art-line"></div></div>`}<span class="preview-play">${icon("play", 19)}</span><span class="type-tag">${p.media?.kind === "gif" ? "GIF" : p.media?.type === "embed" ? "YOUTUBE" : p.media?.type === "social" ? "LINK" : "VIDEO"}</span>${p.duration ? `<span class="duration-tag">${Math.floor(p.duration / 60)}:${String(Math.floor(p.duration % 60)).padStart(2, "0")}</span>` : ""}</button><div class="card-info"><button class="card-title" data-open="${p.id}">${esc(p.name)}</button><button class="card-delete" data-delete="${p.id}" title="Delete project" aria-label="Delete ${esc(p.name)}">${icon("trash", 16)}</button><div class="card-meta"><span>${new Date(p.updated).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span>${marks ? `${marks} annotated frame${marks === 1 ? "" : "s"}` : "Ready for review"}</span></div></div></article>`;
}
function modal(content, wide = false) {
  $("#modal")?.remove();
  const el = document.createElement("div");
  el.id = "modal";
  el.className = "modal-backdrop";
  el.innerHTML = `<section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${button("close", "Close dialog", "modal-close")} ${content}</section>`;
  document.body.append(el);
  $("#modal-close").onclick = () => el.remove();
  el.onclick = (e) => {
    if (e.target === el) el.remove();
  };
  el.onkeydown = (e) => {
    if (e.key === "Escape") el.remove();
    if (e.key === "Tab") {
      const focusable = [
        ...el.querySelectorAll("button,input,select,a"),
      ].filter((x) => !x.disabled && x.offsetParent !== null);
      const first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  setTimeout(() => el.querySelector("input,button")?.focus(), 0);
  return el;
}
function createDialog(attach = false) {
  const el = modal(
    `<div class="eyebrow">${attach ? "REVIEW-READY FOOTAGE" : "SOMETHING WORTH A CLOSER LOOK"}</div><h2>${attach ? "Attach a video" : "New project"}<span class="brand-dot">.</span></h2><p>${attach ? "Attach the video file to enable frame controls and sketching." : "Bring in a video and make it your canvas."}</p><form id="create-form">${attach ? "" : `<label>Project name<input id="project-name" required maxlength="100" placeholder="e.g. Walk cycle study"/></label>`}<div id="upload-panel"><label class="dropzone" id="dropzone">${icon("upload", 30)}<strong id="file-label">Choose a video</strong><span>Tap to browse, or drop a file here</span><small>MP4, WebM, MOV · H.264 MP4 recommended for iPad Safari</small><input hidden type="file" id="media-file" accept="video/*,.webm,.mp4,.mov,.m4v"/></label></div><label class="source-fps-label">Source frame rate<select id="create-fps" aria-label="Project frame rate">${[12, 15, 23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((n) => `<option value="${n}" ${n === (attach ? fps : 24) ? "selected" : ""}>${n} fps</option>`).join("")}</select><small>Match your clip for accurate frame stepping.</small></label><div id="create-error" class="form-error" role="alert"></div><button class="primary full" id="create-submit" type="submit">${attach ? "Attach video" : "Create project"} ${icon("arrow", 17)}</button><p class="storage-caption">Saved on this device. Export a backup before clearing Safari data.</p></form>`,
  );
  let file = null;
  const selectFile = (f) => {
    file = f;
    $("#file-label").textContent = f?.name || "Choose a video";
  };
  $("#media-file").onchange = (e) => selectFile(e.target.files[0]);
  $("#dropzone").ondragover = (e) => {
    e.preventDefault();
  };
  $("#dropzone").ondrop = (e) => {
    e.preventDefault();
    selectFile(e.dataTransfer.files[0]);
  };
  $("#create-form").onsubmit = async (e) => {
    e.preventDefault();
    $("#create-error").textContent = "";
    const submit = $("#create-submit");
    submit.disabled = true;
    try {
      const p = attach
        ? structuredClone(project)
        : newProject($("#project-name").value.trim() || "Untitled project");
      p.fps = +$("#create-fps").value;
      if (!file) throw new Error("Choose a video first.");
      if (
        file.type === "image/gif" ||
        /\.gif$/i.test(file.name) ||
        (!file.type.startsWith("video/") &&
          !/\.(mp4|webm|mov|m4v)$/i.test(file.name))
      )
        throw new Error(
          "Choose a video file (MP4, WebM or MOV). GIFs and links are not supported for new projects.",
        );
      await storage.saveMedia(p.id, file);
      p.media = { type: "file", name: file.name, kind: "video" };
      if (attach) {
        delete p.clipRanges;
        delete p.editOriginal;
        delete p.crop;
        p.layers = project.layers;
        p.duration = null;
        p.poster = null;
        p.frame = 0;
        p.a = null;
        p.b = null;
      }
      await storage.saveProject(p);
      el.remove();
      await openProject(p.id);
    } catch (err) {
      $("#create-error") && ($("#create-error").textContent = err.message);
      submit.disabled = false;
    }
  };
}
async function createDemo() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}sample.mp4`);
    if (!r.ok) throw new Error("Sample unavailable.");
    const p = newProject("Motion study · The bouncing ball");
    p.media = { type: "file", name: "sample.mp4", kind: "video" };
    await storage.saveMedia(p.id, await r.blob());
    await storage.saveProject(p);
    await openProject(p.id);
  } catch (e) {
    toast(e.message, true);
  }
}
function helpDialog() {
  modal(
    `<div class="eyebrow">A LITTLE GUIDANCE</div><h2>Look closer. Draw freely.</h2><div class="guide"><p><b>01 · Bring your footage</b><br>Upload a video from your device. H.264 MP4 is recommended for iPad Safari.</p><p><b>02 · Find your frame</b><br>Use the arrow controls or drag the timeline. Set the source frame rate in the player. Zoom the timeline to reveal individual frames.</p><p><b>03 · Leave your mark</b><br>Use your Apple Pencil, touch, or mouse. Sketches belong to the current frame. Add, rename, hide, lock, and fade layers.</p><p><b>04 · Review a range</b><br>Go to a frame and press A. Go to another and press B. Play the range once or switch on looping. Mark important frames with the flag.</p><p><b>05 · Keep it safe</b><br>Projects autosave in this browser. Export a project backup including its media to move it between devices.</p><p class="muted">Keyboard: Space play/pause · ← / → step · A / B range · M highlight · D brush · F eraser · W/E/R/T sphere move/rotate/scale/free transform · S key · Q hide gizmo · Ctrl/⌘ Z undo</p></div>`,
    true,
  );
}
function deleteDialog(id) {
  const p = projects.find((p) => p.id === id);
  modal(
    `<h2>Delete project?</h2><p>“${esc(p.name)}” and its video will be removed from this browser. Export a backup first if you want to keep it.</p><button id="confirm-delete" class="danger full">Delete project</button>`,
  );
  $("#confirm-delete").onclick = async () => {
    await storage.deleteProject(id);
    $("#modal").remove();
    await home();
  };
}
async function openProject(id) {
  if (project) await persist(true);
  cleanup();
  const token = routeToken;
  const list = await storage.listProjects();
  if (token !== routeToken) return;
  project = list.find((p) => p.id === id);
  if (!project) return home();
  fps = project.fps;
  frame = project.frame || 0;
  activeLayer = project.layers[0]?.id;
  zoom = 1;
  gifIndex = 0;
  document.title = `${project.name} — FrameSketch`;
  renderEditor();
  try {
    let source = project.media?.url;
    if (project.media?.type === "file") {
      const blob = await storage.getMedia(id);
      if (token !== routeToken) return;
      if (!blob)
        throw new Error(
          "The media file is missing. Attach it again to continue.",
        );
      blobURL = URL.createObjectURL(blob);
      source = blobURL;
    }
    if (["embed", "social"].includes(project.media?.type)) {
      showSocial();
      return;
    }
    if (!source) throw new Error("Attach a video to start reviewing.");
    if (project.media.kind === "gif") await loadGIF(source, token);
    else await loadVideo(source, token);
  } catch (e) {
    if (token !== routeToken) return;
    showMediaError(e.message);
  }
}
function renderEditor() {
  app.innerHTML = `<div class="editor-shell"><header class="editor-header"><button id="back-home" class="brand compact" title="Back to projects">${icon("logo", 28)}</button><span class="header-divider"></span><button id="breadcrumbs" class="text-button">Projects ${icon("arrow", 13)}</button><button id="rename-project" class="project-name">${esc(project.name)} ${icon("pencil", 13)}</button><span class="save-chip">${icon("check", 13)} <span id="save-status">Saved on this device</span></span><div class="header-actions"><button id="attach" class="text-button">${icon("upload", 16)} Replace video</button><button id="export" class="secondary">${icon("download", 16)} Export project</button>${button("help", "Quick guide", "help")}</div></header><div class="editor-body"><aside class="drawing-tools"><div class="tool-group">${button("brush", "Brush (D)", "brush", "selected")}${button("eraser", "Eraser (F)", "eraser")}</div><div class="tool-divider"></div><label class="color-control" title="Brush color"><input id="color" type="color" value="${color}" aria-label="Brush color"/><span style="background:${color}"></span></label><div class="swatches">${["#d3fa84", "#ff7c78", "#a9baff", "#ffffff"].map((c) => `<button data-color="${c}" style="--swatch:${c}" title="Use ${c}" aria-label="Use ${c}"></button>`).join("")}</div><div class="tool-divider"></div><label class="size-control"><span id="size-label">${brushSize}</span><input id="brush-size" aria-label="Brush size" type="range" min="1" max="40" value="${brushSize}"/></label><span class="tool-caption">SIZE</span><div class="tool-divider"></div>${button("undo", "Undo (⌘Z)", "undo")}${button("redo", "Redo (⌘⇧Z)", "redo")}<div class="tool-spacer"></div>${button("download", "Export current frame", "export-frame")}</aside><main class="review-main"><div class="viewer-topline"><span>${icon("film", 14)} <span id="media-name">${esc(project.media?.name?.split("/").pop() || "Video")}</span></span><div><span class="live-dot"></span><span id="viewer-state">LOADING MEDIA</span></div></div><div class="viewer" id="viewer"><div class="media-stage" id="media-stage"><video id="video" playsinline preload="auto"></video><canvas id="gif-canvas" hidden></canvas><canvas id="drawing-canvas"></canvas></div><div class="viewer-loading" id="viewer-loading"><span class="spinner"></span><span>Preparing your canvas…</span></div><div class="frame-badge" id="frame-badge">FRAME <b>0000</b></div><div class="viewer-zoom"><button id="zoom-out" aria-label="Zoom viewer out">−</button><span id="zoom-label">Fit</span><button id="zoom-in" aria-label="Zoom viewer in">+</button><button id="fit" aria-label="Fit video">${icon("expand", 14)}</button></div></div><div class="transport"><div class="transport-left"><span class="timecode" id="timecode">00:00:00:00</span><span class="transport-separator"></span><label class="fps-label"><select id="fps" aria-label="Source frame rate">${[12, 15, 23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((n) => `<option value="${n}" ${fps === n ? "selected" : ""}>${n} fps</option>`).join("")}</select></label></div><div class="play-controls">${button("prev", "Previous frame (←)", "prev")}${button("play", "Play / pause (Space)", "play", "play-button")}${button("next", "Next frame (→)", "next")}</div><div class="transport-right">${button("volume", "Mute audio", "mute")}<input id="volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Audio volume"/><span id="total-frames">— frames</span></div></div><section class="timeline-section"><div class="timeline-header"><div class="timeline-title">${icon("film", 16)} Timeline <span id="timeline-duration">—</span></div><div class="timeline-actions"><button id="mark-a" class="marker-button" title="Set range start to current frame (A)">A <span id="a-label">IN</span></button><button id="mark-b" class="marker-button" title="Set range end to current frame (B)">B <span id="b-label">OUT</span></button><button id="clear-range" class="text-button small" title="Clear A–B range">Reset</button><span class="transport-separator"></span>${button("loop", "Toggle loop", "loop", project.loop ? "selected" : "")}${button("marker", "Highlight current frame (M)", "highlight")}<span class="transport-separator"></span><span class="zoom-caption">−</span><input id="timeline-zoom" type="range" min="1" max="32" value="${timelineZoom}" aria-label="Timeline zoom"/><span class="zoom-caption">+</span></div></div><div id="timeline-scroll" class="timeline-scroll"><div id="timeline-track" class="timeline-track"><div id="ruler" class="ruler"></div><div class="filmstrip" id="filmstrip"></div><canvas id="waveform" height="42"></canvas><div id="range-overlay" class="range-overlay"></div><div id="markers" class="markers"></div><div id="playhead" class="playhead"><div class="playhead-tab"></div></div></div></div><div class="timeline-footer"><span id="frame-position">Frame 0 / —</span><span id="wave-status">Preparing waveform</span><span>Drag to scrub <span class="tiny-dot"></span> Zoom for individual frames</span></div></section></main><aside class="layers-panel"><div class="layers-heading"><h3>Sketch layers</h3>${button("plus", "Add sketch layer", "add-layer")}</div><p class="layers-caption">A little clarity, frame by frame.</p><div id="layer-list" class="layer-list"></div><div class="layer-settings" id="layer-settings"></div><div class="layer-note">${icon("brush", 24)}<p>Every frame is a fresh canvas.</p><span>Sketches stay on the frame<br>where you draw them.</span></div><div class="review-summary"><span class="eyebrow">REVIEW NOTES</span><div><span id="annotated-count">0</span> annotated frames</div><button id="next-note" class="text-button">Next annotated frame ${icon("arrow", 14)}</button></div></aside></div><footer class="editor-footer"><span><span class="live-dot"></span> <span id="tool-status">Brush</span> <span class="footer-hint">· Draw with touch, Pencil or mouse</span></span><span id="selection-status">Sketch 01</span><span>FRAMESKETCH <span class="brand-dot">/</span> REVIEW STUDIO</span></footer></div>`;
  video = $("#video");
  $("#back-home").onclick = home;
  $("#breadcrumbs").onclick = home;
  $("#help").onclick = helpDialog;
  $("#attach").onclick = () => createDialog(true);
  $("#export").onclick = exportProject;
  $("#rename-project").onclick = renameProject;
  $("#brush").onclick = () => selectTool("brush");
  $("#eraser").onclick = () => selectTool("eraser");
  selectTool(tool);
  $("#color").oninput = (e) => {
    color = e.target.value;
    $(".color-control span").style.background = color;
  };
  document.querySelectorAll("[data-color]").forEach(
    (b) =>
      (b.onclick = () => {
        color = b.dataset.color;
        $("#color").value = color;
        $(".color-control span").style.background = color;
        selectTool("brush");
      }),
  );
  $("#brush-size").oninput = (e) => {
    brushSize = +e.target.value;
    $("#size-label").textContent = brushSize;
  };
  $("#undo").onclick = undoStroke;
  $("#redo").onclick = redoStroke;
  $("#export-frame").onclick = exportFrame;
  $("#play").onclick = togglePlay;
  $("#prev").onclick = () => seek(frame - 1);
  $("#next").onclick = () => seek(frame + 1);
  $("#fps").onchange = (e) => {
    pause();
    const time = frame / fps;
    fps = +e.target.value;
    frameThumbs.clear();
    frameCount = project.clipRanges
      ? rangeCount(project.clipRanges)
      : Math.max(1, Math.ceil(duration * fps));
    project.a = null;
    project.b = null;
    project.highlights = [];
    undo = [];
    redo = [];
    seek(frameAt(time, fps, frameCount));
    buildTimeline();
    persist();
    toast(
      "Frame rate changed. Existing sketches keep their frame numbers; range markers were reset.",
    );
  };
  $("#mute").onclick = () => {
    video.muted = !video.muted;
    $("#mute").innerHTML = icon(video.muted ? "muted" : "volume");
  };
  $("#volume").oninput = (e) => {
    video.volume = +e.target.value;
    video.muted = video.volume === 0;
    $("#mute").innerHTML = icon(video.muted ? "muted" : "volume");
  };
  $("#mark-a").onclick = () => {
    if (!mediaLoaded) return;
    project.a = frame;
    updateMarkers();
    persist();
  };
  $("#mark-b").onclick = () => {
    if (!mediaLoaded) return;
    project.b = frame;
    updateMarkers();
    persist();
  };
  $("#clear-range").onclick = () => {
    project.a = null;
    project.b = null;
    updateMarkers();
    persist();
  };
  $("#loop").onclick = () => {
    project.loop = !project.loop;
    $("#loop").classList.toggle("selected", project.loop);
    persist();
  };
  $("#highlight").onclick = highlight;
  $("#timeline-zoom").oninput = (e) => {
    timelineZoom = +e.target.value;
    buildTimeline();
    scrollToFrame();
  };
  $("#zoom-in").onclick = () => setZoom(Math.min(zoom + 0.25, 3));
  $("#zoom-out").onclick = () => setZoom(Math.max(zoom - 0.25, 0.5));
  $("#fit").onclick = () => setZoom(1);
  $("#add-layer").onclick = () => {
    const l = newLayer(
      `Sketch ${String(project.layers.length + 1).padStart(2, "0")}`,
    );
    project.layers.unshift(l);
    activeLayer = l.id;
    renderLayers();
    draw();
    persist();
  };
  $("#next-note").onclick = () => {
    const frames = [
      ...new Set(
        project.layers.flatMap((l) =>
          Object.keys(l.frames)
            .filter((k) => l.frames[k].length)
            .map(Number),
        ),
      ),
    ]
      .filter((n) => n < frameCount)
      .sort((a, b) => a - b);
    if (frames.length) seek(frames.find((n) => n > frame) ?? frames[0]);
    else toast("Draw on a frame to add a review note.");
  };
  reviewTools = new ReviewTools({
    project: () => project,
    frame: () => frame,
    count: () => frameCount,
    zoom: () => timelineZoom,
    ready: () => mediaLoaded,
    seek,
    pause,
    toast,
    resetHistory: () => {
      undo = [];
      redo = [];
      updateHistory();
    },
    changed: () => {
      draw();
      updateFrame();
      persist();
      renderLayers();
    },
  });
  mountVideoEdits();
  setupDrawing();
  renderLayers();
  setupTimeline();
  updateHistory();
  resizeObserver = new ResizeObserver(() => {
    if (project && $("#drawing-canvas")) {
      resizeCanvas();
      buildTimeline();
    }
  });
  resizeObserver.observe($("#viewer"));
}
function showMediaError(message) {
  mediaLoaded = false;
  $("#viewer-loading").innerHTML =
    `${icon("film", 36)}<strong>Let’s get your footage ready</strong><p>${esc(message)}</p><button id="error-attach" class="primary">${icon("upload", 18)} Attach a video</button>`;
  $("#error-attach").onclick = () => createDialog(true);
  $("#viewer-state").textContent = "MEDIA UNAVAILABLE";
  $("#wave-status").textContent = "Waveform unavailable";
  disableMediaControls();
}
function disableMediaControls() {
  [
    "play",
    "prev",
    "next",
    "fps",
    "mark-a",
    "mark-b",
    "highlight",
    "export-frame",
    "mute",
    "volume",
  ].forEach((id) => ($("#" + id).disabled = true));
}
function showSocial() {
  const p = { ...project.media, ...sourceType(project.media.url) };
  $("#viewer-loading").remove();
  $("#media-stage").style.display = "none";
  const viewer = $("#viewer");
  const el = document.createElement("div");
  el.className = "social-preview";
  el.innerHTML = `${p.type === "embed" ? `<iframe src="${esc(p.embed)}" title="YouTube video preview" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` : `<div class="social-icon">${icon("link", 40)}</div>`}<div class="social-message"><h3>${esc(p.platform)} reference</h3><p>Attach the video file to step through frames, draw, and use the review timeline.</p><div><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="secondary">Open original ${icon("arrow", 15)}</a><button class="primary" id="social-attach">${icon("upload", 16)} Attach video</button></div></div>`;
  viewer.append(el);
  $("#social-attach").onclick = () => createDialog(true);
  $("#viewer-state").textContent = "LINK REFERENCE";
  $("#frame-badge").hidden = true;
  $(".viewer-zoom").hidden = true;
  $("#wave-status").textContent = "Attach media for frame review";
  disableMediaControls();
}
async function loadVideo(source, token) {
  video.src = source;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "This link did not load. Use a direct media URL or upload the file.",
          ),
        ),
      20000,
    );
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(
        new Error(
          "Safari may not support this codec, or the URL may not be a direct video. Try an H.264 MP4 file.",
        ),
      );
    };
  });
  if (token !== routeToken) return;
  duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(
      "Live streams cannot be reviewed frame by frame. Upload a recorded clip.",
    );
  if (project.clipRanges) {
    if (
      project.clipRanges.some((r) => r.end >= Math.ceil(video.duration * fps))
    )
      throw new Error(
        "The source video does not contain the saved slice range.",
      );
    duration = rangeCount(project.clipRanges) / fps;
    $("#fps").disabled = true;
  }
  video.onseeked = () => {
    if (!playing) draw();
  };
  video.onended = () => {
    if (project.loop) {
      const [a] = playbackRange(project.a, project.b, frameCount);
      video.currentTime = sourceFrame(project.clipRanges, a) / fps;
      video.play().catch(() => pause());
    } else {
      pause();
      seek(frameCount - 1);
    }
  };
  await new Promise((resolve) => {
    if (video.readyState >= 2) resolve();
    else video.onloadeddata = resolve;
  });
  if (token !== routeToken) return;
  readyMedia();
  generateThumbnails(token);
  makeWaveform(source, token);
}
async function loadGIF(source, token) {
  const res = await fetch(source);
  if (!res.ok)
    throw new Error("Could not download GIF. Upload the file instead.");
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > 80 * 1024 * 1024)
    throw new Error(
      "This GIF is too large to decode safely. Convert it to MP4.",
    );
  const parsed = parseGIF(buffer);
  gif = decompressFrames(parsed, true);
  if (!gif.length) throw new Error("The GIF has no frames.");
  if (gif.length * parsed.lsd.width * parsed.lsd.height > 150000000)
    throw new Error(
      "This GIF is too large for frame review. Convert it to MP4.",
    );
  if (token !== routeToken) return;
  gifCanvas = $("#gif-canvas");
  gifCanvas.hidden = false;
  video.hidden = true;
  gifCanvas.width = parsed.lsd.width;
  gifCanvas.height = parsed.lsd.height;
  let t = 0;
  gifTimes = gif.map((f) => {
    const start = t;
    t += Math.max(0.02, (f.delay || 100) / 1000);
    return start;
  });
  duration = t;
  gifIndex = -1;
  gifCanvas.getContext("2d").clearRect(0, 0, gifCanvas.width, gifCanvas.height);
  renderGIF(0);
  readyMedia();
  $("#wave-status").textContent = "GIF · No audio";
  $("#mute").disabled = true;
  $("#volume").disabled = true;
  const preview = document.createElement("canvas");
  preview.width = 160;
  preview.height = 90;
  preview.getContext("2d").drawImage(gifCanvas, 0, 0, 160, 90);
  thumbs = [preview.toDataURL("image/jpeg", 0.7)];
  project.poster = thumbs[0];
  persist();
  buildTimeline();
}
let gifRestore = null;
function renderGIF(time) {
  if (!gif || !gifCanvas) return;
  let target = gifTimes.findLastIndex((t) => t <= time);
  target = Math.max(0, target);
  if (target === gifIndex) return;
  const ctx = gifCanvas.getContext("2d");
  if (target < gifIndex) {
    ctx.clearRect(0, 0, gifCanvas.width, gifCanvas.height);
    gifIndex = -1;
    gifRestore = null;
  }
  for (let i = gifIndex + 1; i <= target; i++) {
    const previous = gif[i - 1];
    if (previous?.disposalType === 2)
      ctx.clearRect(
        previous.dims.left,
        previous.dims.top,
        previous.dims.width,
        previous.dims.height,
      );
    else if (previous?.disposalType === 3 && gifRestore)
      ctx.putImageData(gifRestore, 0, 0);
    const f = gif[i];
    if (f.disposalType === 3)
      gifRestore = ctx.getImageData(0, 0, gifCanvas.width, gifCanvas.height);
    const patch = document.createElement("canvas");
    patch.width = f.dims.width;
    patch.height = f.dims.height;
    patch
      .getContext("2d")
      .putImageData(new ImageData(f.patch, f.dims.width, f.dims.height), 0, 0);
    ctx.drawImage(patch, f.dims.left, f.dims.top);
  }
  gifIndex = target;
}
function readyMedia() {
  mediaLoaded = true;
  frameCount = project.clipRanges
    ? rangeCount(project.clipRanges)
    : Math.max(1, Math.ceil(duration * fps));
  frame = clamp(frame, 0, frameCount - 1);
  project.duration = duration;
  $("#viewer-loading").remove();
  $("#viewer-state").textContent = "READY TO REVIEW";
  $("#total-frames").textContent = `${frameCount.toLocaleString()} frames`;
  $("#timeline-duration").textContent =
    `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`;
  resizeCanvas();
  buildTimeline();
  seek(frame);
  persist();
}
function mediaDimensions() {
  return gifCanvas
    ? [gifCanvas.width, gifCanvas.height]
    : [video?.videoWidth || 1920, video?.videoHeight || 1080];
}
function resizeCanvas() {
  if (!mediaLoaded) return;
  const viewer = $("#viewer"),
    stage = $("#media-stage"),
    [w, h] = mediaDimensions();
  const crop = project.crop || { x: 0, y: 0, w: 1, h: 1 };
  const width = Math.min(
      viewer.clientWidth - 56,
      ((viewer.clientHeight - 48) * w * crop.w) / (h * crop.h),
    ),
    height = (width * h * crop.h) / (w * crop.w);
  stage.style.overflow = "hidden";
  for (const el of stage.querySelectorAll("video,canvas")) {
    el.style.position = "absolute";
    el.style.width = `${100 / crop.w}%`;
    el.style.height = `${100 / crop.h}%`;
    el.style.left = `${(-100 * crop.x) / crop.w}%`;
    el.style.top = `${(-100 * crop.y) / crop.h}%`;
  }
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  const canvas = $("#drawing-canvas");
  canvas.width = Math.min(w, 2560);
  canvas.height = (canvas.width * h) / w;
  draw();
}
function setZoom(value) {
  zoom = value;
  $("#media-stage").style.transform = `scale(${zoom})`;
  $("#zoom-label").textContent =
    zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`;
}
function seek(n, stop = true) {
  if (!mediaLoaded) return;
  if (stop) pause();
  frame = clamp(Math.round(n), 0, frameCount - 1);
  if (gif) renderGIF(frame / fps);
  else
    video.currentTime = Math.min(
      sourceFrame(project.clipRanges, frame) / fps + 0.0001,
      video.duration - 0.0001,
    );
  updateFrame();
  draw();
  persist();
}
function updateFrame() {
  reviewTools?.update();
  if (!$("#timecode")) return;
  $("#timecode").textContent = timecode(frame, fps);
  $("#frame-badge").innerHTML =
    `FRAME <b>${String(frame).padStart(4, "0")}</b>`;
  $("#frame-position").textContent = `Frame ${frame} / ${frameCount - 1}`;
  $("#playhead").style.left = `${frame * timelineZoom + timelineZoom / 2}px`;
  $("#highlight").classList.toggle(
    "selected",
    project.highlights.includes(frame),
  );
  $("#annotated-count").textContent = new Set(
    project.layers.flatMap((l) =>
      Object.keys(l.frames).filter((k) => l.frames[k].length),
    ),
  ).size;
  updateLayerFrameCounts();
}
function pause() {
  playing = false;
  video?.pause();
  cancelAnimationFrame(raf);
  if ($("#play")) {
    $("#play").innerHTML = icon("play");
    $("#play").setAttribute("aria-label", "Play / pause (Space)");
  }
  if (project) persist();
}
async function togglePlay() {
  if (!mediaLoaded) return;
  if (playing) {
    pause();
    return;
  }
  const [start, end] = playbackRange(project.a, project.b, frameCount);
  if (frame < start || frame >= end) seek(start);
  playing = true;
  $("#play").innerHTML = icon("pause");
  playbackStart = performance.now();
  playbackTime = frame / fps;
  if (!gif)
    try {
      await video.play();
    } catch (e) {
      pause();
      toast(
        "Playback could not start. Tap play again or try another video.",
        true,
      );
      return;
    }
  const tick = (now) => {
    if (!playing) return;
    const time = gif
      ? playbackTime + (now - playbackStart) / 1000
      : project.clipRanges
        ? (logicalFrame(
            project.clipRanges,
            Math.floor(video.currentTime * fps),
          ) ?? frame + 1) / fps
        : video.currentTime;
    frame = frameAt(time, fps, frameCount);
    if (
      !gif &&
      project.clipRanges &&
      logicalFrame(project.clipRanges, Math.floor(video.currentTime * fps)) ===
        null &&
      time < (end + 1) / fps
    )
      video.currentTime = sourceFrame(project.clipRanges, frame) / fps;
    if (time >= (end + 1) / fps || (!gif && video.ended)) {
      if (project.loop) {
        frame = start;
        playbackStart = now;
        playbackTime = start / fps;
        if (!gif) {
          video.currentTime = sourceFrame(project.clipRanges, start) / fps;
          video.play().catch(() => pause());
        }
      } else {
        pause();
        seek(end);
        return;
      }
    }
    if (gif) renderGIF(frame / fps);
    updateFrame();
    draw();
    scrollToFrame(false);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function highlight() {
  if (!mediaLoaded) return;
  project.highlights = project.highlights.includes(frame)
    ? project.highlights.filter((n) => n !== frame)
    : [...project.highlights, frame];
  updateMarkers();
  updateFrame();
  persist();
}
function buildTimeline() {
  reviewTools?.update();
  if (!$("#timeline-track")) return;
  const width = Math.max(
    $("#timeline-scroll").clientWidth,
    frameCount * timelineZoom,
  );
  $("#timeline-track").style.width = `${width}px`;
  renderFilmstrip();
  drawWaveform(width);
  updateMarkers();
  updateFrame();
}
function renderRuler() {
  const sc = $("#timeline-scroll"),
    step =
      timelineZoom >= 16
        ? 1
        : timelineZoom >= 8
          ? 5
          : timelineZoom >= 4
            ? 12
            : Math.max(24, Math.ceil(frameCount / 50));
  const start = Math.max(
      0,
      Math.floor(sc.scrollLeft / timelineZoom / step) * step,
    ),
    end = Math.min(
      frameCount,
      Math.ceil((sc.scrollLeft + sc.clientWidth) / timelineZoom) + step,
    );
  let html = "";
  for (let i = start; i < end; i += step)
    html += `<span style="left:${i * timelineZoom}px">${timelineZoom >= 16 ? i : timecode(i, fps)}</span>`;
  $("#ruler").innerHTML = html;
}
function renderFilmstrip() {
  if (!$("#filmstrip")) return;
  renderRuler();
  const sc = $("#timeline-scroll"),
    individual = timelineZoom >= 16,
    cell = individual ? timelineZoom : 100;
  const start = Math.max(0, Math.floor(sc.scrollLeft / cell) - 1),
    end = Math.min(
      Math.ceil((frameCount * timelineZoom) / cell),
      Math.ceil((sc.scrollLeft + sc.clientWidth) / cell) + 2,
    );
  let html = "";
  for (let i = start; i < end; i++) {
    const n = individual ? i : Math.floor((i * cell) / timelineZoom);
    const img = individual
      ? frameThumbs.get(n)
      : thumbs[
          Math.min(
            thumbs.length - 1,
            Math.floor((n / frameCount) * thumbs.length),
          )
        ];
    html += `<div class="film-cell" data-thumb="${n}" style="left:${i * cell}px;width:${cell}px;${img ? `background-image:url('${img}')` : ""}">${individual ? `<span>${n}</span>` : ""}</div>`;
  }
  $("#filmstrip").innerHTML = html;
  $("#filmstrip").classList.toggle("individual-frames", individual);
  clearTimeout(thumbTimer);
  if (individual && mediaLoaded)
    thumbTimer = setTimeout(loadVisibleFrames, 100);
}
async function loadVisibleFrames() {
  if (thumbBusy || !mediaLoaded || timelineZoom < 16) return;
  thumbBusy = true;
  const token = routeToken;
  try {
    if (!gif && !frameDecoder) {
      const v = document.createElement("video");
      frameDecoder = v;
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = video.src;
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = reject;
      });
    }
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext("2d");
    const requested = [...document.querySelectorAll("[data-thumb]")].map(
      (el) => +el.dataset.thumb,
    );
    for (const n of requested) {
      if (token !== routeToken || timelineZoom < 16) break;
      if (frameThumbs.has(n)) continue;
      let source;
      if (gif) {
        source = document.createElement("canvas");
        source.width = gifCanvas.width;
        source.height = gifCanvas.height;
        const gctx = source.getContext("2d");
        let restore = null;
        const target = Math.max(
          0,
          gifTimes.findLastIndex((t) => t <= n / fps),
        );
        for (let i = 0; i <= target; i++) {
          const prev = gif[i - 1];
          if (prev?.disposalType === 2)
            gctx.clearRect(
              prev.dims.left,
              prev.dims.top,
              prev.dims.width,
              prev.dims.height,
            );
          else if (prev?.disposalType === 3 && restore)
            gctx.putImageData(restore, 0, 0);
          const f = gif[i];
          if (f.disposalType === 3)
            restore = gctx.getImageData(0, 0, source.width, source.height);
          const patch = document.createElement("canvas");
          patch.width = f.dims.width;
          patch.height = f.dims.height;
          patch
            .getContext("2d")
            .putImageData(
              new ImageData(f.patch, f.dims.width, f.dims.height),
              0,
              0,
            );
          gctx.drawImage(patch, f.dims.left, f.dims.top);
        }
      } else {
        const v = frameDecoder;
        if (!v) break;
        v.currentTime = Math.min(
          v.duration - 0.001,
          sourceFrame(project.clipRanges, n) / fps + 0.0001,
        );
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("seek")), 3000);
          v.onseeked = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        source = v;
      }
      if (token !== routeToken) break;
      ctx.drawImage(source, 0, 0, 160, 90);
      const img = c.toDataURL("image/jpeg", 0.55);
      if (frameThumbs.size > 350)
        frameThumbs.delete(frameThumbs.keys().next().value);
      frameThumbs.set(n, img);
      const el = document.querySelector(`[data-thumb="${n}"]`);
      if (el) el.style.backgroundImage = `url('${img}')`;
    }
  } catch (e) {
    /* Remote videos without CORS permission cannot expose frame pixels. */
  } finally {
    thumbBusy = false;
    if (
      token === routeToken &&
      timelineZoom >= 16 &&
      [...document.querySelectorAll("[data-thumb]")].some(
        (el) => !frameThumbs.has(+el.dataset.thumb),
      )
    ) {
      /* Retry only after scrolling or changing zoom. */
    }
  }
}
function drawWaveform(width) {
  const c = $("#waveform");
  c.width = Math.min(16000, Math.ceil(width));
  c.style.width = `${width}px`;
  const ctx = c.getContext("2d");
  ctx.strokeStyle = "#53654c";
  ctx.beginPath();
  ctx.moveTo(0, 21);
  ctx.lineTo(c.width, 21);
  ctx.stroke();
  if (!waveform.length) return;
  ctx.fillStyle = "#91aa78";
  for (let x = 0; x < c.width; x += 3) {
    const n = Math.floor((x / c.width) * waveform.length);
    const a = waveform[n] * 18;
    ctx.fillRect(x, 21 - a, 1, Math.max(1, a * 2));
  }
}
function updateMarkers() {
  if (!$("#markers")) return;
  $("#a-label").textContent = project.a === null ? "IN" : project.a;
  $("#b-label").textContent = project.b === null ? "OUT" : project.b;
  $("#mark-a").classList.toggle("selected", project.a !== null);
  $("#mark-b").classList.toggle("selected", project.b !== null);
  const [start, end] = playbackRange(project.a, project.b, frameCount);
  const overlay = $("#range-overlay");
  overlay.style.left = `${start * timelineZoom}px`;
  overlay.style.width = `${(end - start + 1) * timelineZoom}px`;
  overlay.hidden = project.a === null || project.b === null;
  $("#markers").innerHTML =
    project.highlights
      .map(
        (n) =>
          `<button class="highlight-pin" data-frame="${n}" style="left:${n * timelineZoom}px" title="Highlighted frame ${n}" aria-label="Go to highlighted frame ${n}"></button>`,
      )
      .join("") +
    [
      project.a !== null
        ? `<span class="range-pin" style="left:${project.a * timelineZoom}px">A</span>`
        : "",
      project.b !== null
        ? `<span class="range-pin" style="left:${project.b * timelineZoom}px">B</span>`
        : "",
    ].join("");
  document.querySelectorAll("[data-frame]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        seek(+b.dataset.frame);
      }),
  );
}
function setupTimeline() {
  let gesture = null;
  $("#timeline-scroll").onscroll = () => renderFilmstrip();
  const track = $("#timeline-track");
  const frameFrom = (e) =>
    clamp(
      Math.floor(
        (e.clientX - track.getBoundingClientRect().left) / timelineZoom,
      ),
      0,
      frameCount - 1,
    );
  track.onpointerdown = (e) => {
    if (!mediaLoaded || e.button !== 0 || e.target.closest("button")) return;
    if (e.pointerType !== "touch") e.preventDefault();
    window.getSelection()?.removeAllRanges();
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    if (e.pointerType !== "touch" || e.target.closest(".ruler"))
      track.setPointerCapture(e.pointerId);
    seek(frameFrom(e));
  };
  track.onpointermove = (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 4)
      gesture.moved = true;
    if (gesture.moved) seek(frameFrom(e));
  };
  track.onpointerup = (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const moved = gesture.moved;
    gesture = null;
    if (!moved)
      reviewTools ? reviewTools.timeline(frameFrom(e)) : seek(frameFrom(e));
  };
  track.onpointercancel = () => {
    gesture = null;
  };
}
function scrollToFrame(center = true) {
  const sc = $("#timeline-scroll");
  if (!sc) return;
  const x = frame * timelineZoom;
  if (center) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
  else if (x > sc.scrollLeft + sc.clientWidth - 20 || x < sc.scrollLeft)
    sc.scrollLeft = Math.max(0, x - 40);
}
async function generateThumbnails(token) {
  const source = video.src;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.src = source;
  v.preload = "auto";
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 135;
  const ctx = canvas.getContext("2d");
  try {
    await new Promise((resolve, reject) => {
      v.onloadedmetadata = resolve;
      v.onerror = reject;
    });
    const count = Math.min(12, Math.max(1, Math.ceil(duration / 3)));
    for (let i = 0; i < count; i++) {
      if (token !== routeToken) break;
      v.currentTime = Math.min(
        v.duration - 0.01,
        sourceFrame(
          project.clipRanges,
          Math.floor(((i + 0.05) / count) * frameCount),
        ) / fps,
      );
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Thumbnail seek timeout")),
          5000,
        );
        v.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      ctx.fillStyle = "#171a20";
      ctx.fillRect(0, 0, 240, 135);
      const ratio = Math.min(240 / v.videoWidth, 135 / v.videoHeight);
      ctx.drawImage(
        v,
        (240 - v.videoWidth * ratio) / 2,
        (135 - v.videoHeight * ratio) / 2,
        v.videoWidth * ratio,
        v.videoHeight * ratio,
      );
      const img = canvas.toDataURL("image/jpeg", 0.65);
      thumbs.push(img);
      if (i === 0) {
        project.poster = img;
        persist();
      }
      buildTimeline();
    }
  } catch (e) {
    /* Cross-origin media can play without permitting pixel extraction. */
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}
async function makeWaveform(source, token) {
  try {
    const r = await fetch(source);
    if (!r.ok) throw new Error("fetch");
    const size = +r.headers.get("content-length");
    if (size > 120 * 1024 * 1024) throw new Error("large");
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength > 120 * 1024 * 1024) throw new Error("large");
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error("unsupported");
    audioContext ||= new AudioCtx();
    const audio = await audioContext.decodeAudioData(bytes);
    if (token !== routeToken) return;
    const samples = audio.getChannelData(0),
      count = 1600,
      step = Math.max(
        1,
        Math.floor(
          (project.clipRanges ? duration * audio.sampleRate : samples.length) /
            count,
        ),
      );
    waveform = Array.from({ length: count }, (_, i) => {
      let peak = 0;
      const start = project.clipRanges
        ? Math.floor(
            (sourceFrame(
              project.clipRanges,
              Math.floor((i / count) * frameCount),
            ) /
              fps) *
              audio.sampleRate,
          )
        : i * step;
      for (
        let j = start;
        j < Math.min(start + step, samples.length);
        j += Math.max(1, Math.floor(step / 100))
      )
        peak = Math.max(peak, Math.abs(samples[j]));
      return peak;
    });
    $("#wave-status").textContent = "Audio waveform";
    buildTimeline();
  } catch (e) {
    if (token === routeToken && $("#wave-status"))
      $("#wave-status").textContent =
        "No decodable audio · Waveform unavailable";
  }
}
function selectTool(t) {
  if (reviewTools) {
    reviewTools.sphereMode = false;
    reviewTools.update();
    draw();
  }
  tool = t;
  $("#brush")?.classList.toggle("selected", t === "brush");
  $("#eraser")?.classList.toggle("selected", t === "eraser");
  if ($("#tool-status"))
    $("#tool-status").textContent = t === "brush" ? "Brush" : "Eraser";
}
function layer() {
  return project?.layers.find((l) => l.id === activeLayer);
}
function renderLayers() {
  const l = layer();
  $("#layer-list").innerHTML = project.layers
    .map(
      (l, i) =>
        `<div class="layer-row ${l.id === activeLayer ? "active" : ""}" data-layer="${l.id}" tabindex="0" role="button" aria-label="Select ${esc(l.name)}"><div class="layer-thumbnail">${icon("brush", 18)}</div><div class="layer-label"><button data-rename="${l.id}" title="Rename layer">${esc(l.name)}</button><small data-count="${l.id}">${Object.keys(l.frames).length} frames</small></div><button class="mini-button" data-visible="${l.id}" title="${l.visible ? "Hide" : "Show"} layer" aria-label="${l.visible ? "Hide" : "Show"} ${esc(l.name)}">${icon(l.visible ? "eye" : "hidden", 17)}</button><button class="mini-button ${l.locked ? "locked" : ""}" data-lock="${l.id}" title="${l.locked ? "Unlock" : "Lock"} layer" aria-label="${l.locked ? "Unlock" : "Lock"} ${esc(l.name)}">${icon(l.locked ? "lock" : "unlock", 16)}</button></div>`,
    )
    .join("");
  $("#layer-settings").innerHTML = l
    ? `<div class="opacity-heading"><span>Opacity</span><span id="opacity-value">${Math.round(l.opacity * 100)}%</span></div><input id="opacity" type="range" min="0" max="1" step=".01" value="${l.opacity}" aria-label="Layer opacity"/><div class="layer-options"><button id="rename-layer" class="text-button small">${icon("pencil", 14)} Rename</button><button id="delete-layer" class="text-button small" ${project.layers.length <= 1 ? "disabled" : ""}>${icon("trash", 14)} Delete</button></div>`
    : "";
  document.querySelectorAll("[data-layer]").forEach((row) => {
    const choose = () => {
      activeLayer = row.dataset.layer;
      renderLayers();
    };
    row.onclick = (e) => {
      if (!e.target.closest("button")) choose();
    };
    row.onkeydown = (e) => {
      if (e.key === "Enter") choose();
    };
  });
  document
    .querySelectorAll("[data-rename]")
    .forEach((b) => (b.onclick = () => renameLayer(b.dataset.rename)));
  document.querySelectorAll("[data-visible]").forEach(
    (b) =>
      (b.onclick = () => {
        const l = project.layers.find((l) => l.id === b.dataset.visible);
        l.visible = !l.visible;
        renderLayers();
        draw();
        persist();
      }),
  );
  document.querySelectorAll("[data-lock]").forEach(
    (b) =>
      (b.onclick = () => {
        const l = project.layers.find((l) => l.id === b.dataset.lock);
        l.locked = !l.locked;
        renderLayers();
        persist();
      }),
  );
  if (l) {
    $("#opacity").oninput = (e) => {
      l.opacity = +e.target.value;
      $("#opacity-value").textContent = `${Math.round(l.opacity * 100)}%`;
      draw();
      persist();
    };
    $("#rename-layer").onclick = () => renameLayer(activeLayer);
    $("#delete-layer").onclick = () => {
      modal(
        `<h2>Delete this layer?</h2><p>All sketches on “${esc(l.name)}” will be removed.</p><button id="confirm-layer-delete" class="danger full">Delete layer</button>`,
      );
      $("#confirm-layer-delete").onclick = () => {
        project.layers = project.layers.filter((item) => item.id !== l.id);
        activeLayer = project.layers[0].id;
        undo = [];
        redo = [];
        $("#modal").remove();
        renderLayers();
        draw();
        persist();
        updateHistory();
      };
    };
    $("#selection-status").textContent =
      `${l.name}${l.locked ? " · Locked" : ""}${!l.visible ? " · Hidden" : ""}`;
  }
  updateLayerFrameCounts();
}
function updateLayerFrameCounts() {
  project?.layers.forEach((l) => {
    const el = document.querySelector(`[data-count="${l.id}"]`);
    if (el)
      el.textContent = `${Object.keys(l.frames).filter((k) => l.frames[k].length).length} frames`;
  });
}
function renameLayer(id) {
  const l = project.layers.find((l) => l.id === id);
  modal(
    `<h2>Rename layer</h2><form id="rename-form"><label>Layer name<input id="rename-input" required maxlength="60" value="${esc(l.name)}"/></label><button class="primary full">Save name</button></form>`,
  );
  $("#rename-form").onsubmit = (e) => {
    e.preventDefault();
    l.name = $("#rename-input").value.trim() || l.name;
    $("#modal").remove();
    renderLayers();
    persist();
  };
}
function renameProject() {
  modal(
    `<h2>Rename project</h2><form id="rename-form"><label>Project name<input id="rename-input" required maxlength="100" value="${esc(project.name)}"/></label><button class="primary full">Save name</button></form>`,
  );
  $("#rename-form").onsubmit = (e) => {
    e.preventDefault();
    project.name = $("#rename-input").value.trim() || project.name;
    $("#modal").remove();
    $("#rename-project").innerHTML =
      `${esc(project.name)} ${icon("pencil", 13)}`;
    document.title = `${project.name} — FrameSketch`;
    persist();
  };
}
function setupDrawing() {
  const canvas = $("#drawing-canvas");
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      clamp((e.clientX - r.left) / r.width, 0, 1),
      clamp((e.clientY - r.top) / r.height, 0, 1),
      e.pointerType === "pen" ? Math.max(0.15, e.pressure) : 0.5,
    ];
  };
  canvas.onpointerdown = (e) => {
    if (!mediaLoaded || e.button > 0 || currentStroke) return;
    if (reviewTools?.pointerDown(e, canvas)) return;
    const l = layer();
    if (l.locked || !l.visible) {
      toast(
        l.locked
          ? "Unlock this layer before drawing."
          : "Show this layer before drawing.",
      );
      return;
    }
    pause();
    pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId);
    currentStroke = {
      tool,
      color,
      size: brushSize,
      points: [point(e)],
      id: uid(),
    };
    draw();
  };
  canvas.onpointermove = (e) => {
    if (reviewTools?.pointerMove(e, canvas)) return;
    if (!currentStroke || pointerId !== e.pointerId) return;
    const events = e.getCoalescedEvents?.() || [e];
    events.forEach((event) => currentStroke.points.push(point(event)));
    draw();
  };
  const finish = (e) => {
    if (reviewTools?.pointerUp(e)) return;
    if (!currentStroke || pointerId !== e.pointerId) return;
    const l = layer();
    const stroke = currentStroke;
    (l.frames[drawingFrame(project, frame)] ||= []).push(stroke);
    undo.push({ layer: l.id, frame: drawingFrame(project, frame), stroke });
    redo = [];
    currentStroke = null;
    pointerId = null;
    updateHistory();
    draw();
    updateFrame();
    persist();
  };
  canvas.onpointerup = finish;
  canvas.onpointercancel = finish;
}
function paintStroke(ctx, s, w, h) {
  ctx.globalCompositeOperation =
    s.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const base = (s.size * w) / 1280;
  const points = s.points;
  if (!points.length) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(
      points[0][0] * w,
      points[0][1] * h,
      base * (points[0][2] || 0.5),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    return;
  }
  for (let i = 1; i < points.length; i++) {
    ctx.lineWidth = base * Math.max(0.3, (points[i][2] || 0.5) * 2);
    ctx.beginPath();
    ctx.moveTo(points[i - 1][0] * w, points[i - 1][1] * h);
    ctx.lineTo(points[i][0] * w, points[i][1] * h);
    ctx.stroke();
  }
}
const layerCanvas = document.createElement("canvas");
function draw() {
  const c = $("#drawing-canvas");
  if (!c || !project) return;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  layerCanvas.width = c.width;
  layerCanvas.height = c.height;
  const lctx = layerCanvas.getContext("2d");
  [...project.layers].reverse().forEach((l) => {
    if (!l.visible) return;
    lctx.clearRect(0, 0, c.width, c.height);
    (l.frames[drawingFrame(project, frame)] || []).forEach((s) =>
      paintStroke(lctx, s, c.width, c.height),
    );
    if (l.id === activeLayer && currentStroke)
      paintStroke(lctx, currentStroke, c.width, c.height);
    ctx.globalAlpha = l.opacity;
    ctx.drawImage(layerCanvas, 0, 0);
  });
  ctx.globalAlpha = 1;
  reviewTools?.draw(ctx, c.width, c.height);
}
function undoStroke() {
  const action = undo.pop();
  if (!action) return;
  const l = project.layers.find((l) => l.id === action.layer);
  if (!l) return;
  if (l.locked) {
    undo.push(action);
    toast("Unlock the layer to undo.");
    return;
  }
  l.frames[action.frame] = l.frames[action.frame].filter(
    (s) => s.id !== action.stroke.id,
  );
  if (!l.frames[action.frame].length) delete l.frames[action.frame];
  redo.push(action);
  seek(action.frame);
  draw();
  updateHistory();
  persist();
}
function redoStroke() {
  const action = redo.pop();
  if (!action) return;
  const l = project.layers.find((l) => l.id === action.layer);
  if (!l) return;
  if (l.locked) {
    redo.push(action);
    toast("Unlock the layer to redo.");
    return;
  }
  (l.frames[action.frame] ||= []).push(action.stroke);
  undo.push(action);
  seek(action.frame);
  draw();
  updateHistory();
  persist();
}
function updateHistory() {
  if ($("#undo")) $("#undo").disabled = !undo.length;
  if ($("#redo")) $("#redo").disabled = !redo.length;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function blobBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function exportProject() {
  if (exporting) return;
  exporting = true;
  const button = $("#export");
  button.disabled = true;
  try {
    await persist(true);
    const data = {
      format: "framesketch",
      version: 1,
      project: structuredClone(project),
    };
    if (project.media?.type === "file") {
      const blob = await storage.getMedia(project.id);
      if (blob) data.media = await blobBase64(blob);
    }
    download(
      new Blob([JSON.stringify(data)], { type: "application/json" }),
      `${project.name.replace(/[^\w -]/g, "") || "project"}.framesketch`,
    );
    toast("Project backup exported. Keep it somewhere safe.");
  } catch (e) {
    toast("Export failed: " + e.message, true);
  } finally {
    exporting = false;
    button.disabled = false;
  }
}
async function importProject(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== "framesketch" || data.version !== 1)
      throw new Error("Choose a FrameSketch project backup.");
    const p = validateProject(data.project);
    p.id = uid();
    p.updated = Date.now();
    if (data.media) {
      if (
        typeof data.media !== "string" ||
        !/^data:(video\/[\w.+-]+|image\/gif|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/.test(
          data.media,
        )
      )
        throw new Error("Invalid media backup.");
      const r = await fetch(data.media);
      await storage.saveMedia(p.id, await r.blob());
    }
    await storage.saveProject(p);
    await openProject(p.id);
    toast("Project imported.");
  } catch (e) {
    toast(e.message, true);
  }
}
function mountVideoEdits() {
  const actions = $(".header-actions");
  const b = document.createElement("button");
  b.id = "video-edits";
  b.className = "secondary";
  b.textContent = "Crop / Slice";
  actions.prepend(b);
  b.onclick = videoEditDialog;
}
function videoEditDialog() {
  if (!mediaLoaded || gif) {
    toast("Upload a video to crop or slice.");
    return;
  }
  pause();
  const original = project.clipRanges || [
      { id: uid(), start: 0, end: frameCount - 1 },
    ],
    crop = project.crop || { x: 0, y: 0, w: 1, h: 1 };
  const el = modal(
    `<h2>Crop & slices</h2><p>Edits preserve your original upload. Slice at the current frame, then keep, delete, or send a piece to a new project.</p><h3 class="edit-heading">Crop review area</h3><div class="crop-fields">${[
      ["x", "Left"],
      ["y", "Top"],
      ["w", "Width"],
      ["h", "Height"],
    ]
      .map(
        ([k, label]) =>
          `<label>${label} %<input id="crop-${k}" type="number" min="${k === "w" || k === "h" ? 1 : 0}" max="100" value="${Math.round(crop[k] * 100)}"/></label>`,
      )
      .join(
        "",
      )}</div><div class="sphere-buttons"><button id="apply-crop" class="primary">Apply crop</button><button id="reset-crop" class="secondary">Reset crop</button></div><div id="edit-error" class="form-error"></div><h3 class="edit-heading">Video slices · current frame ${frame}</h3><button id="split-video" class="secondary">Slice at current frame</button><button id="restore-video" class="text-button" ${project.editOriginal ? "" : "disabled"}>Restore before slicing</button><div class="slice-list">${original.map((r, i) => `<div class="slice-row"><span>Slice ${i + 1} · ${r.end - r.start + 1} frames</span><button class="secondary" data-new-slice="${i}">New project</button><button class="text-button" data-delete-slice="${i}" ${original.length === 1 ? "disabled" : ""}>Delete</button></div>`).join("")}</div><p>Deleting a slice removes it from this project’s playback. A new slice project keeps the uploaded media, crop, sketches and sphere keys. Export projects as backups.</p>`,
    true,
  );
  $("#apply-crop").onclick = () => {
    const c = Object.fromEntries(
      ["x", "y", "w", "h"].map((k) => [k, +$("#crop-" + k).value / 100]),
    );
    if (
      Object.values(c).some((v) => !Number.isFinite(v)) ||
      c.x < 0 ||
      c.y < 0 ||
      c.w <= 0 ||
      c.h <= 0 ||
      c.x + c.w > 1.00001 ||
      c.y + c.h > 1.00001
    ) {
      $("#edit-error").textContent =
        "Keep the crop rectangle inside the video.";
      return;
    }
    project.crop = c;
    resizeCanvas();
    persist();
    el.remove();
  };
  $("#reset-crop").onclick = () => {
    delete project.crop;
    resizeCanvas();
    persist();
    el.remove();
  };
  const apply = async (ranges) => {
    if (!project.editOriginal)
      project.editOriginal = structuredClone({
        layers: project.layers,
        groups: project.groups,
        spheres: project.spheres,
        highlights: project.highlights,
        frame: project.frame,
        clipRanges: project.clipRanges || null,
      });
    remapProject(project, original, ranges);
    frameCount = rangeCount(ranges);
    duration = frameCount / fps;
    $("#fps").disabled = true;
    frameThumbs.clear();
    thumbs = [];
    waveform = [];
    makeWaveform(video.src, routeToken);
    undo = [];
    redo = [];
    updateHistory();
    $("#total-frames").textContent = `${frameCount} frames`;
    $("#timeline-duration").textContent = `${duration.toFixed(2)}s`;
    resizeCanvas();
    buildTimeline();
    seek(project.frame);
    await persist(true);
  };
  $("#restore-video").onclick = async () => {
    if (
      !confirm(
        "Restore the timeline and annotations saved before slicing? Edits made after slicing will be replaced.",
      )
    )
      return;
    const backup = project.editOriginal;
    Object.assign(
      project,
      structuredClone(
        Object.fromEntries(
          [
            "layers",
            "groups",
            "spheres",
            "highlights",
            "frame",
            "clipRanges",
          ].map((k) => [k, backup[k]]),
        ),
      ),
    );
    delete project.editOriginal;
    if (!project.clipRanges) delete project.clipRanges;
    duration = project.clipRanges
      ? rangeCount(project.clipRanges) / fps
      : video.duration;
    frameCount = project.clipRanges
      ? rangeCount(project.clipRanges)
      : Math.ceil(duration * fps);
    $("#fps").disabled = !!project.clipRanges;
    project.a = project.b = null;
    activeLayer = project.layers[0].id;
    reviewTools.active = project.spheres?.[0]?.id;
    reviewTools.sphereMode = false;
    undo = [];
    redo = [];
    frameThumbs.clear();
    thumbs = [];
    waveform = [];
    makeWaveform(video.src, routeToken);
    renderLayers();
    resizeCanvas();
    buildTimeline();
    seek(project.frame);
    $("#total-frames").textContent = `${frameCount} frames`;
    $("#timeline-duration").textContent = `${duration.toFixed(2)}s`;
    await persist(true);
    el.remove();
  };
  $("#split-video").onclick = async () => {
    const source = sourceFrame(original, frame),
      index = original.findIndex((r) => source >= r.start && source <= r.end),
      r = original[index];
    if (source === r.start) {
      $("#edit-error").textContent = "Step inside the slice before cutting.";
      return;
    }
    const ranges = structuredClone(original);
    ranges.splice(
      index,
      1,
      { id: uid(), start: r.start, end: source - 1 },
      { id: uid(), start: source, end: r.end },
    );
    await apply(ranges);
    el.remove();
    videoEditDialog();
  };
  el.querySelectorAll("[data-delete-slice]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          !confirm(
            "Delete this slice from project playback? The original upload is kept.",
          )
        )
          return;
        await apply(original.filter((_, i) => i !== +b.dataset.deleteSlice));
        el.remove();
        videoEditDialog();
      }),
  );
  el.querySelectorAll("[data-new-slice]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const p = structuredClone(project),
            r = original[+b.dataset.newSlice];
          p.id = uid();
          p.name = `${project.name} · Slice ${+b.dataset.newSlice + 1}`.slice(
            0,
            100,
          );
          p.created = p.updated = Date.now();
          remapProject(p, original, [{ ...r, id: uid() }]);
          p.frame = 0;
          const blob = await storage.getMedia(project.id);
          if (!blob) throw new Error("Source upload is missing.");
          await storage.saveMedia(p.id, blob);
          await storage.saveProject(p);
          toast("Slice saved as a new project. Find it in Projects.");
        } catch (error) {
          $("#edit-error").textContent = error.message;
        }
      }),
  );
}
async function exportFrame() {
  if (!mediaLoaded) return;
  pause();
  if (!gif && video.seeking)
    await new Promise((resolve) =>
      video.addEventListener("seeked", resolve, { once: true }),
    );
  const [w, h] = mediaDimensions(),
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  try {
    const ctx = c.getContext("2d");
    ctx.drawImage(gifCanvas || video, 0, 0, w, h);
    const selected = reviewTools?.sphereMode;
    if (reviewTools) reviewTools.sphereMode = false;
    draw();
    ctx.drawImage($("#drawing-canvas"), 0, 0, w, h);
    if (reviewTools) reviewTools.sphereMode = selected;
    draw();
    const crop = project.crop;
    if (crop) {
      const cropped = document.createElement("canvas");
      cropped.width = Math.round(w * crop.w);
      cropped.height = Math.round(h * crop.h);
      cropped
        .getContext("2d")
        .drawImage(
          c,
          w * crop.x,
          h * crop.y,
          w * crop.w,
          h * crop.h,
          0,
          0,
          cropped.width,
          cropped.height,
        );
      c.width = cropped.width;
      c.height = cropped.height;
      c.getContext("2d").drawImage(cropped, 0, 0);
    }
    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Frame unavailable");
    download(blob, `${project.name}-frame-${frame}.png`);
  } catch (e) {
    toast(
      "This video host blocks frame export. Upload the file to export sketches with video.",
      true,
    );
  }
}
document.addEventListener("keydown", (e) => {
  if (
    $("#modal") ||
    !project ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  )
    return;
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === "z") {
    e.preventDefault();
    e.shiftKey ? redoStroke() : undoStroke();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const actions = {
    " ": togglePlay,
    arrowleft: () => seek(frame - 1),
    arrowright: () => seek(frame + 1),
    a: () => $("#mark-a").click(),
    b: () => $("#mark-b").click(),
    s: () => reviewTools?.key(),
    m: highlight,
    d: () => selectTool("brush"),
    w: () => reviewTools?.setMode("move"),
    e: () => reviewTools?.setMode("rotate"),
    r: () => reviewTools?.setMode("scale"),
    t: () => reviewTools?.setMode("warp"),
    q: () => reviewTools?.deselect(),
    escape: () => reviewTools?.deselect(),
    f: () => selectTool("eraser"),
  };
  if (actions[key]) {
    e.preventDefault();
    actions[key]();
  }
});
window.addEventListener("pagehide", () => {
  if (project) persist(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && project) {
    pause();
    persist(true);
  }
});
home();
