// A "signal" is the felt evidence that a cue is landing — "pressure between the
// knuckles of your top hand". It is consulted, never mastered, so it rides on a
// cue rather than taking an id and a slot of its own.
import { expect, test, describe } from 'vitest';
import { TopTips } from '../src/components/TopTips.jsx';
import { SkillTipsPreview } from '../src/components/SkillTipsPreview.jsx';
import { validateTopTips } from '../src/lib/top-tips.js';

const TECHNIQUES = new Set(['forward-stroke']);
const SIGNAL = 'Pressure between the knuckles of your top hand.';

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

// Every rendered element carrying a className, with its text — enough to assert
// that the signal is its own element and not spliced into the cue sentence.
function elements(node, out = []) {
  if (node == null || node === false || typeof node === 'string' || typeof node === 'number') return out;
  if (Array.isArray(node)) { node.forEach(n => elements(n, out)); return out; }
  if (typeof node.type === 'function') return elements(node.type(node.props), out);
  if (node.props && node.props.className) out.push({ className: String(node.props.className), text: text(node) });
  elements(node.props ? node.props.children : undefined, out);
  return out;
}
const signalEls = node => elements(node).filter(e => e.className.split(/\s+/).includes('tt-signal'));

const cue = (id, extra = {}) => ({ id, text: `cue ${id}`, ...extra });

describe('validateTopTips accepts an optional signal', () => {
  test('flags a signal that is present but empty', () => {
    const errs = validateTopTips({ 'forward-stroke': [cue('f1', { signal: '   ' })] }, TECHNIQUES);
    expect(errs.some(e => /"signal"/.test(e))).toBe(true);
  });

  test('flags a signal that is not a string', () => {
    const errs = validateTopTips({ 'forward-stroke': [cue('f1', { signal: 42 })] }, TECHNIQUES);
    expect(errs.some(e => /"signal"/.test(e))).toBe(true);
  });

  test('accepts a cue carrying a real signal', () => {
    expect(validateTopTips({ 'forward-stroke': [cue('f1', { signal: SIGNAL })] }, TECHNIQUES)).toEqual([]);
  });

  test('accepts a cue with no signal at all', () => {
    expect(validateTopTips({ 'forward-stroke': [cue('f1')] }, TECHNIQUES)).toEqual([]);
  });
});

describe('a cue may carry several signals', () => {
  // A cue can have a confirming check and a warning check — "pressure between
  // the knuckles" and "a wobble means you are pulling too hard".
  const PAIR = [SIGNAL, 'A wobble means you are pulling too hard.'];

  test('accepts a list of signals', () => {
    expect(validateTopTips({ 'forward-stroke': [cue('f1', { signal: PAIR })] }, TECHNIQUES)).toEqual([]);
  });

  test('flags a list holding an empty signal', () => {
    const errs = validateTopTips({ 'forward-stroke': [cue('f1', { signal: [SIGNAL, '  '] })] }, TECHNIQUES);
    expect(errs.some(e => /"signal"/.test(e))).toBe(true);
  });

  test('flags an empty list', () => {
    const errs = validateTopTips({ 'forward-stroke': [cue('f1', { signal: [] })] }, TECHNIQUES);
    expect(errs.some(e => /"signal"/.test(e))).toBe(true);
  });

  test('renders one element per signal, in order', () => {
    const out = TopTips({ tips: [cue('f1', { signal: PAIR })], mastered: [] });
    expect(signalEls(out).map(e => e.text)).toEqual(PAIR);
  });

  test('renders both signals after the cue is mastered', () => {
    const out = TopTips({ tips: [cue('f1', { signal: PAIR })], mastered: ['f1'] });
    expect(signalEls(out).map(e => e.text)).toEqual(PAIR);
  });
});

describe('TopTips renders a signal beneath its cue', () => {
  test('shows the signal for a cue the paddler has not mastered', () => {
    const out = TopTips({ tips: [cue('f1', { signal: SIGNAL })], mastered: [] });
    expect(signalEls(out).map(e => e.text)).toEqual([SIGNAL]);
  });

  // A signal is what you re-check once you believe you have the cue, so mastery
  // must not hide it.
  test('still shows the signal after the cue is mastered', () => {
    const out = TopTips({ tips: [cue('f1', { signal: SIGNAL })], mastered: ['f1'] });
    expect(signalEls(out).map(e => e.text)).toEqual([SIGNAL]);
  });

  test('renders no signal element for a cue that has none', () => {
    const out = TopTips({ tips: [cue('f1')], mastered: [] });
    expect(signalEls(out)).toEqual([]);
  });

  test('renders one signal element per cue that carries one', () => {
    const out = TopTips({ tips: [cue('f1', { signal: SIGNAL }), cue('f2'), cue('f3', { signal: 'The catch is silent.' })], mastered: [] });
    expect(signalEls(out).map(e => e.text)).toEqual([SIGNAL, 'The catch is silent.']);
  });
});

describe('SkillTipsPreview stays a glanceable nudge', () => {
  test('renders no signals, even when its cues carry them', () => {
    const out = SkillTipsPreview({ skillId: 'l2-forward', max: 3 });
    expect(signalEls(out)).toEqual([]);
  });
});
