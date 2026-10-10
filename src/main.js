import { recordingFormat, exportSegments, composeExportFrame, recordVideo } from "./video-export.js";
import { onionFrames, onionSettings } from "./onion.js";
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
  playbackGeneration = 0,
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
  scrubActive = false,
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
  if ((scrubActive || currentStroke) && !immediate) return;
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
  videoExportController?.abort();
  cancelDrawingTimers?.(); cancelDrawingTimers = null;
  resetVideoOnions();
  sketchImages.clear(); liveSketch = null;
  scrubActive = false;
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
  app.innerHTML = `<div class="home-shell"><aside class="home-sidebar"><a class="brand" href="#">${icon("logo", 31)}<span>FrameSketch<span class="brand-dot">.</span></span></a><div class="workspace-label">YOUR WORKSPACE</div><nav><button class="nav-item ${filter === "all" ? "active" : ""}" data-filter="all">${icon("grid")} All projects <span>${projects.length}</span></button><button class="nav-item ${filter === "sketched" ? "active" : ""}" data-filter="sketched">${icon("brush")} With sketches</button><button class="nav-item ${filter === "new" ? "active" : ""}" data-filter="new">${icon("film")} Unreviewed</button></nav><div class="sidebar-bottom"><div class="device-note">${icon("check", 16)} Your ideas stay with you</div><p>Projects are saved in this browser.<br>Export a backup to keep them safe.</p><button id="help" class="text-button">${icon("help", 16)} Quick guide</button><div class="profile"><div class="avatar">FS</div><div>Personal workspace<small>Local storage · No account needed</small></div></div></div></aside><main class="home-main"><header class="home-top"><span>WORKSPACE <span class="slash">/</span> Projects</span><button id="import" class="text-button">${icon("upload", 16)} Import project</button></header><section class="home-content"><div class="heading-row"><div><div class="eyebrow">A CLOSER LOOK. A CLEARER IDEA.</div><h1>Your projects<span class="brand-dot">.</span></h1><p>Slow it down. Draw it out. Make every frame count.</p></div><button class="primary" id="new-project">${icon("plus")} New project</button></div><div class="welcome-banner"><div class="banner-icon">${icon("brush", 29)}</div><div><h3>Good feedback starts with a single frame.</h3><p>Bring your footage. Add your perspective. Pick up right where you left off.</p></div><span class="banner-tag">YOUR FRAME. YOUR CANVAS.</span></div><div class="project-toolbar"><div class="project-count">${filter === "all" ? "All projects" : filter === "sketched" ? "With sketches" : "Unreviewed"} <span>${list.length}</span></div><div class="list-controls"><input type="search" id="search" placeholder="Search projects…" value="${esc(search)}" aria-label="Search projects"/><select id="sort" aria-label="Sort projects"><option value="recent" ${sort === "recent" ? "selected" : ""}>Recently edited</option><option value="name" ${sort === "name" ? "selected" : ""}>Name A–Z</option></select></div></div><div class="project-grid">${list.map((p) => card(p)).join("")}<button class="new-card" id="new-card"><span>${icon("plus", 28)}</span><strong>Create a new project</strong><small>Upload a video from your device</small></button></div>${!projects.length ? `<div class="empty-tip">${icon("film", 19)} Start with your own footage, or <button id="demo" class="inline-button">explore a sample project ${icon("arrow", 14)}</button></div>` : ""}<footer class="home-footer"><span>MADE FOR THE DETAILS.</span><span>Apple Pencil & touch ready <span class="tiny-dot"></span> Safari on iPad</span></footer></section></main></div><input hidden type="file" id="import-file"/>`;
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
    `<div class="eyebrow">A LITTLE GUIDANCE</div><h2>Look closer. Draw freely.</h2><div class="guide"><p><b>01 · Bring your footage</b><br>Upload a video from your device. H.264 MP4 is recommended for iPad Safari.</p><p><b>02 · Find your frame</b><br>Use the arrow controls or drag the timeline. Set the source frame rate in the player. Zoom the timeline to reveal individual frames.</p><p><b>03 · Leave your mark</b><br>Use your Apple Pencil, touch, or mouse. Two-finger tap on the canvas undoes a drawing stroke. Sketches belong to the current frame. Add, rename, hide, lock, and fade layers.</p><p><b>04 · Review a range</b><br>Go to a frame and press A. Go to another and press B. Play the range once or switch on looping. Mark important frames with the flag.</p><p><b>05 · Keep it safe</b><br>Projects autosave in this browser. Export a project backup including its media to move it between devices.</p><p class="muted">Keyboard: Space play/pause · ← / → step · A / B range · M highlight · D brush · F eraser · W/E/R/T sphere move/rotate/scale/free transform · S key · Q hide gizmo · Ctrl/⌘ Z undo</p></div>`,
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
  app.innerHTML = `<div class="editor-shell"><header class="editor-header"><button id="back-home" class="brand compact" title="Back to projects">${icon("logo", 28)}</button><span class="header-divider"></span><button id="breadcrumbs" class="text-button">Projects ${icon("arrow", 13)}</button><button id="rename-project" class="project-name">${esc(project.name)} ${icon("pencil", 13)}</button><span class="save-chip">${icon("check", 13)} <span id="save-status">Saved on this device</span></span><div class="header-actions"><button id="attach" class="text-button">${icon("upload", 16)} Replace video</button><button id="export" class="secondary">${icon("download", 16)} Export project</button>${button("help", "Quick guide", "help")}</div></header><div class="editor-body"><aside class="drawing-tools"><div class="tool-group">${button("brush", "Brush (D)", "brush", "selected")}${button("eraser", "Eraser (F)", "eraser")}</div><div class="tool-divider"></div><label class="color-control" title="Brush color"><input id="color" type="color" value="${color}" aria-label="Brush color"/><span style="background:${color}"></span></label><div class="swatches">${["#d3fa84", "#ff7c78", "#a9baff", "#ffffff"].map((c) => `<button data-color="${c}" style="--swatch:${c}" title="Use ${c}" aria-label="Use ${c}"></button>`).join("")}</div><div class="tool-divider"></div><label class="size-control"><span id="size-label">${brushSize}</span><input id="brush-size" aria-label="Brush size" type="range" min="1" max="40" value="${brushSize}"/></label><span class="tool-caption">SIZE</span><div class="tool-divider"></div>${button("undo", "Undo drawing (Ctrl/⌘ Z)", "undo")}<span class="tool-caption">UNDO</span>${button("redo", "Redo drawing (Ctrl/⌘ Shift Z)", "redo")}<span class="tool-caption">REDO</span><div class="tool-spacer"></div>${button("download", "Export current frame", "export-frame")}</aside><main class="review-main"><div class="viewer-topline"><span>${icon("film", 14)} <span id="media-name">${esc(project.media?.name?.split("/").pop() || "Video")}</span></span><div><span class="live-dot"></span><span id="viewer-state">LOADING MEDIA</span></div></div><div class="viewer" id="viewer"><div class="media-stage" id="media-stage"><video id="video" playsinline preload="auto"></video><canvas id="gif-canvas" hidden></canvas><canvas id="drawing-canvas"></canvas></div><div class="viewer-loading" id="viewer-loading"><span class="spinner"></span><span>Preparing your canvas…</span></div><div class="frame-badge" id="frame-badge">FRAME <b>0000</b></div><div class="viewer-zoom"><button id="zoom-out" aria-label="Zoom viewer out">−</button><span id="zoom-label">Fit</span><button id="zoom-in" aria-label="Zoom viewer in">+</button><button id="fit" aria-label="Fit video">${icon("expand", 14)}</button></div></div><div class="transport"><div class="transport-left"><span class="timecode" id="timecode">00:00:00:00</span><span class="transport-separator"></span><label class="fps-label"><select id="fps" aria-label="Source frame rate">${[12, 15, 23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((n) => `<option value="${n}" ${fps === n ? "selected" : ""}>${n} fps</option>`).join("")}</select></label></div><div class="play-controls">${button("prev", "Previous frame (←)", "prev")}${button("play", "Play / pause (Space)", "play", "play-button")}${button("next", "Next frame (→)", "next")}</div><div class="transport-right">${button("volume", "Mute audio", "mute")}<input id="volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Audio volume"/><span id="total-frames">— frames</span></div></div><section class="timeline-section"><div class="timeline-header"><div class="timeline-title">${icon("film", 16)} Timeline <span id="timeline-duration">—</span></div><div class="timeline-actions"><button id="mark-a" class="marker-button" title="Set range start to current frame (A)">A <span id="a-label">IN</span></button><button id="mark-b" class="marker-button" title="Set range end to current frame (B)">B <span id="b-label">OUT</span></button><button id="clear-range" class="text-button small" title="Clear A–B range">Reset</button><span class="transport-separator"></span>${button("loop", "Toggle loop", "loop", project.loop ? "selected" : "")}${button("marker", "Highlight current frame (M)", "highlight")}<span class="transport-separator"></span><span class="zoom-caption">−</span><input id="timeline-zoom" type="range" min="1" max="32" value="${timelineZoom}" aria-label="Timeline zoom"/><span class="zoom-caption">+</span></div></div><label class="touch-scrubber">Scrub video<input id="touch-scrub" type="range" min="0" max="${Math.max(0, frameCount - 1)}" value="${frame}" step="1" aria-label="Scrub video frames"/></label><div id="timeline-scroll" class="timeline-scroll"><div id="timeline-track" class="timeline-track"><div id="ruler" class="ruler"></div><div class="filmstrip" id="filmstrip"></div><canvas id="waveform" height="42"></canvas><div id="range-overlay" class="range-overlay"></div><div id="markers" class="markers"></div><div id="playhead" class="playhead"><div class="playhead-tab"></div></div></div></div><div class="timeline-footer"><span id="frame-position">Frame 0 / —</span><span id="wave-status">Preparing waveform</span><span>Drag to scrub <span class="tiny-dot"></span> Zoom for individual frames</span></div></section></main><aside class="layers-panel"><div class="layers-heading"><h3>Sketch layers</h3>${button("plus", "Add sketch layer", "add-layer")}</div><p class="layers-caption">A little clarity, frame by frame.</p><div id="layer-list" class="layer-list"></div><div class="layer-settings" id="layer-settings"></div><div class="layer-note">${icon("brush", 24)}<p>Every frame is a fresh canvas.</p><span>Sketches stay on the frame<br>where you draw them.</span></div><div class="review-summary"><span class="eyebrow">REVIEW NOTES</span><div><span id="annotated-count">0</span> annotated frames</div><button id="next-note" class="text-button">Next annotated frame ${icon("arrow", 14)}</button></div></aside></div><footer class="editor-footer"><span><span class="live-dot"></span> <span id="tool-status">Brush</span> <span class="footer-hint">· Draw with touch, Pencil or mouse</span></span><span id="selection-status">Sketch 01</span><span>FRAMESKETCH <span class="brand-dot">/</span> REVIEW STUDIO</span></footer></div>`;
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
  const playButton = $("#play");
  let playTouch = null;
  let lastPlayTouch = -Infinity;
  playButton.onpointerdown = (e) => {
    if (!["touch", "pen"].includes(e.pointerType)) return;
    playTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (e.isTrusted) playButton.setPointerCapture(e.pointerId);
  };
  playButton.onpointerup = (e) => {
    if (!playTouch || playTouch.id !== e.pointerId) return;
    const tap = Math.hypot(e.clientX - playTouch.x, e.clientY - playTouch.y) < 16;
    playTouch = null;
    if (!tap) return;
    e.preventDefault();
    lastPlayTouch = performance.now();
    togglePlay();
  };
  playButton.onpointercancel = () => { playTouch = null; };
  playButton.onclick = () => {
    if (performance.now() - lastPlayTouch < 800) return;
    togglePlay();
  };
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
    preview: () => draw(),
    changed: () => {
      draw();
      updateFrame();
      persist();
      renderLayers();
    },
  });
  mountVideoEdits();
  mountOnionControls();
  mountVideoExport();
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
  canvas.width = Math.min(w, matchMedia("(pointer: coarse)").matches ? 1280 : 2560);
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
  const scrub = $("#touch-scrub");
  if (scrub && !scrubActive) {
    const max = String(Math.max(0, frameCount - 1));
    if (scrub.max !== max) scrub.max = max;
    if (scrub.value !== String(frame)) scrub.value = frame;
  }
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
  playbackGeneration++;
  playing = false;
  video?.pause();
  cancelAnimationFrame(raf);
  if ($("#play")) {
    $("#play").innerHTML = icon("play");
    $("#play").setAttribute("aria-label", "Play / pause (Space)");
  }
  if (project) { persist(); refreshVideoOnions(); }
}
async function togglePlay() {
  if (!mediaLoaded) return;
  if (playing) {
    pause();
    return;
  }
  const [start, end] = playbackRange(project.a, project.b, frameCount);
  if (frame < start || frame >= end) seek(start);
  audioContext?.resume().catch(() => {});
  const generation = ++playbackGeneration;
  playing = true;
  $("#play").innerHTML = icon("pause");
  playbackStart = performance.now();
  playbackTime = frame / fps;
  if (!gif)
    try {
      await video.play();
    } catch (e) {
      if (generation !== playbackGeneration) return;
      pause();
      toast(
        "Playback could not start. Tap play again or try another video.",
        true,
      );
      return;
    }
  if (!playing || generation !== playbackGeneration) return;
  const tick = (now) => {
    if (!playing || generation !== playbackGeneration) return;
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
  const scrub = $("#touch-scrub");
  scrub.onpointerdown = () => {
    scrubActive = true;
    clearTimeout(saveTimer);
    pause();
  };
  scrub.oninput = (e) => seek(+e.target.value);
  const finishScrub = () => {
    if (!scrubActive) return;
    // End the browser's native slider gesture before synchronizing its value.
    scrubActive = false;
    persist();
  };
  scrub.onpointerup = finishScrub;
  scrub.onpointercancel = finishScrub;
  scrub.onlostpointercapture = finishScrub;
  scrub.onchange = () => { finishScrub(); persist(); };
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
    const scrubbing = e.pointerType !== "touch" || !!e.target.closest(".ruler, .playhead");
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, scrubbing };
    if (scrubbing) {
      scrubActive = true;
      clearTimeout(saveTimer);
      track.setPointerCapture(e.pointerId);
      seek(frameFrom(e));
    }
  };
  track.onpointermove = (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 4)
      gesture.moved = true;
    if (gesture.moved && gesture.scrubbing) seek(frameFrom(e));
  };
  track.onpointerup = (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const { moved, scrubbing } = gesture;
    if (moved && scrubbing) seek(frameFrom(e));
    gesture = null;
    if (!moved)
      reviewTools ? reviewTools.timeline(frameFrom(e)) : seek(frameFrom(e));
    if (scrubbing) { scrubActive = false; updateFrame(); persist(); }
  };
  const cancelTimelineGesture = () => {
    if (gesture?.scrubbing) { scrubActive = false; persist(); }
    gesture = null;
  };
  track.onpointercancel = cancelTimelineGesture;
  track.onlostpointercapture = cancelTimelineGesture;
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
        `<div class="layer-swipe"><button class="layer-overlay-action" data-overlay-layer="${l.id}" aria-pressed="${!!l.overlay}">${l.overlay ? "Overlay off" : "Overlay"}</button><button class="layer-swipe-action" data-remove-layer="${l.id}" aria-label="${project.layers.length === 1 ? "Clear" : "Delete"} ${esc(l.name)}">${project.layers.length === 1 ? "Clear" : "Delete"}</button><div class="layer-row ${l.id === activeLayer ? "active" : ""}" data-layer="${l.id}" tabindex="0" role="button" aria-label="Select ${esc(l.name)}"><div class="layer-thumbnail">${icon("brush", 18)}</div><div class="layer-label"><button data-rename="${l.id}" title="Rename layer">${esc(l.name)}</button><small data-count="${l.id}">${Object.keys(l.frames).length} frames${l.overlay ? " · Overlay" : ""}</small></div><button class="mini-button" data-visible="${l.id}" title="${l.visible ? "Hide" : "Show"} layer" aria-label="${l.visible ? "Hide" : "Show"} ${esc(l.name)}">${icon(l.visible ? "eye" : "hidden", 17)}</button><button class="mini-button ${l.locked ? "locked" : ""}" data-lock="${l.id}" title="${l.locked ? "Unlock" : "Lock"} layer" aria-label="${l.locked ? "Unlock" : "Lock"} ${esc(l.name)}">${icon(l.locked ? "lock" : "unlock", 16)}</button></div></div>`,
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
    let swipe = null;
    let swipedAt = -Infinity;
    row.onpointerdown = (e) => {
      if (e.pointerType !== "touch") return;
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    row.onpointermove = (e) => {
      if (!swipe || swipe.id !== e.pointerId) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
      if (Math.abs(dx) > 24) {
        e.preventDefault();
        if (e.isTrusted && !row.hasPointerCapture(e.pointerId)) row.setPointerCapture(e.pointerId);
        swipedAt = performance.now();
        row.parentElement.classList.toggle("revealed", dx < 0);
      }
    };
    row.onpointerup = () => { swipe = null; };
    row.onpointercancel = () => { swipe = null; };
    row.onclick = (e) => {
      if (performance.now() - swipedAt < 800) { e.preventDefault(); e.stopPropagation(); return; }
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
    $("#delete-layer").disabled = false;
    $("#delete-layer").innerHTML = `${icon("trash", 14)} ${project.layers.length === 1 ? "Clear" : "Delete"}`;
    $("#delete-layer").onclick = () => removeSketchLayer(activeLayer);
    $("#selection-status").textContent =
      `${l.name}${l.locked ? " · Locked" : ""}${!l.visible ? " · Hidden" : ""}`;
  }
  document.querySelectorAll("[data-overlay-layer]").forEach(button => {
    const toggle = () => {
      const target = project.layers.find(item => item.id === button.dataset.overlayLayer);
      target.overlay = !target.overlay;
      renderLayers(); draw(); persist();
    };
    let touched = -Infinity;
    button.onpointerup = e => {
      if (e.pointerType !== "touch") return;
      e.preventDefault(); touched = performance.now(); toggle();
    };
    button.onclick = () => { if (performance.now() - touched > 800) toggle(); };
  });
  document.querySelectorAll("[data-remove-layer]").forEach(button => {
    let touchStart = null;
    let lastTouch = -Infinity;
    button.onpointerdown = e => {
      if (e.pointerType === "touch") touchStart = { x: e.clientX, y: e.clientY };
    };
    button.onpointercancel = () => { touchStart = null; };
    button.onpointerup = e => {
      if (!touchStart) return;
      const tap = Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) < 16;
      touchStart = null;
      if (!tap) return;
      e.preventDefault();
      lastTouch = performance.now();
      removeSketchLayer(button.dataset.removeLayer);
    };
    button.onclick = () => {
      if (performance.now() - lastTouch < 800) return;
      removeSketchLayer(button.dataset.removeLayer);
    };
  });
  updateLayerFrameCounts();
}
function removeSketchLayer(id) {
  const target = project.layers.find(item => item.id === id);
  if (!target) return;
  const clearing = project.layers.length === 1;
  modal(`<h2>${clearing ? "Clear" : "Delete"} this layer?</h2><p>All sketches on “${esc(target.name)}” across the video will be removed.${clearing ? " The layer will remain." : ""}</p><button id="confirm-layer-delete" class="danger full">${clearing ? "Clear layer" : "Delete layer"}</button>`);
  $("#confirm-layer-delete").onclick = () => {
    if (clearing) target.frames = {};
    else {
      project.layers = project.layers.filter(item => item.id !== id);
      if (activeLayer === id) activeLayer = project.layers[0].id;
    }
    undo = []; redo = [];
    $("#modal").remove();
    renderLayers(); draw(); updateFrame(); persist(); updateHistory();
  };
}
function updateLayerFrameCounts() {
  project?.layers.forEach((l) => {
    const el = document.querySelector(`[data-count="${l.id}"]`);
    if (el)
      el.textContent = `${Object.keys(l.frames).filter((k) => l.frames[k].length).length} frames${l.overlay ? " · Overlay" : ""}`;
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
let cancelDrawingTimers = null;
function setupDrawing() {
  const canvas = $("#drawing-canvas");
  const viewer = $("#viewer");
  viewer.oncontextmenu = (e) => e.preventDefault();
  viewer.onselectstart = (e) => e.preventDefault();
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      clamp((e.clientX - r.left) / r.width, 0, 1),
      clamp((e.clientY - r.top) / r.height, 0, 1),
      e.pointerType === "pen" ? Math.max(0.15, e.pressure) : 0.5,
    ];
  };
  let drawingRaf = 0;
  const fingers = new Map();
  let twoFinger = null;
  let touchSnapshot = null;
  let pendingTap = null;
  const cancelPendingTap = () => { if (pendingTap) clearTimeout(pendingTap.timer); pendingTap = null; };
  cancelDrawingTimers = () => { cancelPendingTap(); cancelAnimationFrame(drawingRaf); };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const staggered = pendingTap && performance.now() - pendingTap.ended < 180 && Math.hypot(e.clientX - pendingTap.x, e.clientY - pendingTap.y) > 24;
    if (pendingTap && !staggered) pendingTap.commit();
    if (!fingers.size) touchSnapshot = structuredClone(project.spheres);
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2 || staggered) {
      cancelPendingTap();
      twoFinger = { started: performance.now(), moved: false };
      currentStroke = null;
      pointerId = null;
      if (reviewTools) reviewTools.drag = null;
      project.spheres = touchSnapshot;
      draw();
    } else if (fingers.size > 2 && twoFinger) twoFinger.moved = true;
    if (twoFinger) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  canvas.addEventListener("pointermove", (e) => {
    if (!twoFinger) return;
    const start = fingers.get(e.pointerId);
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 20)
      twoFinger.moved = true;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  const endTouch = (e) => {
    if (e.pointerType !== "touch") return;
    fingers.delete(e.pointerId);
    if (!twoFinger) return;
    if (e.type === "pointercancel") twoFinger.moved = true;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!fingers.size) {
      const tap = !twoFinger.moved && performance.now() - twoFinger.started < 650;
      twoFinger = null;
      if (tap) undoStroke();
      reviewTools?.update();
      draw();
      persist();
    }
  };
  canvas.addEventListener("pointerup", endTouch, true);
  canvas.addEventListener("pointercancel", endTouch, true);
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
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
    clearTimeout(saveTimer);
    draw();
  };
  canvas.onpointermove = (e) => {
    if (reviewTools?.pointerMove(e, canvas)) return;
    if (!currentStroke || pointerId !== e.pointerId) return;
    const coalesced = e.getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [e];
    events.forEach((event) => currentStroke.points.push(point(event)));
    if (!drawingRaf) drawingRaf = requestAnimationFrame(() => { drawingRaf = 0; draw(); });
  };
  const finish = (e) => {
    if (reviewTools?.pointerUp(e)) return;
    if (!currentStroke || pointerId !== e.pointerId) return;
    cancelAnimationFrame(drawingRaf); drawingRaf = 0;
    const l = layer(), stroke = currentStroke, strokeFrame = drawingFrame(project, frame);
    currentStroke = null; pointerId = null;
    if (e.type === "pointercancel") { draw(); return; }
    const commit = () => {
      cancelPendingTap();
      (l.frames[strokeFrame] ||= []).push(stroke);
      undo.push({ layer: l.id, frame: strokeFrame, stroke }); redo = [];
      updateHistory(); draw(); updateFrame(); persist();
    };
    const first = stroke.points[0], last = stroke.points.at(-1);
    if (e.pointerType === "touch" && Math.hypot(last[0] - first[0], last[1] - first[1]) < 0.01) {
      pendingTap = { x: e.clientX, y: e.clientY, ended: performance.now(), commit, timer: setTimeout(commit, 180) };
      draw();
    } else commit();
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
const sketchImages = new Map();
let liveSketch = null;
function draw({ onions = true } = {}) {
  const canvas = $("#drawing-canvas");
  if (!canvas || !project) return;
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const createImage = () => { const image = document.createElement("canvas"); image.width = w; image.height = h; return image; };
  for (const l of [...project.layers].reverse()) {
    if (!l.visible) continue;
    const signature = currentStroke && sketchImages.get(l.id)?.frame === frame ? sketchImages.get(l.id).signature : JSON.stringify([project.id, frame, w, h, l.overlay, onions, project.sketchOnion,
      Object.entries(l.frames).map(([n, strokes]) => [n, strokes.map(s => s.id)])]);
    let cached = sketchImages.get(l.id);
    if (!cached || cached.signature !== signature) {
      const references = l.overlay || !onions ? [] : onionFrames(frame, frameCount, project.sketchOnion, n => drawingFrame(project, n));
      const image = createImage(), ghosts = references.length ? createImage() : null;
      const imageCtx = image.getContext("2d"), ghostCtx = ghosts?.getContext("2d");
      for (const ghost of references) {
        const mask = createImage(), maskCtx = mask.getContext("2d");
        (l.frames[ghost.frame] || []).forEach(stroke => paintStroke(maskCtx, stroke, w, h));
        maskCtx.globalCompositeOperation = "source-in"; maskCtx.fillStyle = ghost.color; maskCtx.fillRect(0, 0, w, h);
        ghostCtx.globalAlpha = ghost.opacity; ghostCtx.drawImage(mask, 0, 0); mask.width = 0;
      }
      if (l.overlay) {
        for (const n of Object.keys(l.frames).sort((a,b) => +a - +b)) {
          const frameImage = createImage(), frameCtx = frameImage.getContext("2d");
          l.frames[n].forEach(stroke => paintStroke(frameCtx, stroke, w, h));
          imageCtx.drawImage(frameImage, 0, 0); frameImage.width = 0;
        }
      } else (l.frames[drawingFrame(project, frame)] || []).forEach(stroke => paintStroke(imageCtx, stroke, w, h));
      cached = { signature, frame, image, ghosts }; sketchImages.set(l.id, cached);
    }
    ctx.globalAlpha = l.opacity;
    if (cached.ghosts) ctx.drawImage(cached.ghosts, 0, 0);
    let image = cached.image;
    if (l.id === activeLayer && currentStroke) {
      if (!liveSketch || liveSketch.id !== currentStroke.id || liveSketch.signature !== signature) {
        liveSketch = { id: currentStroke.id, signature, image: createImage(), points: 0 };
        liveSketch.image.getContext("2d").drawImage(cached.image, 0, 0);
      }
      if (currentStroke.points.length > liveSketch.points) {
        paintStroke(liveSketch.image.getContext("2d"), { ...currentStroke, points: currentStroke.points.slice(Math.max(0, liveSketch.points - 1)) }, w, h);
        liveSketch.points = currentStroke.points.length;
      }
      image = liveSketch.image;
    }
    ctx.drawImage(image, 0, 0);
  }
  ctx.globalAlpha = 1;
  reviewTools?.draw(ctx, w, h);
  if (!currentStroke && onions) refreshVideoOnions();
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
    if (!project.videoHidden) ctx.drawImage(gifCanvas || video, 0, 0, w, h);
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
let onionDecoder = null, onionTimer = null, onionGeneration = 0, onionSignature = '', onionQueue = Promise.resolve();
const videoGhosts = new Map();
let videoGhostIdentity = '';
function resetVideoOnions() {
  clearTimeout(onionTimer); onionQueue = Promise.resolve(); onionGeneration++; onionSignature = ''; videoGhosts.clear(); videoGhostIdentity = '';
  onionDecoder?.removeAttribute('src'); onionDecoder?.load(); onionDecoder = null;
}
function mountOnionControls() {
  const actions = $('.header-actions');
  const button = document.createElement('button'); button.id = 'onion-settings'; button.className = 'secondary'; button.innerHTML = `${icon('film', 16)} Onion skin`; button.setAttribute('aria-label', 'Onion skin settings'); button.title = 'Onion skin settings';
  button.onclick = onionDialog; actions.prepend(button);
  const visibility = document.createElement('button'); visibility.id = 'video-visible'; visibility.className = 'secondary';
  const update = () => { visibility.innerHTML = `${icon(project.videoHidden ? 'hidden' : 'eye', 16)} ${project.videoHidden ? 'Show video' : 'Hide video'}`; visibility.setAttribute('aria-label', project.videoHidden ? 'Show video' : 'Hide video'); visibility.title = project.videoHidden ? 'Show video' : 'Hide video'; visibility.setAttribute('aria-pressed', String(!project.videoHidden)); draw(); };
  visibility.onclick = () => { project.videoHidden = !project.videoHidden; update(); persist(); };
  actions.prepend(visibility);
  const ghosts = document.createElement('canvas'); ghosts.id = 'video-onions'; $('.media-stage').insertBefore(ghosts, $('#drawing-canvas'));
  update();
}
function onionDialog() {
  pause();
  const el = modal(`<h2>Onion skin</h2><p>Previous and next frames fade with distance. Overlay layers skip sketch onion skinning. Video ghosts appear while paused.</p>${['sketch', 'video'].map(kind => {
    const s = onionSettings(project[kind + 'Onion']);
    return `<fieldset class="onion-settings" data-onion="${kind}"><legend>${kind === 'sketch' ? 'Sketches' : 'Video frames'}</legend><label class="onion-toggle"><input type="checkbox" data-setting="enabled" ${s.enabled ? 'checked' : ''}/> Enable ${kind} onion skin</label><label>Opacity <output>${Math.round(s.opacity * 100)}%</output><input data-setting="opacity" aria-label="${kind} onion opacity" type="range" min="0" max="100" value="${Math.round(s.opacity * 100)}"/></label>${['previous', 'next'].map(side => `<div class="onion-side"><label>${side === 'previous' ? 'Previous' : 'Next'} frames<input data-setting="${side}" aria-label="${kind} ${side} frames" type="number" min="0" max="12" value="${s[side]}"/></label><label>Color<input data-setting="${side}Color" aria-label="${kind} ${side} color" type="color" value="${s[side + 'Color']}"/></label></div>`).join('')}</fieldset>`;
  }).join('')}`, true);
  el.querySelectorAll('[data-setting]').forEach(input => {
    input.oninput = () => {
      const kind = input.closest('[data-onion]').dataset.onion, key = input.dataset.setting;
      const settings = onionSettings(project[kind + 'Onion']);
      settings[key] = input.type === 'checkbox' ? input.checked : input.type === 'color' ? input.value : key === 'opacity' ? +input.value / 100 : +input.value;
      project[kind + 'Onion'] = onionSettings(settings);
      input.closest('fieldset').querySelector('output').textContent = Math.round(project[kind + 'Onion'].opacity * 100) + '%';
      onionSignature = ''; draw(); persist();
    };
  });
}
function renderVideoGhosts() {
  const canvas = $('#video-onions');
  if (!canvas || !project) return;
  const drawing = $('#drawing-canvas');
  if (canvas.width !== drawing.width) canvas.width = drawing.width;
  if (canvas.height !== drawing.height) canvas.height = drawing.height;
  const crop = project.crop || { x: 0, y: 0, w: 1, h: 1 };
  Object.assign(canvas.style, { width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${-100 * crop.x / crop.w}%`, top: `${-100 * crop.y / crop.h}%` });
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (project.videoHidden || playing) return;
  for (const ghost of onionFrames(frame, frameCount, project.videoOnion)) {
    const cached = videoGhosts.get(sourceFrame(project.clipRanges, ghost.frame));
    if (!cached) continue;
    const tinted = document.createElement('canvas'); tinted.width = cached.width; tinted.height = cached.height;
    const tint = tinted.getContext('2d'); tint.drawImage(cached, 0, 0); tint.globalCompositeOperation = 'multiply'; tint.fillStyle = ghost.color; tint.fillRect(0, 0, tinted.width, tinted.height);
    ctx.globalAlpha = ghost.opacity; ctx.drawImage(tinted, 0, 0, canvas.width, canvas.height); tinted.width = 0;
  }
  ctx.globalAlpha = 1;
}
function refreshVideoOnions() {
  if (!project || !$('#video-onions')) return;
  const identity = JSON.stringify([video?.src, fps, project.clipRanges]);
  if (identity !== videoGhostIdentity) { videoGhosts.clear(); videoGhostIdentity = identity; }
  if (video) video.style.visibility = project.videoHidden ? 'hidden' : '';
  if (gifCanvas) gifCanvas.style.visibility = project.videoHidden ? 'hidden' : '';
  renderVideoGhosts();
  const signature = JSON.stringify([frame, fps, project.videoOnion, project.videoHidden, playing, project.clipRanges, video?.src]);
  if (signature === onionSignature) return;
  onionSignature = signature;
  const generation = ++onionGeneration;
  clearTimeout(onionTimer);
  if (!mediaLoaded || !video?.src || gif || project.videoHidden || playing || !onionSettings(project.videoOnion).enabled) return;
  const requested = onionFrames(frame, frameCount, project.videoOnion).map(ghost => sourceFrame(project.clipRanges, ghost.frame));
  const source = video.src, rate = fps;
  onionTimer = setTimeout(() => {
    onionQueue = onionQueue.catch(() => {}).then(async () => {
      if (generation !== onionGeneration) return;
      if (!onionDecoder || onionDecoder.src !== source) {
        onionDecoder?.removeAttribute('src');
        onionDecoder = document.createElement('video'); onionDecoder.muted = true; onionDecoder.playsInline = true; onionDecoder.preload = 'auto'; onionDecoder.src = source;
      }
      const decoder = onionDecoder;
      if (decoder.readyState < 1) await waitForMedia(decoder, 'loadedmetadata');
      for (const index of requested) {
        if (generation !== onionGeneration) return;
        if (videoGhosts.has(index)) continue;
        const ready = waitForMedia(decoder, 'seeked');
        decoder.currentTime = Math.min(index / rate + 0.0001, decoder.duration - 0.0001);
        await ready;
        if (generation !== onionGeneration) return;
        const image = document.createElement('canvas'); image.width = Math.min(decoder.videoWidth, 640); image.height = Math.round(image.width * decoder.videoHeight / decoder.videoWidth);
        image.getContext('2d').drawImage(decoder, 0, 0, image.width, image.height);
        videoGhosts.set(index, image);
        if (videoGhosts.size > 48) videoGhosts.delete(videoGhosts.keys().next().value);
        renderVideoGhosts();
      }
    }).catch(() => {
      if (generation === onionGeneration) toast('Video onion frames could not be decoded. Sketch onion skin is still available.', true);
    });
  }, 80);
}
function waitForMedia(media, event) {
  return new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); media.removeEventListener(event, success); media.removeEventListener('error', failure); };
    const success = () => { done(); resolve(); }, failure = () => { done(); reject(new Error('Video decode failed')); };
    const timer = setTimeout(failure, 5000);
    media.addEventListener(event, success, { once: true }); media.addEventListener('error', failure, { once: true });
  });
}

let videoExportController = null;
const videoAudioSources = new WeakMap();
home();

function mountVideoExport() {
  const button = document.createElement('button');
  button.id = 'export-video'; button.className = 'secondary';
  button.innerHTML = `${icon('download', 16)} Export video`; button.setAttribute('aria-label', 'Export video'); button.title = 'Export video';
  button.onclick = videoExportDialog;
  $('.header-actions').prepend(button);
}
function videoExportDialog() {
  if (!mediaLoaded || gif || !video?.src) { toast('Upload a video before exporting.', true); return; }
  pause();
  const format = recordingFormat();
  if (!format || !HTMLCanvasElement.prototype.captureStream) {
    modal('<h2>Video export unavailable</h2><p>This browser cannot record a canvas video. Try a current version of Safari or Chrome.</p>'); return;
  }
  const el = modal(`<h2>Export video</h2><p>Includes visible footage, sketch layers, overlays and spheres. Hidden items, onion skins, gizmos and website controls stay out. With video hidden, export is silent.</p><label>Range<select id="video-export-range"><option value="all">Entire edited video</option>${project.a !== null && project.b !== null ? '<option value="ab">A–B range</option>' : ''}</select></label><label>Resolution<select id="video-export-size"><option value="1280">Up to 1280 pixels</option><option value="1920">Up to 1920 pixels</option></select></label><p class="info-note">Exports ${format.extension.toUpperCase()} in about the clip’s playback time. Keep this page open and your iPad awake.</p><button class="primary full" id="start-video-export">Export video</button><progress id="video-export-progress" max="1" value="0" hidden></progress><p id="video-export-status" role="status"></p><div id="video-export-error" class="form-error" role="alert"></div><a id="save-video-export" class="primary full" hidden>Save exported video</a>`, true);
  $('#start-video-export').onclick = async () => {
    const start = $('#start-video-export'), status = $('#video-export-status'), error = $('#video-export-error'), progress = $('#video-export-progress');
    const originalFrame = frame, originalSphereMode = reviewTools?.sphereMode;
    const selectedRange = $('#video-export-range').value === 'ab' ? playbackRange(project.a, project.b, frameCount) : [0, frameCount - 1];
    const segments = exportSegments(project.clipRanges, ...selectedRange);
    const controller = new AbortController(); videoExportController = controller;
    let closeAfterExport = false;
    const close = () => { closeAfterExport = true; controller.abort(); if (!start.disabled) el.remove(); };
    $('#modal-close').onclick = close;
    el.onclick = event => { if (event.target === el) close(); };
    el.onkeydown = event => { if (event.key === 'Escape') close(); };
    start.disabled = true; error.textContent = ''; progress.hidden = false; status.textContent = 'Preparing export…';
    $('#video-export-range').disabled = true; $('#video-export-size').disabled = true;
    let audioOutput = null, audioGain = null, audioSource = null, audioResume = Promise.resolve();
    try {
      const canvas = document.createElement('canvas'), [width, height] = mediaDimensions();
      const crop = project.crop || { x: 0, y: 0, w: 1, h: 1 };
      const scale = Math.min(1, +$('#video-export-size').value / Math.max(width * crop.w, height * crop.h));
      canvas.width = Math.max(2, Math.round(width * crop.w * scale / 2) * 2);
      canvas.height = Math.max(2, Math.round(height * crop.h * scale / 2) * 2);
      const ctx = canvas.getContext('2d');
      // Resume audio inside the user's tap before waiting for the initial seek.
      if (!project.videoHidden && !video.muted && video.volume > 0) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('Audio export is unavailable. Mute audio to export a silent video.');
        audioContext ||= new AudioCtx();
        audioResume = audioContext.resume();
        let source = videoAudioSources.get(video);
        if (!source) { source = audioContext.createMediaElementSource(video); source.connect(audioContext.destination); videoAudioSources.set(video, source); }
        audioSource = source;
        audioOutput = audioContext.createMediaStreamDestination(); audioGain = audioContext.createGain();
        audioGain.gain.value = video.volume; source.connect(audioGain); audioGain.connect(audioOutput);
      }
      const unlocked = video.play();
      await Promise.all([unlocked, audioResume]);
      video.pause();
      if (reviewTools) reviewTools.sphereMode = false;
      const target = segments[0].start / fps + 0.0001;
      if (Math.abs(video.currentTime - target) > 0.00001 || video.seeking) {
        const ready = waitForMedia(video, 'seeked'); video.currentTime = Math.min(target, video.duration - 0.0001); await ready;
      }
      if (controller.signal.aborted) throw new Error('Export cancelled.');
      status.textContent = 'Exporting… 0%';
      const blob = await recordVideo({
        video, canvas, fps, segments, format, audioTracks: audioOutput?.stream.getAudioTracks() || [], signal: controller.signal,
        render: n => { frame = n; draw({ onions: false }); composeExportFrame(ctx, { video, sketches: $('#drawing-canvas'), hideVideo: project.videoHidden, crop }); },
        progress: value => { progress.value = value; status.textContent = `Exporting… ${Math.round(value * 100)}%`; },
      });
      const link = $('#save-video-export'), url = URL.createObjectURL(blob);
      link.href = url; link.download = `${project.name}-review.${format.extension}`; link.hidden = false;
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
      status.textContent = 'Export ready. Tap Save exported video.';
    } catch (failure) { error.textContent = failure.message; status.textContent = ''; }
    finally {
      video?.pause(); if (audioSource && audioGain) audioSource.disconnect(audioGain); audioGain?.disconnect(); audioOutput?.stream.getTracks().forEach(track => track.stop());
      if (reviewTools) reviewTools.sphereMode = originalSphereMode;
      videoExportController = null; start.disabled = false; $('#video-export-range').disabled = false; $('#video-export-size').disabled = false;
      if (video && mediaLoaded) { seek(originalFrame); draw(); }
      if (closeAfterExport) el.remove();
    }
  };
}
