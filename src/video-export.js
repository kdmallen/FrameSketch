import { sourceFrame } from './video-edits.js';

export function recordingFormat(Recorder = globalThis.MediaRecorder) {
  if (!Recorder?.isTypeSupported) return null;
  for (const mime of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.424028,mp4a.40.2', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (Recorder.isTypeSupported(mime)) return { mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}
export function exportSegments(ranges, first, last) {
  if (!ranges?.length) return [{ start: first, end: last, logicalStart: first }];
  let offset = 0;
  return ranges.flatMap(range => {
    const size = range.end - range.start + 1;
    const start = Math.max(first, offset), end = Math.min(last, offset + size - 1);
    offset += size;
    return start <= end ? [{ start: sourceFrame(ranges, start), end: sourceFrame(ranges, end), logicalStart: start }] : [];
  });
}
export function composeExportFrame(ctx, { video, sketches, hideVideo, crop = { x: 0, y: 0, w: 1, h: 1 } }) {
  const { width, height } = ctx.canvas;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, width, height);
  if (!hideVideo) ctx.drawImage(video, video.videoWidth * crop.x, video.videoHeight * crop.y, video.videoWidth * crop.w, video.videoHeight * crop.h, 0, 0, width, height);
  ctx.drawImage(sketches, sketches.width * crop.x, sketches.height * crop.y, sketches.width * crop.w, sketches.height * crop.h, 0, 0, width, height);
}
// Record in real time using the browser's video encoder and a canvas stream.
export function recordVideo({ video, canvas, fps, segments, format, audioTracks = [], render, progress, signal }) {
  if (!canvas.captureStream || !globalThis.MediaRecorder) throw new Error('Video export is unavailable in this browser. Try a current version of Safari or Chrome.');
  if (!segments.length) throw new Error('Choose a nonempty export range.');
  render(segments[0].logicalStart);
  const stream = canvas.captureStream(fps);
  audioTracks.forEach(track => stream.addTrack(track));
  let recorder;
  try { recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 6_000_000 }); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  let animation, segment = 0, stopped = false, failure = null, bytes = 0;
  const chunks = [], total = segments.reduce((count, item) => count + item.end - item.start + 1, 0);
  let completed = 0;
  return new Promise((resolve, reject) => {
    const stop = error => {
      if (stopped) return;
      stopped = true; failure = error || null;
      cancelAnimationFrame(animation); video.pause();
      if (recorder.state !== 'inactive') recorder.stop(); else finish();
    };
    const abort = () => stop(new Error('Export cancelled.'));
    const background = () => { if (document.hidden) stop(new Error('Export stopped because the page went into the background. Keep FrameSketch open while exporting.')); };
    const mediaError = () => stop(new Error('Video playback failed during export.'));
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      document.removeEventListener('visibilitychange', background);
      video.removeEventListener('error', mediaError);
      cancelAnimationFrame(animation);
      stream.getTracks().forEach(track => track.stop());
      if (failure) reject(failure);
      else if (!chunks.length) reject(new Error('The browser did not produce a video file.'));
      else resolve(new Blob(chunks, { type: recorder.mimeType || format.mime }));
    };
    recorder.ondataavailable = event => {
      if (!event.data.size) return;
      chunks.push(event.data); bytes += event.data.size;
      if (bytes > 250 * 1024 * 1024) stop(new Error('Export exceeded 250 MB. Try a shorter range.'));
    };
    recorder.onstop = finish;
    recorder.onerror = () => stop(new Error('The browser could not encode this video.'));
    signal?.addEventListener('abort', abort, { once: true });
    document.addEventListener('visibilitychange', background);
    video.addEventListener('error', mediaError);
    const tick = () => {
      if (stopped) return;
      const piece = segments[segment];
      const source = Math.floor((video.currentTime + 0.00001) * fps);
      if (!video.seeking && (source > piece.end || video.ended)) {
        completed += piece.end - piece.start + 1;
        segment++;
        if (segment === segments.length) { progress(1); stop(); return; }
        recorder.pause();
        video.currentTime = segments[segment].start / fps + 0.0001;
        if (video.ended || video.paused) video.play().catch(mediaError);
      } else if (!video.seeking && video.readyState >= 2) {
        if (recorder.state === 'paused') recorder.resume();
        const relative = Math.max(0, Math.min(piece.end - piece.start, source - piece.start));
        render(piece.logicalStart + relative);
        progress(Math.min(1, (completed + relative + 1) / total));
      }
      animation = requestAnimationFrame(tick);
    };
    try {
      if (signal?.aborted) { abort(); return; }
      recorder.start(1000);
      video.play().catch(error => stop(new Error(`Playback could not start: ${error.message}`)));
      animation = requestAnimationFrame(tick);
    } catch (error) { stop(error); }
  });
}
