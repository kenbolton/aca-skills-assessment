import { expect, test } from 'vitest';
import { loadConfig } from '../src/lib/skills.js';
import { createSession, setRating, setFeedback } from '../src/lib/session.js';
import { resultNeedsFeedback, invalidResults, isSessionComplete } from '../src/lib/validation.js';

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
            { id: 'roll', name: 'Roll', standard: 'Roll up', optional: true },
          ],
        },
      ],
    },
  ],
};

const config = loadConfig(raw);

function base() {
  return createSession({
    id: 's1', createdAt: 'x', config, levelId: 'L1', paddlerNames: ['Alex'],
  });
}

test('resultNeedsFeedback is true only for core skill + requiresFeedback rating + blank feedback', () => {
  let s = base();
  const pid = s.paddlers[0].id;

  s = setRating(s, pid, 'wet-exit', 'no'); // requiresFeedback, core
  let r = s.results.find(x => x.skillId === 'wet-exit');
  expect(resultNeedsFeedback(s, r)).toBe(true);

  s = setFeedback(s, pid, 'wet-exit', 'whitespace only test');
  r = s.results.find(x => x.skillId === 'wet-exit');
  expect(resultNeedsFeedback(s, r)).toBe(false);

  s = setFeedback(s, pid, 'wet-exit', '   '); // whitespace-only feedback still blank
  r = s.results.find(x => x.skillId === 'wet-exit');
  expect(resultNeedsFeedback(s, r)).toBe(true);

  s = setRating(s, pid, 'wet-exit', 'pass'); // clears feedback, no requiresFeedback
  r = s.results.find(x => x.skillId === 'wet-exit');
  expect(resultNeedsFeedback(s, r)).toBe(false);
});

test('resultNeedsFeedback is always false for optional skills, even with requiresFeedback rating and blank feedback', () => {
  let s = base();
  const pid = s.paddlers[0].id;
  s = setRating(s, pid, 'roll', 'no'); // requiresFeedback rating on optional skill
  const r = s.results.find(x => x.skillId === 'roll');
  expect(resultNeedsFeedback(s, r)).toBe(false);
});

test('invalidResults collects only core results needing feedback', () => {
  let s = base();
  const pid = s.paddlers[0].id;
  s = setRating(s, pid, 'wet-exit', 'no'); // core, needs feedback, blank
  s = setRating(s, pid, 'roll', 'no'); // optional, never invalid
  expect(invalidResults(s)).toHaveLength(1);
  expect(invalidResults(s)[0].skillId).toBe('wet-exit');
});

test('isSessionComplete requires every core result rated and zero invalid results; optional may stay unrated', () => {
  let s = base();
  const pid = s.paddlers[0].id;
  expect(isSessionComplete(s)).toBe(false); // nothing rated

  s = setRating(s, pid, 'wet-exit', 'pass');
  expect(isSessionComplete(s)).toBe(true); // core rated, optional 'roll' still unrated -> complete

  s = setRating(s, pid, 'wet-exit', 'no'); // requiresFeedback, blank feedback
  expect(isSessionComplete(s)).toBe(false);

  s = setFeedback(s, pid, 'wet-exit', 'needs work');
  expect(isSessionComplete(s)).toBe(true);
});
