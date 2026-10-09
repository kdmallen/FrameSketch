import { clamp } from './core.js';
export const defaultOnion = () => ({ enabled: false, previous: 2, next: 2, opacity: 0.5, previousColor: '#ff7c78', nextColor: '#79baff' });
export function onionSettings(value = {}) {
  const defaults = defaultOnion();
  const number = (key, min, max) => Number.isFinite(value[key]) ? clamp(value[key], min, max) : defaults[key];
  return { enabled: value.enabled === true, previous: Math.floor(number('previous', 0, 12)), next: Math.floor(number('next', 0, 12)), opacity: number('opacity', 0, 1), previousColor: /^#[\da-f]{6}$/i.test(value.previousColor) ? value.previousColor : defaults.previousColor, nextColor: /^#[\da-f]{6}$/i.test(value.nextColor) ? value.nextColor : defaults.nextColor };
}
export function onionFrames(frame, count, value, mapFrame = n => n) {
  const settings = onionSettings(value), result = [], seen = new Set([mapFrame(frame)]);
  if (!settings.enabled) return result;
  for (const [direction, length, color] of [[-1, settings.previous, settings.previousColor], [1, settings.next, settings.nextColor]]) {
    for (let distance = 1; distance <= length; distance++) {
      const index = frame + direction * distance;
      if (index < 0 || index >= count) continue;
      const mapped = mapFrame(index);
      if (seen.has(mapped)) continue;
      seen.add(mapped);
      result.push({ frame: mapped, distance, opacity: settings.opacity / distance, color });
    }
  }
  return result.sort((a, b) => b.distance - a.distance);
}
