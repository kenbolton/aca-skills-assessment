import { expect, test, beforeEach } from 'vitest';
import { createSession, getResult, setRating, setFeedback, getActionPlan, setActionPlan, optionFor, saveSession, loadSession, clearSession } from '../src/lib/session.js';

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
});

const cfg = {
  scales: {
    L1: [{ value: 'no', label: 'No', requiresFeedback: true }, { value: 'pass', label: 'Pass', requiresFeedback: false }, { value: 'dno', label: 'DNO', requiresFeedback: false }],
    L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }],
  },
  skills: [
    { id: 'a1', level: 'L1', category: 'c', name: 'A1', standard: 's', optional: false },
    { id: 'b1', level: 'L2', category: 'c', name: 'B1', standard: 's', optional: false, l1Standard: 'l1 std' },
    { id: 'b2', level: 'L2', category: 'c', name: 'B2', standard: 's', optional: false },
  ],
};

function base() {
  return createSession({ id: 's1', createdAt: 't', config: cfg, paddlers: [{ name: 'Alex', target: 'L2' }, { name: 'Sam', target: 'L1' }] });
}

test('createSession rates each paddler only on their target level', () => {
  const s = base();
  const alex = s.paddlers[0].id, sam = s.paddlers[1].id;
  // Alex (L2) -> b1,b2 ; Sam (L1) -> a1
  expect(s.results.filter(r => r.paddlerId === alex).map(r => r.skillId).sort()).toEqual(['b1', 'b2']);
  expect(s.results.filter(r => r.paddlerId === sam).map(r => r.skillId)).toEqual(['a1']);
});

test('setRating preserves an existing note across rating changes', () => {
  let s = base();
  const alex = s.paddlers[0].id;
  s = setRating(s, alex, 'b1', 'l1');
  s = setFeedback(s, alex, 'b1', 'met L1 only');
  expect(getResult(s, alex, 'b1').feedback).toBe('met L1 only');
  s = setRating(s, alex, 'b1', 'meets');         // note is kept, not wiped
  expect(getResult(s, alex, 'b1').feedback).toBe('met L1 only');
});

test('optionFor resolves within a skill option set (l1 only on dual)', () => {
  const s = base();
  const b1 = s.skills.find(x => x.id === 'b1'), b2 = s.skills.find(x => x.id === 'b2');
  expect(optionFor(s, b1, 'l1').requiresFeedback).toBe(true);
  expect(optionFor(s, b2, 'l1')).toBeUndefined();   // l1 not available on L2-only
});

test('save/load/clear round-trips', () => {
  saveSession(base()); expect(loadSession().id).toBe('s1'); clearSession(); expect(loadSession()).toBeNull();
});

test('createSession stores selfAssessment, defaulting to false', () => {
  expect(base().selfAssessment).toBe(false);
  const solo = createSession({ id: 's2', createdAt: 't', config: cfg, selfAssessment: true, paddlers: [{ name: 'Me', target: 'L2' }] });
  expect(solo.selfAssessment).toBe(true);
});

test('action plan: empty by default, set/get round-trips per paddler', () => {
  let s = base();
  const alex = s.paddlers[0].id;
  expect(getActionPlan(s, alex)).toBe('');
  s = setActionPlan(s, alex, 'Practice rolling; return in 6 weeks');
  expect(getActionPlan(s, alex)).toBe('Practice rolling; return in 6 weeks');
  // other paddler unaffected
  expect(getActionPlan(s, s.paddlers[1].id)).toBe('');
  // reading an action plan from a pre-feature session (no map) is safe
  expect(getActionPlan({}, alex)).toBe('');
});

test('createSession carries the config intro (null when absent)', () => {
  expect(base().intro).toBeNull();
  const intro = { title: 'T', sections: [{ heading: 'H', body: 'B' }] };
  const s = createSession({ id: 's3', createdAt: 't', config: { ...cfg, intro }, paddlers: [{ name: 'Me', target: 'L2' }] });
  expect(s.intro).toEqual(intro);
});
