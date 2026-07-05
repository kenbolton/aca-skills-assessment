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
import { createSession, setRating, setFeedback } from '../src/lib/session.js';
import { paddlerSummary } from '../src/lib/summary.js';

// Minimal fixture: one paddler, mixed core/optional skills, multiple scale ratings
const raw = {
  levels: [
    {
      id: 'L1',
      name: 'Test Level',
      scale: [
        { value: 'below', label: 'Below', requiresFeedback: true },
        { value: 'meets', label: 'Meets', requiresFeedback: false },
        { value: 'exceeds', label: 'Exceeds', requiresFeedback: false },
      ],
      categories: [
        {
          name: 'Basic Skills',
          skills: [
            { id: 'core-below', name: 'Core Below Skill', standard: 'std1', optional: false },
            { id: 'core-meets', name: 'Core Meets Skill', standard: 'std2', optional: false },
            { id: 'core-unrated', name: 'Core Unrated Skill', standard: 'std3', optional: false },
            { id: 'optional-below', name: 'Optional Below Skill', standard: 'std4', optional: true },
          ],
        },
      ],
    },
  ],
};

const config = loadConfig(raw);

function baseSession() {
  return createSession({
    id: 's1',
    createdAt: '2026-07-09T12:00:00Z',
    config,
    levelId: 'L1',
    location: 'Test Location',
    paddlerNames: ['Alex'],
  });
}

test('paddlerSummary extracts name, levelId, levelName, and passes through scale', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  const summary = paddlerSummary(session, paddlerId);

  expect(summary.name).toBe('Alex');
  expect(summary.levelId).toBe('L1');
  expect(summary.levelName).toBe('Test Level');
  expect(summary.scale).toEqual(session.scale);
});

test('paddlerSummary counts only CORE skills in coreTotal', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  // 4 skills total, 3 are core (optional-below is optional)
  const summary = paddlerSummary(session, paddlerId);
  expect(summary.coreTotal).toBe(3);
});

test('paddlerSummary counts includes all scale values even when zero', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;
  // Set only one core skill to "meets"
  let s = setRating(session, paddlerId, 'core-meets', 'meets');

  const summary = paddlerSummary(s, paddlerId);

  // All three scale values must be present in counts
  expect(summary.counts).toHaveProperty('below');
  expect(summary.counts).toHaveProperty('meets');
  expect(summary.counts).toHaveProperty('exceeds');
  expect(summary.counts.below).toBe(0);
  expect(summary.counts.meets).toBe(1);
  expect(summary.counts.exceeds).toBe(0);
});

test('paddlerSummary counts only CORE results, excludes optional', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  // Rate: core-below='below', core-meets='meets', optional-below='below'
  let s = setRating(session, paddlerId, 'core-below', 'below');
  s = setRating(s, paddlerId, 'core-meets', 'meets');
  s = setRating(s, paddlerId, 'optional-below', 'below');

  const summary = paddlerSummary(s, paddlerId);

  // Only core results counted
  expect(summary.counts.below).toBe(1); // only core-below
  expect(summary.counts.meets).toBe(1); // only core-meets
  expect(summary.counts.exceeds).toBe(0);
});

test('paddlerSummary unrated counts CORE results with null rating', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  // Rate 2 core skills, leave 1 core unrated (core-unrated)
  // optional-below stays unrated too
  let s = setRating(session, paddlerId, 'core-below', 'below');
  s = setRating(s, paddlerId, 'core-meets', 'meets');

  const summary = paddlerSummary(s, paddlerId);

  expect(summary.unrated).toBe(1); // only core-unrated
});

test('paddlerSummary belowItems contains CORE results with requiresFeedback rating', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  let s = setRating(session, paddlerId, 'core-below', 'below');
  s = setFeedback(s, paddlerId, 'core-below', 'needs improvement');
  s = setRating(s, paddlerId, 'core-meets', 'meets');
  s = setRating(s, paddlerId, 'optional-below', 'below'); // optional, should NOT appear
  s = setFeedback(s, paddlerId, 'optional-below', 'optional feedback');

  const summary = paddlerSummary(s, paddlerId);

  expect(summary.belowItems).toHaveLength(1);
  const item = summary.belowItems[0];
  expect(item.skillId).toBe('core-below');
  expect(item.name).toBe('Core Below Skill');
  expect(item.category).toBe('Basic Skills');
  expect(item.rating).toBe('below');
  expect(item.feedback).toBe('needs improvement');
});

test('paddlerSummary belowItems excludes CORE results with meets/exceeds ratings', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  let s = setRating(session, paddlerId, 'core-meets', 'meets');
  s = setRating(s, paddlerId, 'core-below', 'exceeds');

  const summary = paddlerSummary(s, paddlerId);

  // exceeds is not requiresFeedback, so not in belowItems
  expect(summary.belowItems).toHaveLength(0);
});

test('paddlerSummary optionalAssessed counts optional skills with non-null rating', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  let s = setRating(session, paddlerId, 'optional-below', 'below');
  // Leave unrated core skills unrated

  const summary = paddlerSummary(s, paddlerId);

  expect(summary.optionalAssessed).toBe(1);
});

test('paddlerSummary optionalItems lists optional skills with non-null rating, any value', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  let s = setRating(session, paddlerId, 'optional-below', 'below');
  s = setFeedback(s, paddlerId, 'optional-below', 'optional feedback');

  const summary = paddlerSummary(s, paddlerId);

  expect(summary.optionalItems).toHaveLength(1);
  const item = summary.optionalItems[0];
  expect(item.skillId).toBe('optional-below');
  expect(item.name).toBe('Optional Below Skill');
  expect(item.category).toBe('Basic Skills');
  expect(item.rating).toBe('below');
  expect(item.feedback).toBe('optional feedback');
});

test('paddlerSummary optionalItems empty when optional skills unrated', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  // Rate only core skills, leave optional unrated
  let s = setRating(session, paddlerId, 'core-below', 'below');
  s = setRating(s, paddlerId, 'core-meets', 'meets');

  const summary = paddlerSummary(s, paddlerId);

  expect(summary.optionalItems).toHaveLength(0);
});

test('paddlerSummary handles fully rated session', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  let s = setRating(session, paddlerId, 'core-below', 'below');
  s = setFeedback(s, paddlerId, 'core-below', 'feedback');
  s = setRating(s, paddlerId, 'core-meets', 'meets');
  s = setRating(s, paddlerId, 'core-unrated', 'exceeds');
  s = setRating(s, paddlerId, 'optional-below', 'below');

  const summary = paddlerSummary(s, paddlerId);

  expect(summary.coreTotal).toBe(3);
  expect(summary.counts).toEqual({ below: 1, meets: 1, exceeds: 1 });
  expect(summary.unrated).toBe(0);
  expect(summary.belowItems).toHaveLength(1);
  expect(summary.optionalAssessed).toBe(1);
  expect(summary.optionalItems).toHaveLength(1);
});

test('paddlerSummary with entirely unrated session', () => {
  const session = baseSession();
  const paddlerId = session.paddlers[0].id;

  const summary = paddlerSummary(session, paddlerId);

  expect(summary.coreTotal).toBe(3);
  expect(summary.counts).toEqual({ below: 0, meets: 0, exceeds: 0 });
  expect(summary.unrated).toBe(3);
  expect(summary.belowItems).toHaveLength(0);
  expect(summary.optionalAssessed).toBe(0);
  expect(summary.optionalItems).toHaveLength(0);
});

test('paddlerSummary with multiple paddlers returns correct summary for each', () => {
  const s1 = createSession({
    id: 's2',
    createdAt: '2026-07-09T12:00:00Z',
    config,
    levelId: 'L1',
    location: 'Test',
    paddlerNames: ['Alex', 'Sam'],
  });

  const [pid1, pid2] = s1.paddlers.map(p => p.id);

  let s = setRating(s1, pid1, 'core-below', 'below');
  s = setRating(s, pid2, 'core-meets', 'meets');

  const sum1 = paddlerSummary(s, pid1);
  const sum2 = paddlerSummary(s, pid2);

  expect(sum1.name).toBe('Alex');
  expect(sum1.counts.below).toBe(1);
  expect(sum1.counts.meets).toBe(0);

  expect(sum2.name).toBe('Sam');
  expect(sum2.counts.below).toBe(0);
  expect(sum2.counts.meets).toBe(1);
});
