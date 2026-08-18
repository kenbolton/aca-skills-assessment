// The whelm meter: how many unmastered cues the Top Tips panel reveals at once.
// Reveal too many and a paddler is overwhelmed on the water; too few and there
// is nothing to chew on. Three positions, over to under, and the paddler sets
// their own — nobody else can judge how much is too much.
//
// Device-wide, like tip progress: the practice surfaces never ask who is
// practising (see top-tips.js LOCAL_LEARNER).

const KEY = 'aca-assessment:whelm';

// Ordered over → under, which is also most cues → fewest.
export const WHELM_STEPS = [
  { key: 'over', label: 'over', reveal: 5 },
  { key: 'mid', label: 'mid', reveal: 4 },
  { key: 'under', label: 'under', reveal: 3 },
];

export const DEFAULT_WHELM = 'mid';

// The number of cues a step reveals. An unknown step falls back to the default,
// so a hand-edited or outdated stored value cannot blank the panel.
export function revealFor(step) {
  const found = WHELM_STEPS.find(s => s.key === step);
  return (found || WHELM_STEPS.find(s => s.key === DEFAULT_WHELM)).reveal;
}

export function readWhelm() {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* storage off */ }
  return WHELM_STEPS.some(s => s.key === stored) ? stored : DEFAULT_WHELM;
}

export function writeWhelm(step) {
  try { localStorage.setItem(KEY, step); } catch { /* storage off — this session only */ }
}
