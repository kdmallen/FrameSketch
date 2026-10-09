import { uid, clamp } from "./core.js";
export const groupAt = (p, n) =>
  (p.groups || []).find((g) => n >= g.start && n <= g.end);
export const drawingFrame = (p, n) => groupAt(p, n)?.start ?? n;
export const defaultPose = () => ({
  x: 0.5,
  y: 0.5,
  width: 1,
  height: 1,
  rx: 0,
  ry: 0,
  rz: 0,
  skew: 0,
  tlx: 0,
  tly: 0,
  trx: 0,
  try: 0,
  blx: 0,
  bly: 0,
  brx: 0,
  bry: 0,
});
export function spherePose(s, n) {
  if (s.draft?.frame === n) return { ...s.draft.pose };
  const keys = Object.keys(s.keys)
    .map(Number)
    .sort((a, b) => a - b);
  if (!keys.length) return { ...s.pose };
  const left = keys.filter((k) => k <= n).at(-1) ?? keys[0],
    right = keys.find((k) => k >= n) ?? keys.at(-1);
  const t = left === right ? 0 : (n - left) / (right - left),
    a = s.keys[left],
    b = s.keys[right];
  return Object.fromEntries(
    Object.keys(defaultPose()).map((k) => [
      k,
      (a[k] ?? defaultPose()[k]) +
        ((b[k] ?? defaultPose()[k]) - (a[k] ?? defaultPose()[k])) * t,
    ]),
  );
}
const colors = ["#a9baff", "#ffbc75", "#85dbba", "#e8a4d9", "#bada78"];
export class ReviewTools {
  constructor(api) {
    this.api = api;
    this.groupMode = false;
    this.anchor = null;
    this.sphereMode = false;
    this.mode = "move";
    const p = api.project();
    p.groups ||= [];
    if (!p.spheres) {
      p.spheres = [];
      if (p.sphere) {
        const old = p.sphere;
        const convert = (pose) => ({
          ...defaultPose(),
          ...pose,
          width: pose.width / 0.24,
          height: pose.height / 0.38,
        });
        old.pose = convert(old.pose);
        Object.keys(old.keys).forEach(
          (k) => (old.keys[k] = convert(old.keys[k])),
        );
        if (old.draft) old.draft.pose = convert(old.draft.pose);
        p.spheres.push({
          ...old,
          id: uid(),
          name: "Sphere 1",
          baseWidth: 0.24,
          baseHeight: 0.38,
          color: "#d3fa84",
          lineWidth: 1,
        });
        delete p.sphere;
      }
    }
    this.active = p.spheres[0]?.id;
    this.outside = (e) => {
      if (
        e.target.closest(".sphere-panel") ||
        e.target.closest("#drawing-canvas") ||
        e.target.closest(".sphere-track")
      )
        return;
      this.deselect();
    };
    document.addEventListener("pointerdown", this.outside);

    this.mount();
  }
  mount() {
    const { api } = this;
    const clear = document.createElement("button");
    clear.id = "clear-frame";
    clear.className = "text-button small";
    clear.textContent = "Clear frame";
    clear.title = "Clear every sketch layer on the current frame or group";
    document.querySelector(".layers-heading").append(clear);
    clear.onclick = () => {
      if (!api.ready()) return;
      api.pause();
      const p = api.project(),
        n = drawingFrame(p, api.frame());
      const g = groupAt(p, api.frame());
      if (
        !confirm(
          g
            ? `Clear drawings on all layers for group ${g.start}–${g.end}?`
            : "Clear drawings on all layers for this frame?",
        )
      )
        return;
      for (const l of p.layers) delete l.frames[n];
      api.resetHistory();
      api.changed();
    };
    const actions = document.querySelector(".timeline-actions");
    const group = document.createElement("button");
    group.id = "group-mode";
    group.className = "marker-button";
    group.textContent = "Group";
    group.title = "Toggle grouping: click the first and last frame";
    group.setAttribute("aria-pressed", "false");
    actions.prepend(group);
    group.onclick = () => {
      this.groupMode = !this.groupMode;
      this.anchor = null;
      group.classList.toggle("selected", this.groupMode);
      group.setAttribute("aria-pressed", String(this.groupMode));
      this.status();
    };
    const ungroup = document.createElement("button");
    ungroup.id = "ungroup";
    ungroup.className = "text-button small";
    ungroup.textContent = "Ungroup";
    actions.prepend(ungroup);
    ungroup.onclick = () => {
      const p = api.project(),
        g = groupAt(p, api.frame());
      if (!g) return;
      for (const l of p.layers) {
        const strokes = l.frames[g.start];
        if (strokes)
          for (let i = g.start + 1; i <= g.end; i++)
            l.frames[i] = structuredClone(strokes);
      }
      p.groups = p.groups.filter((item) => item.id !== g.id);
      api.resetHistory();
      api.changed();
    };
    const help = document.createElement("div");
    help.id = "group-status";
    help.className = "group-status";
    document.querySelector(".timeline-section").prepend(help);
    const track = document.querySelector("#timeline-track");
    const sphereRow = document.createElement("div");
    sphereRow.id = "sphere-track";
    sphereRow.className = "sphere-track";
    track.prepend(sphereRow);
    const groupOverlay = document.createElement("div");
    groupOverlay.id = "frame-groups";
    track.append(groupOverlay);
    const slices = document.createElement("div");
    slices.id = "video-slices";
    track.append(slices);
    const panel = document.createElement("section");
    panel.className = "sphere-panel";
    panel.innerHTML = `<div class="sphere-title"><strong>Guide spheres</strong><button id="add-sphere" class="secondary">Add sphere</button></div><select id="sphere-list" aria-label="Select sphere"></select><div id="sphere-controls" hidden><div class="sphere-buttons"><button id="sphere-edit" class="secondary">Select / Edit</button><button id="sphere-visible" class="secondary">Hide</button><button id="key-sphere" class="primary">Key · S</button></div><div class="gizmo-modes">${["move", "rotate", "scale", "warp"].map((mode, i) => `<button data-mode="${mode}" title="${["W", "E", "R", "T"][i]}">${["Move W", "Rotate E", "Scale R", "Free T"][i]}</button>`).join("")}</div><p>Use axis handles or the inner control for free movement/rotation. Click outside to hide controls.</p><div id="sphere-fields"></div><label class="sphere-style">Line thickness<input id="sphere-line" aria-label="Sphere line thickness" type="range" min="1" max="8" step=".5"/><output id="line-output"></output></label><label class="sphere-style">Line color<input id="sphere-color" aria-label="Sphere line color" type="color"/></label><div class="sphere-color-swatches">${["#d3fa84", "#ff7c78", "#a9baff", "#ffffff", "#111111"].map((color) => `<button data-sphere-color="${color}" aria-label="Sphere color ${color}" style="background:${color}"></button>`).join("")}</div><div class="sphere-buttons"><button id="reset-warp" class="text-button">Reset warp</button><button id="delete-key" class="text-button">Delete current key</button><button id="remove-sphere" class="text-button">Remove sphere</button></div><div class="sphere-legend">T top · B bottom · L left · R right · F front · Back rear</div></div>`;
    document.querySelector(".layer-note").replaceWith(panel);
    document.querySelector("#add-sphere").onclick = () => {
      if (!api.ready()) return;
      const items = api.project().spheres;
      if (items.length >= 100) {
        api.toast("A project supports up to 100 spheres.");
        return;
      }
      const sphere = {
        id: uid(),
        name: `Sphere ${items.length + 1}`,
        pose: defaultPose(),
        keys: {},
        visible: true,
        lineWidth: 1,
        color: "#d3fa84",
      };
      items.push(sphere);
      this.active = sphere.id;
      this.sphereMode = true;
      this.update();
      api.changed();
    };
    document.querySelector("#sphere-list").onchange = (e) =>
      this.select(e.target.value);
    panel.addEventListener("focusin", () => {
      if (this.selected()) {
        this.sphereMode = true;
        panel.querySelectorAll("[data-mode]").forEach((button) =>
          button.classList.toggle("selected", button.dataset.mode === this.mode),
        );
        api.preview();
      }
    });
    document.querySelector("#sphere-edit").onclick = () => {
      this.sphereMode = true;
      this.update();
      api.changed();
    };
    panel.querySelectorAll("[data-mode]").forEach((button) => {
      let touch = null;
      let lastTouch = -Infinity;
      button.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") return;
        touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
        if (e.isTrusted) button.setPointerCapture(e.pointerId);
      });
      button.addEventListener("pointerup", (e) => {
        if (!touch || touch.id !== e.pointerId) return;
        const tap = Math.hypot(e.clientX - touch.x, e.clientY - touch.y) < 16;
        touch = null;
        if (!tap) return;
        e.preventDefault();
        lastTouch = performance.now();
        this.setMode(button.dataset.mode);
      });
      button.addEventListener("pointercancel", () => { touch = null; });
      button.onclick = () => {
        if (performance.now() - lastTouch < 800) return;
        this.setMode(button.dataset.mode);
      };
    });
    document.querySelector("#sphere-visible").onclick = () => {
      const sphere = this.selected();
      sphere.visible = !sphere.visible;
      this.update();
      api.changed();
    };
    document.querySelector("#key-sphere").onclick = () => this.key();
    document.querySelector("#delete-key").onclick = () => {
      const sphere = this.selected();
      delete sphere.keys[api.frame()];
      delete sphere.draft;
      this.update();
      api.changed();
    };
    document.querySelector("#remove-sphere").onclick = () => {
      if (!confirm("Remove this sphere and its keys?")) return;
      const p = api.project();
      p.spheres = p.spheres.filter((item) => item.id !== this.active);
      this.active = p.spheres[0]?.id;
      this.sphereMode = false;
      this.update();
      api.changed();
    };
    panel.querySelectorAll("[data-sphere-color]").forEach((button) => {
      button.onclick = () => {
        this.selected().color = button.dataset.sphereColor;
        this.update();
        api.changed();
      };
    });
    document.querySelector("#sphere-line").oninput = (e) => {
      this.selected().lineWidth = +e.target.value;
      this.update();
      api.changed();
    };
    document.querySelector("#sphere-color").oninput = (e) => {
      this.selected().color = e.target.value;
      api.changed();
    };
    document.querySelector("#reset-warp").onclick = () => {
      const pose = spherePose(this.selected(), api.frame());
      for (const k of ["tlx", "tly", "trx", "try", "blx", "bly", "brx", "bry"])
        pose[k] = 0;
      pose.skew = 0;
      this.edit(pose);
    };
    const fields = [
      ["x", "X", 0, 1, 0.005],
      ["y", "Y", 0, 1, 0.005],
      ["width", "Scale X", 0.02, 5, 0.01],
      ["height", "Scale Y", 0.02, 5, 0.01],
      ["rx", "Rotate X", -180, 180, 1],
      ["ry", "Rotate Y", -180, 180, 1],
      ["rz", "Rotate Z", -180, 180, 1],
      ["skew", "Skew", -1, 1, 0.01],
    ];
    document.querySelector("#sphere-fields").innerHTML = fields
      .map(
        ([key, label, min, max, step]) =>
          `<label>${label}<input data-pose="${key}" aria-label="Sphere ${label}" type="range" min="${min}" max="${max}" step="${step}"/><output data-output="${key}"></output></label>`,
      )
      .join("");
    document.querySelectorAll("[data-pose]").forEach(
      (input) =>
        (input.oninput = () => {
          const s = this.selected(),
            pose = spherePose(s, api.frame());
          pose[input.dataset.pose] = +input.value;
          this.edit(pose);
        }),
    );
    panel.addEventListener("keydown", (e) => {
      if (e.target.type !== "range") return;
      const key = e.key.toLowerCase(),
        mode = { w: "move", e: "rotate", r: "scale", t: "warp" }[key];
      if (key === "s" || mode || key === "q" || key === "escape") {
        e.preventDefault();
        e.stopPropagation();
        if (key === "s") this.key();
        else if (mode) this.setMode(mode);
        else this.deselect();
      }
    });
    this.update();
  }
  edit(pose) {
    this.api.pause();
    const s = this.selected();
    if (!s) return;
    if (!Object.keys(s.keys).length) s.pose = pose;
    else s.draft = { frame: this.api.frame(), pose };
    this.update();
    this.api.changed();
  }
  key() {
    const s = this.selected();
    if (!s || !this.api.ready()) return;
    this.api.pause();
    s.keys[this.api.frame()] = spherePose(s, this.api.frame());
    delete s.draft;
    this.update();
    this.api.changed();
  }
  timeline(n) {
    const { api } = this,
      p = api.project();
    n = clamp(Math.floor(n), 0, api.count() - 1);
    if (this.groupMode) {
      api.seek(n);
      if (this.anchor === null) {
        this.anchor = n;
        this.status();
        return true;
      }
      const start = Math.min(n, this.anchor),
        end = Math.max(n, this.anchor);
      this.anchor = null;
      if (p.groups.some((g) => start <= g.end && end >= g.start)) {
        api.toast("Groups cannot overlap. Ungroup the existing range first.");
        this.status();
        return true;
      }
      const g = {
        id: uid(),
        start,
        end,
        color: colors[p.groups.length % colors.length],
      };
      for (const l of p.layers) {
        const combined = [];
        for (let i = start; i <= end; i++) {
          combined.push(...(l.frames[i] || []));
          delete l.frames[i];
        }
        if (combined.length) l.frames[start] = combined;
      }
      p.groups.push(g);
      api.resetHistory();
      api.seek(start);
      api.changed();
      this.status();
      return true;
    }
    api.seek(drawingFrame(p, n));
    return false;
  }
  status() {
    const el = document.querySelector("#group-status");
    if (el)
      el.textContent = this.groupMode
        ? this.anchor === null
          ? "Grouping on · Click first frame, then last frame"
          : `Start ${this.anchor} · Click the last frame`
        : "Grouping off · Click a colored group to review its first frame";
  }
  update() {
    const p = this.api.project(),
      s = this.selected();
    document.querySelector("#sphere-controls").hidden = !s;
    const list = document.querySelector("#sphere-list");
    const signature = p.spheres.map((s) => s.id).join(",");
    if (list.dataset.signature !== signature) {
      list.innerHTML = p.spheres
        .map((s, i) => `<option value="${s.id}">Sphere ${i + 1}</option>`)
        .join("");
      list.dataset.signature = signature;
    }
    list.value = this.active || "";
    list.hidden = !p.spheres.length;
    document
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          b.dataset.mode === this.mode && this.sphereMode,
        ),
      );
    if (s) {
      document.querySelector("#sphere-line").value = s.lineWidth ?? 1;
      document.querySelector("#line-output").textContent = s.lineWidth ?? 1;
      document.querySelector("#sphere-color").value = s.color || "#d3fa84";
      const pose = spherePose(s, this.api.frame());
      document.querySelectorAll("[data-pose]").forEach((input) => {
        if (document.activeElement !== input || this.drag)
          input.value = pose[input.dataset.pose];
        document.querySelector(
          `[data-output="${input.dataset.pose}"]`,
        ).textContent = pose[input.dataset.pose].toFixed(
          input.dataset.pose.startsWith("r") ? 0 : 2,
        );
      });
      document
        .querySelector("#sphere-edit")
        .classList.toggle("selected", this.sphereMode);
      document.querySelector("#sphere-visible").textContent = s.visible
        ? "Hide"
        : "Show";
      document.querySelector("#key-sphere").textContent = s.keys[
        this.api.frame()
      ]
        ? "Update key · S"
        : "Key · S";
      document.querySelector("#delete-key").disabled =
        !s.keys[this.api.frame()];
    }
    const z = this.api.zoom();
    let sliceStart = 0;
    document.querySelector("#video-slices").innerHTML = (p.clipRanges || [])
      .map((r, i) => {
        const start = sliceStart;
        sliceStart += r.end - r.start + 1;
        return `<div class="video-slice-bound" style="left:${start * z}px;width:${(r.end - r.start + 1) * z}px"><span>Slice ${i + 1}</span></div>`;
      })
      .join("");
    document.querySelector("#frame-groups").innerHTML = p.groups
      .map(
        (g) =>
          `<div class="frame-group" style="left:${g.start * z}px;width:${(g.end - g.start + 1) * z}px;--group-color:${g.color}" title="Group ${g.start}–${g.end}"><span>${g.start}–${g.end}</span></div>`,
      )
      .join("");
    const row = document.querySelector("#sphere-track");
    row.innerHTML =
      p.spheres
        .map(
          (s, i) =>
            `<div class="sphere-track sphere-row ${s.id === this.active && this.sphereMode ? "active" : ""}"><button class="sphere-row-select" data-sphere="${s.id}">Sphere ${i + 1}</button>${Object.keys(
              s.keys,
            )
              .map(
                (n) =>
                  `<button class="sphere-key ${+n === this.api.frame() ? "current" : ""}" style="left:${n * z}px" data-key="${n}" data-sphere-key="${s.id}" title="Sphere ${i + 1} key ${n}" aria-label="Go to Sphere ${i + 1} key ${n}"></button>`,
              )
              .join("")}</div>`,
        )
        .join("") || '<div class="sphere-row-empty">SPHERES · S TO KEY</div>';
    row
      .querySelectorAll("[data-sphere]")
      .forEach((b) => (b.onclick = () => this.select(b.dataset.sphere)));
    row.querySelectorAll("[data-key]").forEach(
      (b) =>
        (b.onclick = () => {
          this.select(b.dataset.sphereKey);
          this.api.seek(+b.dataset.key);
        }),
    );
    const offset = Math.max(1, p.spheres.length) * 32;
    document
      .querySelector("#timeline-track")
      .style.setProperty("--sphere-offset", `${offset}px`);
    document.querySelector("#timeline-track").style.height =
      `${offset + 133}px`;
    document.querySelector(".timeline-section").style.height =
      `${offset + 288}px`;
    this.status();
    document.querySelector("#ungroup").disabled = !groupAt(p, this.api.frame());
  }
  selected() {
    return this.api.project().spheres.find((s) => s.id === this.active);
  }
  select(id) {
    this.active = id;
    this.sphereMode = true;
    this.update();
    this.api.changed();
  }
  deselect() {
    if (!this.sphereMode) return;
    this.sphereMode = false;
    this.update();
    this.api.preview();
  }
  destroy() {
    document.removeEventListener("pointerdown", this.outside);
  }
  setMode(mode) {
    this.mode = mode;
    if (this.selected()) this.sphereMode = true;
    this.update();
    this.api.changed();
  }
  dimensions(s, p, w, h) {
    const base = 0.3 * Math.min(w, h);
    return [
      p.width * (s.baseWidth ? s.baseWidth * w : base),
      p.height * (s.baseHeight ? s.baseHeight * h : base),
    ];
  }
  point(s, p, x, y, w, h) {
    const [sw, sh] = this.dimensions(s, p, w, h);
    const u = (x + 1) / 2,
      v = (y + 1) / 2;
    const dx =
      (p.tlx || 0) * (1 - u) * (1 - v) +
      (p.trx || 0) * u * (1 - v) +
      (p.blx || 0) * (1 - u) * v +
      (p.brx || 0) * u * v;
    const dy =
      (p.tly || 0) * (1 - u) * (1 - v) +
      (p.try || 0) * u * (1 - v) +
      (p.bly || 0) * (1 - u) * v +
      (p.bry || 0) * u * v;
    return [
      p.x * w + ((x + p.skew * y + dx) * sw) / 2,
      p.y * h + ((y + dy) * sh) / 2,
    ];
  }
  handles(s, p, w, h) {
    const c = [p.x * w, p.y * h],
      r =
        60 *
        (w /
          (document.querySelector("#drawing-canvas").getBoundingClientRect()
            .width || w));
    let handles = [];
    if (this.mode === "move" || this.mode === "scale") {
      handles = [
        { x: c[0] + r, y: c[1], kind: "x" },
        { x: c[0], y: c[1] - r, kind: "y" },
        { x: c[0], y: c[1], kind: "free" },
      ];
    } else if (this.mode === "rotate") {
      handles = [
        { x: c[0], y: c[1] - r, kind: "rx" },
        { x: c[0] + r, y: c[1], kind: "ry" },
        { x: c[0], y: c[1] + r, kind: "rz" },
        { x: c[0], y: c[1], kind: "free" },
      ];
    } else {
      handles = [
        ...["tl", "tr", "bl", "br"].map((corner, i) => {
          const q = this.point(s, p, i % 2 ? 1 : -1, i < 2 ? -1 : 1, w, h);
          return { x: q[0], y: q[1], kind: corner };
        }),
        { x: c[0], y: c[1], kind: "free" },
        {
          ...(() => {
            const q = this.point(s, p, 0, -1, w, h);
            return { x: q[0], y: q[1], kind: "skew" };
          })(),
        },
      ];
    }
    return { c, r, handles };
  }
  contains(s, p, x, y, w, h) {
    const points = Array.from({ length: 64 }, (_, i) =>
      this.point(
        s,
        p,
        Math.cos((i / 64) * Math.PI * 2),
        Math.sin((i / 64) * Math.PI * 2),
        w,
        h,
      ),
    );
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i],
        [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }
  pointerDown(e, canvas) {
    if (!this.api.ready()) return false;
    const rect = canvas.getBoundingClientRect(),
      w = canvas.width,
      h = canvas.height,
      x = ((e.clientX - rect.left) * w) / rect.width,
      y = ((e.clientY - rect.top) * h) / rect.height;
    let s = this.selected(),
      pose = s && spherePose(s, this.api.frame()),
      hit;
    if (this.sphereMode && s?.visible) {
      hit = this.handles(s, pose, w, h).handles.find(
        (a) => Math.hypot(x - a.x, y - a.y) < (14 * w) / rect.width,
      );
    }
    if (!hit && this.sphereMode && s?.visible && this.mode === "rotate") {
      const { c, r } = this.handles(s, pose, w, h);
      const tx = (x - c[0]) / r,
        ty = (y - c[1]) / r;
      const rings = [
        ["rx", 0.45, 1],
        ["ry", 1, 0.45],
        ["rz", 1, 1],
      ]
        .map(([kind, a, b]) => ({
          kind,
          distance: Math.abs(Math.hypot(tx / a, ty / b) - 1) * r,
        }))
        .sort((a, b) => a.distance - b.distance);
      if (rings[0].distance < (12 * w) / rect.width) hit = rings[0];
    }
    if (!hit) {
      s = [...this.api.project().spheres].reverse().find((s) => {
        if (!s.visible) return false;
        const p = spherePose(s, this.api.frame());
        return this.contains(s, p, x, y, w, h);
      });
      if (!s) {
        this.deselect();
        return false;
      }
      this.select(s.id);
      pose = spherePose(s, this.api.frame());
      hit = { kind: "free" };
    }
    this.api.pause();
    this.drag = {
      id: e.pointerId,
      x,
      y,
      pose,
      kind: hit.kind,
      w,
      h,
      mode: this.mode,
    };
    canvas.setPointerCapture(e.pointerId);
    return true;
  }
  pointerMove(e, canvas) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return false;
    const r = canvas.getBoundingClientRect(),
      x = ((e.clientX - r.left) * d.w) / r.width,
      y = ((e.clientY - r.top) * d.h) / r.height,
      dx = x - d.x,
      dy = y - d.y,
      p = { ...d.pose },
      s = this.selected(),
      [sw, sh] = this.dimensions(s, p, d.w, d.h);
    if (d.mode === "move" || (d.mode === "warp" && d.kind === "free")) {
      if (d.kind !== "y") p.x = clamp(p.x + dx / d.w, 0, 1);
      if (d.kind !== "x") p.y = clamp(p.y + dy / d.h, 0, 1);
    } else if (d.mode === "rotate") {
      if (d.kind === "free") {
        p.ry = clamp(p.ry + (dx / r.width) * 360, -180, 180);
        p.rx = clamp(p.rx - (dy / r.height) * 360, -180, 180);
      } else if (d.kind === "rz") {
        const cx = p.x * d.w,
          cy = p.y * d.h;
        p.rz = clamp(
          p.rz +
            ((Math.atan2(y - cy, x - cx) - Math.atan2(d.y - cy, d.x - cx)) *
              180) /
              Math.PI,
          -180,
          180,
        );
      } else
        p[d.kind] = clamp(
          p[d.kind] + (d.kind === "ry" ? dx : -dy) * 0.4,
          -180,
          180,
        );
    } else if (d.mode === "scale") {
      const delta = dx - dy;
      if (d.kind === "free") {
        const f = Math.exp(delta / 150);
        p.width = clamp(p.width * f, 0.02, 5);
        p.height = clamp(p.height * f, 0.02, 5);
      } else if (d.kind === "x")
        p.width = clamp(p.width + (dx / sw) * 2 * p.width, 0.02, 5);
      else p.height = clamp(p.height - (dy / sh) * 2 * p.height, 0.02, 5);
    } else if (d.kind === "skew") p.skew = clamp(p.skew - (dx / sw) * 2, -1, 1);
    else {
      p[d.kind + "x"] = clamp((p[d.kind + "x"] || 0) + (dx / sw) * 2, -2, 2);
      p[d.kind + "y"] = clamp((p[d.kind + "y"] || 0) + (dy / sh) * 2, -2, 2);
    }
    this.edit(p);
    return true;
  }
  pointerUp(e) {
    if (this.drag?.id === e.pointerId) {
      this.drag = null;
      return true;
    }
    return false;
  }
  draw(ctx, w, h) {
    for (const s of this.api.project().spheres) this.drawSphere(ctx, w, h, s);
  }
  drawSphere(ctx, w, h, s) {
    if (!s?.visible) return;
    const p = spherePose(s, this.api.frame()),
      rad = Math.PI / 180;
    const project = (v) => {
      let [x, y, z] = v;
      let a = p.rx * rad;
      [y, z] = [
        y * Math.cos(a) - z * Math.sin(a),
        y * Math.sin(a) + z * Math.cos(a),
      ];
      a = p.ry * rad;
      [x, z] = [
        x * Math.cos(a) + z * Math.sin(a),
        -x * Math.sin(a) + z * Math.cos(a),
      ];
      a = p.rz * rad;
      [x, y] = [
        x * Math.cos(a) - y * Math.sin(a),
        x * Math.sin(a) + y * Math.cos(a),
      ];
      return [...this.point(s, p, x, y, w, h), z];
    };
    ctx.save();
    ctx.lineWidth = (s.lineWidth || 1) * Math.max(1, w / 1000);
    const path = (fn) => {
      let prev = project(fn(0));
      for (let i = 1; i <= 96; i++) {
        const q = project(fn((i / 96) * Math.PI * 2));
        ctx.strokeStyle =
          q[2] >= 0 ? s.color || "#d3fa84" : (s.color || "#d3fa84") + "70";
        ctx.setLineDash(q[2] >= 0 ? [] : [3, 4]);
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
        prev = q;
      }
    };
    for (const lat of [-Math.PI / 3, 0, Math.PI / 3])
      path((t) => [
        Math.cos(t) * Math.cos(lat),
        Math.sin(lat),
        Math.sin(t) * Math.cos(lat),
      ]);
    for (const lng of [0, Math.PI / 3, (Math.PI * 2) / 3])
      path((t) => [
        Math.cos(t) * Math.cos(lng),
        Math.sin(t),
        Math.cos(t) * Math.sin(lng),
      ]);
    ctx.setLineDash([]);
    ctx.strokeStyle = s.color || "#d3fa84";
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const q = this.point(
        s,
        p,
        Math.cos((i / 96) * Math.PI * 2),
        Math.sin((i / 96) * Math.PI * 2),
        w,
        h,
      );
      if (i === 0) ctx.moveTo(...q);
      else ctx.lineTo(...q);
    }
    ctx.stroke();
    for (const [label, v, color] of [
      ["T", [0, -1, 0], "#78d9f0"],
      ["B", [0, 1, 0], "#c29bff"],
      ["L", [-1, 0, 0], "#ff8a87"],
      ["R", [1, 0, 0], "#8de0ad"],
      ["F", [0, 0, 1], "#ffdb75"],
      ["Back", [0, 0, -1], "#b7c4d4"],
    ]) {
      const q = project(v);
      if (q[2] < -0.2) q[1] -= 14;
      else if (q[2] > 0.2) q[1] += 14;
      ctx.globalAlpha = q[2] < 0 ? 0.5 : 1;
      ctx.fillStyle = "#151922";
      ctx.beginPath();
      ctx.arc(q[0], q[1], 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, q[0], q[1]);
    }
    ctx.globalAlpha = 1;
    if (this.sphereMode && s.id === this.active) {
      const { c, r, handles } = this.handles(s, p, w, h);
      ctx.lineWidth =
        (2 * w) /
        (document.querySelector("#drawing-canvas").getBoundingClientRect()
          .width || w);
      ctx.strokeStyle = "#dce5ff";
      ctx.fillStyle = "#dce5ff";
      ctx.setLineDash([]);
      if (this.mode === "rotate") {
        for (const [i, col] of ["#ff7373", "#8fdf8c", "#87b6ff"].entries()) {
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.ellipse(
            c[0],
            c[1],
            i === 0 ? r * 0.45 : r,
            i === 1 ? r * 0.45 : r,
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      } else if (this.mode === "warp") {
        ctx.beginPath();
        handles.slice(0, 4).forEach((v, i) => {
          const q = handles[[0, 1, 3, 2][i]];
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#ff7373";
        ctx.beginPath();
        ctx.moveTo(...c);
        ctx.lineTo(c[0] + r, c[1]);
        ctx.stroke();
        ctx.strokeStyle = "#8fdf8c";
        ctx.beginPath();
        ctx.moveTo(...c);
        ctx.lineTo(c[0], c[1] - r);
        ctx.stroke();
      }
      for (const v of handles) {
        ctx.fillStyle = ["x", "rx"].includes(v.kind)
          ? "#ff7373"
          : ["y", "ry"].includes(v.kind)
            ? "#8fdf8c"
            : v.kind === "rz"
              ? "#87b6ff"
              : "#fff";
        const size =
          (6 * w) /
          (document.querySelector("#drawing-canvas").getBoundingClientRect()
            .width || w);
        if (v.kind === "free") {
          ctx.strokeStyle = "#fff";
          ctx.beginPath();
          ctx.arc(v.x, v.y, size * 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (this.mode === "move" && ["x", "y"].includes(v.kind)) {
          ctx.beginPath();
          if (v.kind === "x") {
            ctx.moveTo(v.x + size, v.y);
            ctx.lineTo(v.x - size, v.y - size);
            ctx.lineTo(v.x - size, v.y + size);
          } else {
            ctx.moveTo(v.x, v.y - size);
            ctx.lineTo(v.x - size, v.y + size);
            ctx.lineTo(v.x + size, v.y + size);
          }
          ctx.closePath();
          ctx.fill();
        } else ctx.fillRect(v.x - size, v.y - size, size * 2, size * 2);
      }
    }
    ctx.restore();
  }
}
