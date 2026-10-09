# FrameSketch

A video review and drawing studio, built as a static web app. Development and testing currently focus on Google Chrome on Windows; iPad Safari validation will follow. No account or server is required. Projects, sketches, and uploaded media are stored in IndexedDB in the current browser.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open the address Vite prints. To use your iPad on the same Wi-Fi network, open the Windows computer's LAN address with port 5173. Keep the development server running. For everyday use, deploy to GitHub Pages instead.

## Test in Chrome on Windows

Once the GitHub Pages deployment completes, open https://kdmallen.github.io/FrameSketch/ in Google Chrome. Start with a short MP4 file stored on your PC.

1. Click **New project**, enter a name, upload the MP4, and create the project.
2. Step forward/back one frame and draw a line. Add a layer and try rename, opacity, hide, and lock.
3. Set A and B on two different frames, press play, and toggle looping.
4. Return to Projects and reopen the project. Refresh the page and reopen it again to verify saving.
5. Export a project backup and import it from the dashboard.

If something fails, note what you clicked and what happened. A screenshot of the error will help diagnose it.

## Review a clip

1. Create a project and upload an MP4, WebM, MOV, or M4V video. Set the source frame rate to match your clip; the default is 24 fps.
2. Step with the previous/next frame buttons, keyboard arrows, or scrub the timeline ruler. On touch devices, use the large Scrub video slider to scrub; drag the filmstrip to scroll. Increase timeline zoom to see individual numbered frames and their thumbnails.
3. Draw with a mouse, touch, or Apple Pencil. Two-finger tap on the canvas undoes a drawing stroke. Pressure changes line width on devices that report it. Sketches are specific to the selected frame. Use brush, eraser, color, brush size, undo, and redo.
4. Add layers, click their name to rename, hide/show, lock/unlock, and change opacity. The eraser affects only the active layer.
5. Set A at the starting frame and B at the ending frame. Play to review that inclusive range, with looping on or off. Reversed markers are supported. Reset clears the range. Highlight frames with the flag button and jump between annotated frames from the layers panel.
6. Export a `.framesketch` backup to retain or transfer a project, including uploaded media. Import it from the project dashboard using Import project, not the video upload dialog. The project picker accepts any file type so iPad Files can select `.framesketch` backups; the app validates their contents. Export the current frame as a PNG with visible sketches.

Keyboard: Space play/pause, arrows step, A/B range, M highlight, D brush, F eraser, W move sphere, E rotate sphere, R scale sphere, T free transform/skew, Q or Escape hide gizmo, S key sphere, Ctrl/Command Z undo, Ctrl/Command Shift Z redo.

## Frame groups, clearing, and guide sphere

- **Clear frame**, beside Sketch layers, clears drawings on every layer for the current frame, including hidden and locked layers, after confirmation. In a group it clears the shared drawing. It does not remove the tracked sphere or its keys.
- Turn **Group** on and click a first and last frame in the video timeline. All frames in that inclusive range become a colored group. Dragging scrubs while Group is on and does not change either endpoint; use two separate clicks to group. Turn Group off; clicking any frame in the group opens its first frame. Sketches are shared across the range, including during playback. Existing sketches in a newly grouped range are combined at the first frame. Groups cannot overlap. **Ungroup** restores independent frames with a copy of the shared drawing on each.
- **Guide spheres → Add sphere** creates a round orthographic wireframe guide with Scale X/Y at 1. Each sphere has its own timeline row, independent keys, color, and line thickness. Select a sphere on the canvas, in the dropdown, in its timeline row, or by clicking its attributes. Gizmos disappear when you click elsewhere. The attributes stay in the sidebar. Older spheres keep their previous proportions when migrated.
- **W move** gives X/Y handles plus a free movement center. **E rotate** gives three rotation rings and an inner free rotation area. **R scale** gives separate X/Y handles and uniform scaling from the center. **T free transform** gives independent corner warp handles, a top-center skew handle, and free movement at the center. Rotations change sphere orientation; translation is in the image plane with no depth movement. **Q / Escape** hides controls; **D brush / F eraser** selects drawing tools. Appearance changes are per-sphere; S keys pose and corner warp attributes.
- Colored T/B/L/R/F/Back labels indicate top, bottom, left, right, front, and back. The previous “K” label meant back; it is now written out. Rear guidelines are dashed.
- Press **S** outside an input field or click **Key · S** to key all sphere attributes at the current video frame. The purple sphere track sits above the video ruler; click its diamonds to revisit keys. Attributes interpolate linearly between keys and hold outside the keyed range. Unkeyed edits at a frame remain a draft until S is pressed; Delete current key removes the key at that frame.
- Groups, sphere properties, keys, and drafts autosave and are included in project backups. Sketch groups use the first frame for drawings, while sphere keys use the actual current video frame. Use frame-step buttons to reach interior group frames for keying.

## Crop and slice video

Open **Crop / Slice** in the player header. Crop fields are percentages of the original frame; Apply crop changes the review area and PNG frame exports. Reset crop shows the full image again without modifying the uploaded file or annotation coordinates.

**Slice at current frame** splits the active piece before that frame. Each slice can be saved as a new project with its media, crop, annotations and sphere keys, or deleted from the current project. Remaining slices form a continuous review timeline and playback skips deleted footage. These are saved project edits, not newly encoded MP4 files. The uploaded file remains intact. **Restore before slicing** restores the timeline and annotations saved before the first cut; it replaces later annotation edits after confirmation. Slice projects have their own independent original timeline. Frame rate is locked after slicing to keep source frame mapping consistent.

## Media and storage limitations

- New projects use uploaded video files only. Link import and GIF upload are deferred. Previously saved projects and backups can still be opened without deleting their data.
- Safari codec support varies. H.264 video with AAC audio in an MP4 container is the safest iPad format. An unsupported file gives a recoverable attach-media screen. DRM and live streams are not supported.
- Video frame stepping uses timestamps and the manually selected source fps. Variable-frame-rate video is sampled at that rate, not decoded into original frame indices. Convert variable-frame-rate footage to constant frame rate when original-frame accuracy is essential.
- Waveforms are decoded from the video's audio and displayed inside the timeline. No separate audio layer is created. Silent/unsupported audio produce an explicit unavailable label, not a fabricated waveform. Large audio files (over 120 MB) skip waveform decoding to limit memory use.
- Saved projects belong to this browser and this site's origin. They do not automatically sync across devices. Clearing Safari website data, browser eviction, or changing the hosting origin can remove local projects. Export backups. Base64 project backups increase media size by about one third and can require substantial memory for large clips.
- Uploaded files stay on your device.
- The app includes a home-screen manifest, but is not an offline service-worker app. It needs the hosting site to load. iPad: open the hosted site in Safari, Share → Add to Home Screen.

## Deploy to GitHub Pages

The repository includes `.github/workflows/pages.yml` and uses relative asset paths, so it works under `/FrameSketch/`.

1. Push the application files to the repository's `main` branch.
2. In GitHub **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Run the **Deploy FrameSketch to GitHub Pages** workflow or push to `main`.
4. Open the URL shown by the deployment on iPad Safari.

The deployment workflow runs when changes are pushed to `main`. Check the repository’s Actions tab for its outcome.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use the system Chromium if `/usr/bin/chromium` exists, otherwise Playwright's installed Chromium. `BROWSER_PATH` can override the executable. Set `TEST_WEBKIT=1` and install WebKit to include Safari-engine tests:

```sh
npx playwright install webkit
TEST_WEBKIT=1 npm run test:e2e
```

The suite checks video uploads, upload validation, frame stepping, drawing/erasing and layer behavior, range playback, persistence, backup import/export, and iPad-sized layouts. Chromium tests and production build were run in the cloud workspace. A WebKit download was denied by the environment network policy; physical iPad Safari and Apple Pencil behavior still need device validation.
