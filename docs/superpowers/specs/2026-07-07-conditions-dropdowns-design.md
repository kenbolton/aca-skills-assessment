# Conditions Dropdowns — Design Spec

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Replace the four free-text "observed conditions" fields on the Setup
screen (wind, waves, surf, current) with dropdowns backed by reference tables:
wind on the Beaufort scale (knots + descriptive copy), current in knots, waves
and surf in feet + meters.

## Goal

Make conditions faster and more consistent to record on a phone from a kayak,
and give wind a proper Beaufort reference (with the ACA descriptive copy) so an
assessor can match what they observe. Keep everything downstream unchanged.

## Context (current state)

- `src/screens/Setup.jsx` renders four `<input type="text">` fields from
  `CONDITION_FIELDS` (wind/waves/surf/current), each a free string like
  `"12 kn"`, stored via `setConditions`.
- `src/lib/session.js`: `createSession` runs `normConditions` (keeps present,
  trimmed string values under `CONDITION_KEYS`); `conditionsSummary(session)`
  renders `"{Label} {value}"` joined by `·` for the fields that have a value.
- Conditions flow unchanged into the Review screen, PDF, CSV, and the Pi
  archive. Existing/archived sessions hold free-text strings.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Stored value | A **descriptive string** in the existing `conditions[key]` field (no data-model change; backward-compatible with free-text/archived sessions) |
| Wind | **Beaufort** scale, **knots only**, with the file's Description + Specification as descriptive copy |
| Beaufort source | `~/Documents/ACA/2024/beaufort_scale.csv` (descriptions + specifications), knot ranges = canonical WMO Beaufort |
| Beaufort Specification | shown as a **help line under the wind field** when a force is selected (options stay scannable) |
| Current | **knots only** buckets |
| Waves & Surf | **feet + meters** buckets (shared height table) |
| Optional | each select has a blank first option ("— not recorded"); empty = not recorded (unchanged optionality) |
| Exports/summary/Pi | unchanged (they render the stored string) |

## Reference data — `src/data/conditions.js` (new)

### Beaufort (wind) — knots only, with specification

Each entry's `value` is BOTH the `<option>` value and its display text (no
label/value divergence); `spec` is the help-line copy. Descriptions and
specifications are transcribed from the CSV (mangled MPH column decoded to the
canonical knot ranges).

```js
export const BEAUFORT = [
  { value: 'F0 Calm (<1 kn)',           spec: 'Smoke rises vertically' },
  { value: 'F1 Light Air (1–3 kn)',     spec: 'Direction of wind shown by smoke drift but not by wind vanes' },
  { value: 'F2 Light Breeze (4–6 kn)',  spec: 'Wind felt on face; leaves rustle; wind vanes moved by wind' },
  { value: 'F3 Gentle Breeze (7–10 kn)',spec: 'Leaves and small twigs in constant motion; wind extends a light flag' },
  { value: 'F4 Moderate (11–16 kn)',    spec: 'Raises dust, loose paper; small branches moved' },
  { value: 'F5 Fresh (17–21 kn)',       spec: 'Small trees begin to sway; crested wavelets form on inland waters' },
  { value: 'F6 Strong (22–27 kn)',      spec: 'Large branches in motion; whistling heard in wires; umbrellas used with difficulty' },
  { value: 'F7 Near Gale (28–33 kn)',   spec: 'Whole trees in motion; inconvenience felt walking against the wind' },
  { value: 'F8 Gale (34–40 kn)',        spec: 'Twigs break off trees; wind generally impedes progress' },
  { value: 'F9 Strong Gale (41–47 kn)', spec: 'Slight structural damage occurs; sheds and roofs suffer minor damage' },
  { value: 'F10 Storm (48–55 kn)',      spec: 'Trees uprooted; considerable structural damage' },
  { value: 'F11 Violent Storm (56–63 kn)', spec: 'Widespread damage; large branches snapped off; road signs toppled' },
  { value: 'F12 Hurricane (64+ kn)',    spec: 'Devastation; large trees and branches downed; significant structural damage' },
];
```

### Current — knots only

```js
export const CURRENT_LEVELS = [
  'Slack (<0.5 kn)', '0.5–1 kn', '1–2 kn', '2–3 kn', '3–4 kn', '4+ kn',
];
```

### Wave / surf height — feet + meters (shared)

```js
export const WAVE_HEIGHTS = [
  'Flat', '<1 ft (<0.3 m)', '1–2 ft (0.3–0.6 m)', '2–3 ft (0.6–0.9 m)',
  '3–4 ft (0.9–1.2 m)', '4–6 ft (1.2–1.8 m)', '6+ ft (1.8+ m)',
];
```

## Architecture

### 1. `src/data/conditions.js` (new)

Exports `BEAUFORT`, `CURRENT_LEVELS`, `WAVE_HEIGHTS` (above) and a small helper
to look up a Beaufort spec by stored value (for the help line):

```js
export function beaufortSpec(value) {
  return (BEAUFORT.find(b => b.value === value) || {}).spec || '';
}
```

### 2. `src/screens/Setup.jsx`

Replace the `CONDITION_FIELDS` text inputs with `<select>`s. A config drives the
four fields:

```js
const CONDITION_SELECTS = [
  { key: 'wind',    label: 'Wind',    options: BEAUFORT.map(b => b.value), spec: true },
  { key: 'waves',   label: 'Waves',   options: WAVE_HEIGHTS },
  { key: 'surf',    label: 'Surf',    options: WAVE_HEIGHTS },
  { key: 'current', label: 'Current', options: CURRENT_LEVELS },
];
```

Rendering (inside the existing `conditions-fieldset`), preserving the
`conditions` state shape (`{ wind, waves, surf, current }`, strings):

- Each field: a `<label>` with `<span>{label}</span>` and a `<select>` whose
  first option is `<option value="">— not recorded</option>`, then one
  `<option>` per `options` entry (value === text). `onChange` sets
  `conditions[key]` to the selected value (same `setConditions` updater).
- Wind only: below its `<select>`, when `conditions.wind` is set, render
  `<p class="condition-spec">{beaufortSpec(conditions.wind)}</p>`.

No change to `handleStart`/`createSession` wiring — `conditions` is still a
`{key: string}` object.

### 3. Downstream — unchanged

`normConditions`, `conditionsSummary`, PDF, CSV, Pi archive, and the Review
venue line all consume the stored strings exactly as before.

### 4. `src/styles.css`

Add a small `.condition-spec` style (muted, small) for the wind help line.

## Data flow

Setup select → `conditions[key] = value` (a descriptive string) → `createSession`
→ `normConditions` keeps it → `conditionsSummary` renders `"{Label} {value}"` →
Review / PDF / CSV / Pi archive. Wind's `spec` is presentation-only (help line),
never stored.

## Error handling / edge cases

- Blank selection (`""`) → field omitted from the session (unchanged optionality).
- `beaufortSpec` on an unknown/blank value → returns `''` → help line not shown.
- **Backward compatibility:** existing free-text/archived sessions render
  unchanged (they are still strings; the new selects only affect newly created
  sessions). No migration. An old free-text wind value won't match a BEAUFORT
  entry, so no help line shows for it — acceptable (Setup only edits new sessions).
- Non-ASCII: the strings use an en dash (`–`) and `<`/`+`; these already appear
  in the app and export fine.

## Testing

- **Unit — `conditions.js`:** `BEAUFORT` has 13 entries; forces `F0`…`F12`
  appear in order; every `value` matches `/^F\d{1,2} .+ \(.*kn\)$/` and has a
  non-empty `spec`; `CURRENT_LEVELS` and `WAVE_HEIGHTS` are non-empty; waves and
  surf reference the same `WAVE_HEIGHTS`; `beaufortSpec('F4 Moderate (11–16 kn)')`
  returns the F4 spec and `beaufortSpec('anything else')`/`beaufortSpec('')`
  returns `''`.
- **Unit — round-trip (backward-compat):** `createSession` with
  `conditions: { wind: 'F4 Moderate (11–16 kn)', waves: '1–2 ft (0.3–0.6 m)' }`
  yields those exact strings, and `conditionsSummary` renders
  `'Wind F4 Moderate (11–16 kn) · Waves 1–2 ft (0.3–0.6 m)'` — proving the new
  dropdown strings flow through the unchanged pipeline.
- **`Setup.jsx` is a thin view** — not unit-tested by rendering (node env, no
  DOM). Verified manually: the four selects appear with a blank default, wind
  shows the spec help line on selection, and a started session's Review venue
  line shows the chosen conditions.

## Out of scope (YAGNI)

- Structured/numeric condition data (kept as strings).
- Multi-unit velocity (mph/m·s/kph) — knots only, per decision.
- Auto-filling conditions from weather/location (a separate future feature).
- Editing conditions after Setup, or free-text entry alongside the dropdowns.
- Changing PDF/CSV/Pi formats.
