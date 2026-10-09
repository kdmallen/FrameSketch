import { test, expect } from "@playwright/test";
const sample = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: /explore a sample/ }).click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator("#video")).toHaveJSProperty("readyState", 4);
};
async function draw(page) {
  const r = await page.locator("#drawing-canvas").boundingBox();
  await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.6, {
    steps: 15,
  });
  await page.mouse.up();
}
test("frame review, drawing layers, range playback and persistent backups", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#frame-position")).toHaveText("Frame 1 / 191");
  await draw(page);
  await expect(page.locator("#annotated-count")).toHaveText("1");
  await page.locator("#undo").click();
  await expect(page.locator("#annotated-count")).toHaveText("0");
  await page.locator("#redo").click();
  await expect(page.locator("#annotated-count")).toHaveText("1");
  await page.locator("#add-layer").click();
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.locator("#rename-layer").click();
  await page.locator("#rename-input").fill("Timing notes");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator("#selection-status")).toHaveText("Timing notes");
  await page.locator("[data-lock]").first().click();
  await draw(page);
  await expect(page.locator("#toast")).toContainText("Unlock");
  await page.locator("[data-lock]").first().click();
  await page.locator("#mark-a").click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.locator("#mark-b").click();
  await expect(page.locator("#a-label")).toHaveText("1");
  await expect(page.locator("#b-label")).toHaveText("3");
  await page.locator("#loop").click();
  await page.locator("#play").click();
  await expect(page.locator("#frame-position")).toHaveText("Frame 3 / 191");
  await page.locator("#highlight").click();
  await expect(page.locator(".highlight-pin")).toHaveCount(1);
  await page.locator("#timeline-zoom").fill("24");
  await page.locator("#timeline-zoom").dispatchEvent("input");
  await expect(page.locator(".filmstrip")).toHaveClass(/individual-frames/);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const backup = await downloadPromise;
  await backup.saveAs("/tmp/framesketch-test.framesketch");
  await page.locator("#back-home").click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.locator("[data-open]").first().click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await expect(page.locator("#annotated-count")).toHaveText("1");
  await expect(page.locator("#b-label")).toHaveText("3");
  await page.locator("#back-home").click();
  await page
    .locator("#import-file")
    .setInputFiles("/tmp/framesketch-test.framesketch");
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.locator("#back-home").click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  expect(errors).toEqual([]);
});
test("upload workflow and frame export", async ({ page }) => {
  await page.goto("/");
  await page.locator("#new-project").click();
  await page.locator("#project-name").fill("Uploaded clip");
  await page.locator("#media-file").setInputFiles("public/sample.mp4");
  await page.locator("#create-submit").click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await draw(page);
  const d = page.waitForEvent("download");
  await page.locator("#export-frame").click();
  expect((await d).suggestedFilename()).toContain("frame-0.png");
});
test("new projects offer video uploads only and reject GIF files", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#new-project").click();
  await page.locator("#project-name").fill("Upload review");
  await expect(page.locator("#tab-link")).toHaveCount(0);
  await expect(page.locator("#media-link")).toHaveCount(0);
  await page.locator("#create-submit").click();
  await expect(page.locator("#create-error")).toHaveText(
    "Choose a video first.",
  );
  await page.locator("#media-file").setInputFiles("tests/fixtures/motion.gif");
  await page.locator("#create-submit").click();
  await expect(page.locator("#create-error")).toContainText(
    "Choose a video file",
  );
  await page.locator("#media-file").setInputFiles("public/sample.mp4");
  await page.locator("#create-submit").click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
});
test("iPad landscape and portrait layouts remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await sample(page);
  await draw(page);
  await expect(page.locator("#annotated-count")).toHaveText("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/framesketch-ipad-landscape.png" });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#next").click();
  await expect(page.locator("#frame-position")).toHaveText("Frame 1 / 191");
  await page.screenshot({ path: "/tmp/framesketch-ipad-portrait.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/framesketch-mobile.png" });
});
test("uploaded video loops within the A–B range", async ({ page }) => {
  await page.goto("/");
  await page.locator("#new-project").click();
  await page.locator("#project-name").fill("Uploaded clip");
  await page.locator("#media-file").setInputFiles("public/sample.mp4");
  await page.locator("#create-submit").click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await page.keyboard.press("ArrowRight");
  await page.locator("#mark-a").click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.locator("#mark-b").click();
  await page.locator("#play").click();
  await page.waitForTimeout(650);
  const n = await page.locator("#frame-position").textContent();
  expect(n).toMatch(/^Frame [123] \/ 191$/);
  await page.locator("#play").click();
});
test("eraser, hidden layers and opacity affect only their intended drawing", async ({
  page,
}) => {
  await sample(page);
  await draw(page);
  const alpha = () =>
    page.locator("#drawing-canvas").evaluate((c) =>
      c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height)
        .data.reduce((sum, n, i) => sum + (i % 4 === 3 ? n : 0), 0),
    );
  const before = await alpha();
  expect(before).toBeGreaterThan(0);
  await page.locator("#opacity").fill("0.5");
  await page.locator("#opacity").dispatchEvent("input");
  expect(await alpha()).toBeLessThan(before * 0.6);
  await page.locator("[data-visible]").click();
  expect(await alpha()).toBe(0);
  await page.locator("[data-visible]").click();
  await page.locator("#opacity").fill("1");
  await page.locator("#opacity").dispatchEvent("input");
  await page.locator("#eraser").click();
  await page.locator("#brush-size").fill("25");
  await page.locator("#brush-size").dispatchEvent("input");
  await draw(page);
  expect(await alpha()).toBeLessThan(before * 0.2);
  await page.locator("#undo").click();
  expect(await alpha()).toBe(before);
});
test("Apple Pencil style pointer input draws and timeline thumbnails render real frames", async ({
  page,
}) => {
  await sample(page);
  await page.locator("#drawing-canvas").evaluate((c) => {
    const r = c.getBoundingClientRect();
    for (const [type, x, y, pressure] of [
      ["pointerdown", 0.2, 0.2, 0.2],
      ["pointermove", 0.4, 0.4, 0.8],
      ["pointerup", 0.4, 0.4, 0],
    ])
      c.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "pen",
          clientX: r.x + r.width * x,
          clientY: r.y + r.height * y,
          pressure,
          button: 0,
        }),
      );
  });
  await expect(page.locator("#annotated-count")).toHaveText("1");
  await page.locator("#timeline-zoom").fill("24");
  await page.locator("#timeline-zoom").dispatchEvent("input");
  await expect(page.locator('[data-thumb="1"]')).toHaveCSS(
    "background-image",
    /data:image\/jpeg/,
  );
});
test("groups share sketches, clear all layers and survive reopening", async ({
  page,
}) => {
  await sample(page);
  await page.locator("#timeline-zoom").fill("24");
  await page.locator("#timeline-zoom").dispatchEvent("input");
  const clickFrame = async (n) => {
    const r = await page.locator("#ruler").boundingBox();
    await page.mouse.click(r.x + n * 24 + 12, r.y + 12);
  };
  await page.locator("#group-mode").click();
  await clickFrame(3);
  await clickFrame(5);
  await expect(page.locator(".frame-group")).toHaveCount(1);
  await page.locator("#group-mode").click();
  await clickFrame(4);
  await expect(page.locator("#frame-position")).toHaveText("Frame 3 / 191");
  await draw(page);
  const image = await page
    .locator("#drawing-canvas")
    .evaluate((c) => c.toDataURL());
  await page.keyboard.press("ArrowRight");
  expect(
    await page.locator("#drawing-canvas").evaluate((c) => c.toDataURL()),
  ).toBe(image);
  await page.locator("#add-layer").click();
  await draw(page);
  page.once("dialog", (d) => d.accept());
  await page.locator("#clear-frame").click();
  await expect(page.locator("#annotated-count")).toHaveText("0");
  await page.locator("#back-home").click();
  await page.locator("[data-open]").first().click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator(".frame-group")).toHaveCount(1);
});
test("sphere pose keys interpolate, restore and export with projects", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  await page.locator("#add-sphere").click();
  await page.locator('[data-pose="x"]').fill("0.2");
  await page.locator('[data-pose="x"]').dispatchEvent("input");
  await page.locator("#key-sphere").click();
  await page.locator("#next").click();
  await page.locator("#next").click();
  await page.locator('[data-pose="x"]').fill("0.8");
  await page.locator('[data-pose="x"]').dispatchEvent("input");
  await page.locator('[data-pose="ry"]').fill("90");
  await page.locator('[data-pose="ry"]').dispatchEvent("input");
  await page.locator('[data-pose="ry"]').blur();
  await page.keyboard.press("s");
  await expect(page.locator(".sphere-key")).toHaveCount(2);
  await page.locator("#prev").click();
  await expect(page.locator('[data-pose="x"]')).toHaveValue("0.5");
  await expect(page.locator('[data-pose="ry"]')).toHaveValue("45");
  await page.locator("#back-home").click();
  await page.locator("[data-open]").first().click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator(".sphere-key")).toHaveCount(2);
  await expect(page.locator('[data-pose="x"]')).toHaveValue("0.5");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/framesketch-sphere.png" });
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  await (await download).saveAs("/tmp/framesketch-sphere.framesketch");
  await page.locator("#back-home").click();
  await page
    .locator("#import-file")
    .setInputFiles("/tmp/framesketch-sphere.framesketch");
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator(".sphere-key")).toHaveCount(2);
  await expect(page.locator('[data-pose="ry"]')).toHaveValue("45");
});
test("scrubbing and grouping never select timeline text", async ({ page }) => {
  await sample(page);
  const ruler = await page.locator("#ruler").boundingBox();
  await page.mouse.move(ruler.x + 5, ruler.y + 12);
  await page.mouse.down();
  await page.mouse.move(ruler.x + 150, ruler.y + 12, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator("#frame-position")).toHaveText("Frame 25 / 191");
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
  await page.locator("#group-mode").click();
  await page.mouse.move(ruler.x + 18, ruler.y + 12);
  await page.mouse.down();
  await page.mouse.move(ruler.x + 90, ruler.y + 12, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator("#frame-position")).toHaveText("Frame 15 / 191");
  await expect(page.locator(".frame-group")).toHaveCount(0);
  await page.mouse.click(ruler.x + 18, ruler.y + 12);
  await page.mouse.click(ruler.x + 42, ruler.y + 12);
  await expect(page.locator(".frame-group")).toHaveCount(1);
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
});
test("multiple round spheres have separate keys, styles and contextual gizmos", async ({
  page,
}) => {
  await sample(page);
  await page.locator("#add-sphere").click();
  await expect(page.locator('[data-pose="width"]')).toHaveValue("1");
  await expect(page.locator('[data-pose="height"]')).toHaveValue("1");
  await page.locator("#key-sphere").click();
  await page.locator("#add-sphere").click();
  await expect(page.locator(".sphere-row")).toHaveCount(2);
  await page.locator('[data-pose="x"]').fill("0.75");
  await page.locator('[data-pose="x"]').dispatchEvent("input");
  await page.locator("#sphere-line").fill("4");
  await page.locator("#sphere-line").dispatchEvent("input");
  await page.locator("#sphere-color").fill("#ff0000");
  await page.locator("#sphere-color").dispatchEvent("input");
  await page.locator("#key-sphere").click();
  await expect(
    page.locator(".sphere-row").nth(0).locator(".sphere-key"),
  ).toHaveCount(1);
  await expect(
    page.locator(".sphere-row").nth(1).locator(".sphere-key"),
  ).toHaveCount(1);
  await page.locator("#sphere-color").blur();
  await page.keyboard.press("r");
  await expect(page.locator('[data-mode="scale"]')).toHaveClass(/selected/);
  await page.locator("#media-name").click();
  await expect(page.locator('[data-mode="scale"]')).not.toHaveClass(/selected/);
  await page.locator('[data-pose="width"]').click();
  await expect(page.locator('[data-mode="scale"]')).toHaveClass(/selected/);
  await page.locator("#sphere-list").selectOption({ index: 0 });
  await expect(page.locator("#sphere-line")).toHaveValue("1");
  await expect(page.locator('[data-pose="x"]')).toHaveValue("0.5");
});
test("crop and slices create independent projects and delete playback pieces", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  await page.locator("#next").click();
  await page.locator("#next").click();
  await page.locator("#video-edits").click();
  await page.locator("#split-video").click();
  await expect(page.locator(".slice-row")).toHaveCount(2);
  await page.locator('[data-new-slice="1"]').click();
  await expect(page.locator("#toast")).toContainText("Slice saved");
  page.once("dialog", (d) => d.accept());
  await page.locator('[data-delete-slice="0"]').click();
  await expect(page.locator(".slice-row")).toHaveCount(1);
  await page.locator("#crop-x").fill("25");
  await page.locator("#crop-w").fill("50");
  await page.locator("#apply-crop").click();
  await expect(page.locator("#frame-position")).toHaveText("Frame 0 / 189");
  await expect
    .poll(() => page.locator("#video").evaluate((v) => v.currentTime))
    .toBeGreaterThan(0.08);
  const r = await page.locator("#media-stage").boundingBox();
  expect(r.width / r.height).toBeCloseTo(480 / 540, 1);
  const backup = page.waitForEvent("download");
  await page.locator("#export").click();
  await (await backup).saveAs("/tmp/framesketch-cut.framesketch");
  await page.locator("#back-home").click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: /Open Motion study.*Slice 2/ })
    .click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator("#frame-position")).toHaveText("Frame 0 / 189");
  await page.locator("#next").click();
  await expect
    .poll(() => page.locator("#video").evaluate((v) => v.currentTime))
    .toBeGreaterThan(0.12);
  await page.locator("#back-home").click();
  await page
    .locator("#import-file")
    .setInputFiles("/tmp/framesketch-cut.framesketch");
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator("#frame-position")).toHaveText("Frame 0 / 189");
  await page.locator("#video-edits").click();
  page.once("dialog", (d) => d.accept());
  await page.locator("#restore-video").click();
  await expect(page.locator("#frame-position")).toHaveText("Frame 2 / 191");
  expect(errors).toEqual([]);
});
test("gizmo free move, uniform scaling and corner warping change the selected sphere", async ({
  page,
}) => {
  await sample(page);
  await page.locator("#add-sphere").click();
  const r = await page.locator("#drawing-canvas").boundingBox();
  const drag = async (x, y, dx, dy) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };
  await drag(r.x + r.width / 2, r.y + r.height / 2, 30, 0);
  await expect
    .poll(async () =>
      Number(await page.locator('[data-pose="x"]').inputValue()),
    )
    .toBeGreaterThan(0.5);
  await page.keyboard.press("r");
  const x = Number(await page.locator('[data-pose="x"]').inputValue());
  await drag(r.x + r.width * x, r.y + r.height / 2, 20, -10);
  await expect
    .poll(async () =>
      Number(await page.locator('[data-pose="width"]').inputValue()),
    )
    .toBeGreaterThan(1);
  await page.keyboard.press("t");
  const width = Number(await page.locator('[data-pose="width"]').inputValue()),
    height = Number(await page.locator('[data-pose="height"]').inputValue()),
    base = 0.3 * Math.min(r.width, r.height);
  await drag(
    r.x + r.width * x - (base * width) / 2,
    r.y + r.height / 2 - (base * height) / 2,
    -15,
    -10,
  );
  await page.keyboard.press("s");
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = await download;
  await file.saveAs("/tmp/framesketch-warp.framesketch");
  const data = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile("/tmp/framesketch-warp.framesketch", "utf8"),
  );
  expect(data.project.spheres[0].keys[0].tlx).toBeLessThan(0);
  expect(data.project.spheres[0].keys[0].tly).toBeLessThan(0);
});

test("deleting a sphere key preserves other spheres and persists", async ({ page }) => {
  await sample(page);
  await page.locator("#add-sphere").click();
  await page.locator("#key-sphere").click();
  await page.locator("#add-sphere").click();
  await page.locator("#key-sphere").click();
  await expect(page.locator(".sphere-key")).toHaveCount(2);
  await page.locator(".sphere-key").first().click();
  await expect(page.locator("#delete-key")).toBeEnabled();
  await page.locator("#delete-key").click();
  await expect(page.locator(".sphere-key")).toHaveCount(1);
  await expect(page.locator("#delete-key")).toBeDisabled();
  await expect(page.locator("#sphere-list option")).toHaveCount(2);
  await page.locator("#back-home").click();
  await page.locator("[data-open]").first().click();
  await expect(page.locator("#viewer-state")).toHaveText("READY TO REVIEW");
  await expect(page.locator(".sphere-key")).toHaveCount(1);
  await expect(page.locator("#sphere-list option")).toHaveCount(2);
});

test("touch controls scrub, change sphere mode/color, and two-finger undo", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  await sample(page);
  await draw(page);
  await expect(page.locator("#annotated-count")).toHaveText("1");
  const bounds = await page.locator("#drawing-canvas").boundingBox();
  const session = await context.newCDPSession(page);
  const touches = [0, 1].map((id) => ({ id, x: Math.round(bounds.x + bounds.width * (0.35 + id * 0.2)), y: Math.round(bounds.y + bounds.height * 0.5) }));
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("#annotated-count")).toHaveText("0");
  await page.locator("#add-sphere").tap();
  for (const mode of ["rotate", "move", "scale", "warp"]) {
    const button = page.locator(`[data-mode="${mode}"]`);
    // Safari may omit the compatibility click; pointer-up must be sufficient.
    await button.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 77, clientX: 0, clientY: 0 });
    await button.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 77, clientX: 0, clientY: 0 });
    await expect(button).toHaveClass(/selected/);
  }
  await page.locator('[data-mode="rotate"]').tap();
  await expect(page.locator('[data-mode="rotate"]')).toHaveClass(/selected/);
  await page.locator('[data-sphere-color="#ff7c78"]').tap();
  await expect(page.locator("#sphere-color")).toHaveValue("#ff7c78");
  await page.locator("#key-sphere").tap();
  await expect(page.locator(".sphere-key")).toHaveCount(1);
  const slider = await page.locator("#touch-scrub").boundingBox();
  await page.touchscreen.tap(slider.x + slider.width * 0.6, slider.y + slider.height / 2);
  await expect.poll(async () => Number(await page.locator("#touch-scrub").inputValue())).toBeGreaterThan(0);
  await page.locator("#back-home").tap();
  await expect(page.locator("#import-file")).not.toHaveAttribute("accept");
  await context.close();
});

test("continuous touch scrub leaves native slider untouched and saves after release", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  await sample(page);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.scrubWrites = 0;
    const input = document.querySelector('#touch-scrub');
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(input, 'value', { get() { return descriptor.get.call(this); }, set(value) { window.scrubWrites++; descriptor.set.call(this, value); } });
  });
  const session = await context.newCDPSession(page);
  const r = await page.locator('#touch-scrub').boundingBox();
  const point = fraction => [{ id: 0, x: Math.round(r.x + r.width * fraction), y: Math.round(r.y + r.height / 2) }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0.08) });
  for (const fraction of [0.25, 0.5, 0.8]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(fraction) });
    await page.waitForTimeout(400);
  }
  expect(await page.evaluate(() => window.scrubWrites)).toBe(0);
  const finalFrame = Number(await page.locator('#touch-scrub').inputValue());
  expect(finalFrame).toBeGreaterThan(100);
  await expect(page.locator('#frame-position')).toHaveText(`Frame ${finalFrame} / 191`);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  await page.locator('#back-home').tap();
  await page.locator('[data-open]').first().tap();
  await expect(page.locator('#viewer-state')).toHaveText('READY TO REVIEW');
  await expect(page.locator('#frame-position')).toHaveText(`Frame ${finalFrame} / 191`);
  await context.close();
});

test("touch playhead drag keeps scrubbing instead of scrolling or cancelling", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  await sample(page);
  await page.locator('#timeline-zoom').fill('8');
  await page.locator('#timeline-zoom').dispatchEvent('input');
  await page.locator('#touch-scrub').fill('30');
  await page.locator('#touch-scrub').dispatchEvent('input');
  await page.evaluate(() => {
    window.timelineCancels = 0;
    document.querySelector('#timeline-track').addEventListener('pointercancel', () => window.timelineCancels++);
  });
  const r = await page.locator('#playhead').boundingBox();
  const session = await context.newCDPSession(page);
  const point = dx => [{ id: 0, x: Math.round(r.x + dx), y: Math.round(r.y + r.height / 2) }];
  const scroll = await page.locator('#timeline-scroll').evaluate(el => el.scrollLeft);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
  for (const dx of [40, 80, 120]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(dx) });
    await page.waitForTimeout(400);
    await expect(page.locator('#frame-position')).toHaveText(`Frame ${30 + dx / 8} / 191`);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.timelineCancels)).toBe(0);
  expect(await page.locator('#timeline-scroll').evaluate(el => el.scrollLeft)).toBe(scroll);
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  await context.close();
});

test("touch pause stops playback once and does not resume from a compatibility click", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  await sample(page);
  await page.locator('#play').tap();
  await expect(page.locator('#video')).toHaveJSProperty('paused', false);
  await page.waitForTimeout(350);
  // Test a completed touch without relying on Safari's compatibility click.
  await page.locator('#play').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 99, clientX: 0, clientY: 0 });
  await page.locator('#play').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 99, clientX: 0, clientY: 0 });
  await page.locator('#play').dispatchEvent('click');
  await expect(page.locator('#video')).toHaveJSProperty('paused', true);
  const time = await page.locator('#video').evaluate(video => video.currentTime);
  await page.waitForTimeout(500);
  expect(await page.locator('#video').evaluate(video => video.currentTime)).toBe(time);
  await page.locator('#play').tap();
  await expect(page.locator('#video')).toHaveJSProperty('paused', false);
  await page.locator('#play').tap();
  await expect(page.locator('#video')).toHaveJSProperty('paused', true);
  await context.close();
});
