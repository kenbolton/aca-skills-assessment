beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
});

import { expect, test, beforeEach } from 'vitest';
import { loadConfig } from '../src/lib/skills.js';
import {
  createSession, getResult, skillById, optionFor,
  setRating, setFeedback, saveSession, loadSession, clearSession,
} from '../src/lib/session.js';

const raw = {
  levels: [
    {
      id: 'L1',
      name: 'Level 1',
      scale: [
        { value: 'no', label: 'No', requiresFeedback: true },
        { value: 'pass', label: 'Pass' },
        { value: 'dno', label: 'Did Not Observe' },
      ],
      categories: [
        {
          name: 'Rescues',
          skills: [
            { id: 'wet-exit', name: 'Wet Exit', standard: 'Exit calmly' },
          ],
        },
      ],
    },
    {
      id: 'L2',
      name: 'Level 2',
      scale: [
        { value: 'below', label: 'Below', requiresFeedback: true },
        { value: 'meets', label: 'Meets' },
      ],
      categories: [
        {
          name: 'Strokes',
          skills: [
            { id: 'stern-rudder', name: 'Stern Rudder', standard: 'Holds line' },
          ],
        },
      ],
    },
  ],
};

const config = loadConfig(raw);

function base(levelId = 'L1') {
  return createSession({
    id: 's1',
    createdAt: '2026-07-09T12:00:00Z',
    config,
    levelId,
    location: 'Cold Spring',
    paddlerNames: ['Alex', 'Sam'],
  });
}

test('createSession builds one result per paddler x snapshot skill, and snapshots scale/levelName', () => {
  const s = base('L1'); // L1 has 1 skill; 2 paddlers => 2 results
  expect(s.results).toHaveLength(2);
  expect(s.paddlers.map(p => p.name)).toEqual(['Alex', 'Sam']);
  expect(s.levelName).toBe('Level 1');
  expect(s.skills.map(sk => sk.id)).toEqual(['wet-exit']);
  expect(s.scale.map(o => o.value)).toEqual(['no', 'pass', 'dno']);
  expect(getResult(s, s.paddlers[0].id, 'wet-exit').rating).toBeNull();
});

test('createSession trims and drops blank paddler names', () => {
  const s = createSession({
    id: 's2', createdAt: 'x', config, levelId: 'L1', paddlerNames: ['  Alex  ', '', '   ', 'Sam'],
  });
  expect(s.paddlers.map(p => p.name)).toEqual(['Alex', 'Sam']);
});

test('skillById finds a snapshot skill by id', () => {
  const s = base('L1');
  expect(skillById(s, 'wet-exit').name).toBe('Wet Exit');
  expect(skillById(s, 'nope')).toBeUndefined();
});

test('optionFor finds a scale option by rating value', () => {
  const s = base('L1');
  expect(optionFor(s, 'no').label).toBe('No');
  expect(optionFor(s, 'nonexistent')).toBeUndefined();
});

test('setRating returns a new session and does not mutate', () => {
  const s = base('L1');
  const pid = s.paddlers[0].id;
  const s2 = setRating(s, pid, 'wet-exit', 'pass');
  expect(getResult(s, pid, 'wet-exit').rating).toBeNull();
  expect(getResult(s2, pid, 'wet-exit').rating).toBe('pass');
});

test('setRating clears feedback when the new rating does not requiresFeedback', () => {
  const s = base('L1');
  const pid = s.paddlers[0].id;
  let s2 = setRating(s, pid, 'wet-exit', 'no'); // requiresFeedback
  s2 = setFeedback(s2, pid, 'wet-exit', 'needs work');
  expect(getResult(s2, pid, 'wet-exit').feedback).toBe('needs work');

  const s3 = setRating(s2, pid, 'wet-exit', 'pass'); // does NOT requiresFeedback
  expect(getResult(s3, pid, 'wet-exit').feedback).toBe('');
});

test('setRating retains feedback when the new rating requiresFeedback', () => {
  const s = base('L1');
  const pid = s.paddlers[0].id;
  let s2 = setRating(s, pid, 'wet-exit', 'no');
  s2 = setFeedback(s2, pid, 'wet-exit', 'needs work');
  const s3 = setRating(s2, pid, 'wet-exit', 'no'); // still requiresFeedback
  expect(getResult(s3, pid, 'wet-exit').feedback).toBe('needs work');
});

test('setRating clears feedback when the new rating has no matching scale option', () => {
  const s = base('L1');
  const pid = s.paddlers[0].id;
  let s2 = setRating(s, pid, 'wet-exit', 'no');
  s2 = setFeedback(s2, pid, 'wet-exit', 'needs work');
  const s3 = setRating(s2, pid, 'wet-exit', 'totally-unknown');
  expect(getResult(s3, pid, 'wet-exit').feedback).toBe('');
});

test('setFeedback returns a new session with updated feedback', () => {
  const s = base('L1');
  const pid = s.paddlers[0].id;
  const s2 = setFeedback(s, pid, 'wet-exit', 'looks good');
  expect(getResult(s, pid, 'wet-exit').feedback).toBe('');
  expect(getResult(s2, pid, 'wet-exit').feedback).toBe('looks good');
});

test('save/load/clear round-trips via localStorage', () => {
  const s = base('L1');
  saveSession(s);
  expect(loadSession().id).toBe('s1');
  clearSession();
  expect(loadSession()).toBeNull();
});

test('loadSession returns null and clears the entry when stored value is corrupt JSON', () => {
  localStorage.setItem('aca-assessment:session', '{bad json');
  expect(loadSession()).toBeNull();
  expect(localStorage.getItem('aca-assessment:session')).toBeNull();
});
