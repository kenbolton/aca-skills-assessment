// Wire the PWA appinstalled event to a metrics counter. `count` is injected
// for testability and defaults to the real countEvent.
import { countEvent } from './metrics.js';

export function registerInstallMetric(win, count = countEvent) {
  if (!win || typeof win.addEventListener !== 'function') return;
  win.addEventListener('appinstalled', () => count('/install', 'App installed'));
}
