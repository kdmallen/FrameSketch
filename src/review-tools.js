import { uid, clamp } from "./core.js";
export const groupAt = (p, n) =>
  (p.groups || []).find((g) => n >= g.start && n <= g.end);
export const drawingFrame = (p, n) => groupAt(p, n)?.start ?? n;
export const defaultPose = () => ({
  x: 0.5,
  y: 0.5,
  width: 0.24,
  height: 0.38,
  rx: 0,
  ry: 0,
  rz: 0,
  skew: 0,
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
    Object.keys(defaultPose()).map((k) => [k, a[k] + (b[k] - a[k]) * t]),
  );
}
const colors = ["#a9baff", "#ffbc75", "#85dbba", "#e8a4d9", "#bada78"];
export class ReviewTools {
  constructor(api) {
    this.api = api;
    this.groupMode = false;
    this.anchor = null;
    this.sphereMode = false;
    const p = api.project();
    p.groups ||= [];
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
    const panel = document.createElement("section");
    panel.className = "sphere-panel";
    panel.innerHTML =
      '<div class="sphere-title"><strong>Guide sphere</strong><button id="add-sphere" class="secondary">Add sphere</button></div><div id="sphere-controls" hidden><div class="sphere-buttons"><button id="sphere-edit" class="secondary">Edit on canvas</button><button id="sphere-visible" class="secondary">Hide</button><button id="key-sphere" class="primary">Key · S</button></div><p>Drag to move · Shift-drag to rotate. Use handles to scale. S keys every attribute.</p><div id="sphere-fields"></div><div class="sphere-buttons"><button id="delete-key" class="text-button">Delete current key</button><button id="remove-sphere" class="text-button">Remove sphere</button></div><div class="sphere-legend">T top · B bottom · L left · R right · F front · K back</div></div>';
    document.querySelector(".layer-note").replaceWith(panel);
    document.querySelector("#add-sphere").onclick = () => {
      if (!api.ready()) return;
      api.project().sphere = { pose: defaultPose(), keys: {}, visible: true };
      this.sphereMode = true;
      this.update();
      api.changed();
    };
    document.querySelector("#sphere-edit").onclick = () => {
      this.sphereMode = !this.sphereMode;
      this.update();
      api.changed();
    };
    document.querySelector("#sphere-visible").onclick = () => {
      const s = api.project().sphere;
      s.visible = !s.visible;
      this.update();
      api.changed();
    };
    document.querySelector("#key-sphere").onclick = () => this.key();
    document.querySelector("#delete-key").onclick = () => {
      const s = api.project().sphere;
      delete s.keys[api.frame()];
      delete s.draft;
      this.update();
      api.changed();
    };
    document.querySelector("#remove-sphere").onclick = () => {
      if (!confirm("Remove the sphere and all its keys?")) return;
      delete api.project().sphere;
      this.sphereMode = false;
      this.update();
      api.changed();
    };
    const fields = [
      ["x", "X", 0, 1, 0.005],
      ["y", "Y", 0, 1, 0.005],
      ["width", "Width", 0.02, 1, 0.01],
      ["height", "Height", 0.02, 1, 0.01],
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
          const s = api.project().sphere,
            pose = spherePose(s, api.frame());
          pose[input.dataset.pose] = +input.value;
          this.edit(pose);
        }),
    );
    this.update();
  }
  edit(pose) {
    this.api.pause();
    const s = this.api.project().sphere;
    if (!s) return;
    if (!Object.keys(s.keys).length) s.pose = pose;
    else s.draft = { frame: this.api.frame(), pose };
    this.update();
    this.api.changed();
  }
  key() {
    const s = this.api.project().sphere;
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
      s = p.sphere;
    document.querySelector("#sphere-controls").hidden = !s;
    document.querySelector("#add-sphere").hidden = !!s;
    if (s) {
      const pose = spherePose(s, this.api.frame());
      document.querySelectorAll("[data-pose]").forEach((input) => {
        if (document.activeElement !== input)
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
    document.querySelector("#frame-groups").innerHTML = p.groups
      .map(
        (g) =>
          `<div class="frame-group" style="left:${g.start * z}px;width:${(g.end - g.start + 1) * z}px;--group-color:${g.color}" title="Group ${g.start}–${g.end}"><span>${g.start}–${g.end}</span></div>`,
      )
      .join("");
    const row = document.querySelector("#sphere-track");
    row.innerHTML =
      '<span class="sphere-track-label">SPHERE · S TO KEY</span>' +
      (s
        ? Object.keys(s.keys)
            .map(
              (n) =>
                `<button class="sphere-key ${+n === this.api.frame() ? "current" : ""}" style="left:${n * z}px" data-key="${n}" title="Sphere key ${n}" aria-label="Go to sphere key ${n}"></button>`,
            )
            .join("")
        : "");
    row
      .querySelectorAll("[data-key]")
      .forEach((b) => (b.onclick = () => this.api.seek(+b.dataset.key)));
    this.status();
    document.querySelector("#ungroup").disabled = !groupAt(p, this.api.frame());
  }
  pointerDown(e, canvas) {
    const s = this.api.project().sphere;
    if (!this.api.ready() || !this.sphereMode || !s?.visible) return false;
    this.api.pause();
    const rect = canvas.getBoundingClientRect(),
      pose = spherePose(s, this.api.frame());
    const x = (e.clientX - rect.left) / rect.width,
      y = (e.clientY - rect.top) / rect.height;
    const handles = [
      [pose.x + pose.width / 2, pose.y, "width"],
      [
        pose.x + (pose.skew * pose.width) / 2,
        pose.y + pose.height / 2,
        "height",
      ],
    ];
    const hit = handles.find(
      (h) => Math.hypot((x - h[0]) * rect.width, (y - h[1]) * rect.height) < 18,
    );
    this.drag = {
      id: e.pointerId,
      x,
      y,
      pose,
      mode: hit?.[2] || (e.shiftKey ? "rotate" : "move"),
    };
    canvas.setPointerCapture(e.pointerId);
    return true;
  }
  pointerMove(e, canvas) {
    if (!this.drag || this.drag.id !== e.pointerId) return false;
    const r = canvas.getBoundingClientRect(),
      x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height,
      d = this.drag,
      pose = { ...d.pose },
      dx = x - d.x,
      dy = y - d.y;
    if (d.mode === "move") {
      pose.x = clamp(pose.x + dx, 0, 1);
      pose.y = clamp(pose.y + dy, 0, 1);
    } else if (d.mode === "rotate") {
      pose.ry = clamp(pose.ry + dx * 360, -180, 180);
      pose.rx = clamp(pose.rx - dy * 360, -180, 180);
    } else
      pose[d.mode] = clamp(
        pose[d.mode] + (d.mode === "width" ? dx : dy) * 2,
        0.02,
        1,
      );
    this.edit(pose);
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
    const s = this.api.project().sphere;
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
      return [
        (p.x + ((x + p.skew * y) * p.width) / 2) * w,
        (p.y + (y * p.height) / 2) * h,
        z,
      ];
    };
    ctx.save();
    ctx.lineWidth = Math.max(1, w / 1000);
    const path = (fn) => {
      let prev = project(fn(0));
      for (let i = 1; i <= 96; i++) {
        const q = project(fn((i / 96) * Math.PI * 2));
        ctx.strokeStyle = q[2] >= 0 ? "#d3fa84" : "#91a3b080";
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
    ctx.strokeStyle = "#d3fa84";
    ctx.beginPath();
    ctx.save();
    ctx.translate(p.x * w, p.y * h);
    ctx.transform(1, 0, (p.skew * p.width * w) / (p.height * h), 1, 0, 0);
    ctx.ellipse(0, 0, (p.width * w) / 2, (p.height * h) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (const [label, v, color] of [
      ["T", [0, -1, 0], "#78d9f0"],
      ["B", [0, 1, 0], "#c29bff"],
      ["L", [-1, 0, 0], "#ff8a87"],
      ["R", [1, 0, 0], "#8de0ad"],
      ["F", [0, 0, 1], "#ffdb75"],
      ["K", [0, 0, -1], "#b7c4d4"],
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
    if (this.sphereMode) {
      ctx.fillStyle = "#fff";
      for (const [x, y] of [
        [p.x + p.width / 2, p.y],
        [p.x + (p.skew * p.width) / 2, p.y + p.height / 2],
      ]) {
        ctx.fillRect(x * w - 5, y * h - 5, 10, 10);
      }
    }
    ctx.restore();
  }
}
