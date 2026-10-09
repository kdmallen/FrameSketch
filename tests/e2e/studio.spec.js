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
