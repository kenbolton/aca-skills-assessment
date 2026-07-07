// Reference tables for the Setup "observed conditions" dropdowns. Each stored
// value is a human-readable string kept in session.conditions[key] as before,
// so summaries/exports/archive are unchanged. Wind uses the Beaufort scale
// (knots) with the ACA descriptive copy shown as a help line (spec).

export const BEAUFORT = [
  { value: 'F0 Calm (<1 kn)',            spec: 'Smoke rises vertically' },
  { value: 'F1 Light Air (1–3 kn)',      spec: 'Direction of wind shown by smoke drift but not by wind vanes' },
  { value: 'F2 Light Breeze (4–6 kn)',   spec: 'Wind felt on face; leaves rustle; wind vanes moved by wind' },
  { value: 'F3 Gentle Breeze (7–10 kn)', spec: 'Leaves and small twigs in constant motion; wind extends a light flag' },
  { value: 'F4 Moderate (11–16 kn)',     spec: 'Raises dust, loose paper; small branches moved' },
  { value: 'F5 Fresh (17–21 kn)',        spec: 'Small trees begin to sway; crested wavelets form on inland waters' },
  { value: 'F6 Strong (22–27 kn)',       spec: 'Large branches in motion; whistling heard in wires; umbrellas used with difficulty' },
  { value: 'F7 Near Gale (28–33 kn)',    spec: 'Whole trees in motion; inconvenience felt walking against the wind' },
  { value: 'F8 Gale (34–40 kn)',         spec: 'Twigs break off trees; wind generally impedes progress' },
  { value: 'F9 Strong Gale (41–47 kn)',  spec: 'Slight structural damage occurs; sheds and roofs suffer minor damage' },
  { value: 'F10 Storm (48–55 kn)',       spec: 'Trees uprooted; considerable structural damage' },
  { value: 'F11 Violent Storm (56–63 kn)', spec: 'Widespread damage; large branches snapped off; road signs toppled' },
  { value: 'F12 Hurricane (64+ kn)',     spec: 'Devastation; large trees and branches downed; significant structural damage' },
];

export const CURRENT_LEVELS = [
  'Slack (<0.5 kn)', '0.5–1 kn', '1–2 kn', '2–3 kn', '3–4 kn', '4+ kn',
];

export const WAVE_HEIGHTS = [
  'Flat', '<1 ft (<0.3 m)', '1–2 ft (0.3–0.6 m)', '2–3 ft (0.6–0.9 m)',
  '3–4 ft (0.9–1.2 m)', '4–6 ft (1.2–1.8 m)', '6+ ft (1.8+ m)',
];

// The help-line copy for a stored wind value, or '' if it isn't a Beaufort
// value (e.g. an older free-text entry) or nothing is selected.
export function beaufortSpec(value) {
  return (BEAUFORT.find(b => b.value === value) || {}).spec || '';
}
