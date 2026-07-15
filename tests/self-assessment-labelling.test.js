import { expect, test } from 'vitest';
import { SELF_ASSESSMENT_NOTICE } from '../src/lib/pdf.js';
import { sessionToCsv } from '../src/lib/csv.js';
import { resultNeedsFeedback } from '../src/lib/validation.js';

// A self-assessment leaving this app must never be mistakable for an ACA
// assessment. The distinction lived only in the data and the Archive view; the
// PDF and CSV — the artifacts that actually travel — didn't carry it. These lock
// the safeguard so it can't quietly regress.

test('the self-assessment notice denies certification in plain terms', () => {
  expect(SELF_ASSESSMENT_NOTICE).toMatch(/not an ACA assessment/i);
  expect(SELF_ASSESSMENT_NOTICE).toMatch(/certified ACA assessor/i);
  expect(SELF_ASSESSMENT_NOTICE).toMatch(/confers no ACA certification/i);
});

const session = {
  createdAt: 't',
  paddlers: [{ id: 'p1', name: 'Alex', target: 'L2' }],
  scales: { L2: [{ value: 'below', label: 'Below', requiresFeedback: true }] },
  skills: [{ id: 'k1', level: 'L2', category: 'Strokes', name: 'Fwd', standard: 'Fwd', optional: false }],
  results: [{ paddlerId: 'p1', skillId: 'k1', rating: 'below', feedback: 'wobbly' }],
  actionPlans: {},
};

test('an assessor session emits a CMS grade; a self-assessment does not', () => {
  const assessed = sessionToCsv(session).split('\n')[1];
  const self = sessionToCsv({ ...session, selfAssessment: true }).split('\n')[1];

  expect(assessed.startsWith('Assessment,')).toBe(true);
  expect(self.startsWith('Self-assessment,')).toBe(true);

  // CMS Grade is column 9 (index 8) — populated for an assessment, blank for self
  expect(assessed.split(',')[8]).toBe('Below');
  expect(self.split(',')[8]).toBe('');
});

test('feedback on a below rating is required in self-assessment as well', () => {
  const r = { skillId: 'k1', rating: 'below', feedback: '' };
  expect(resultNeedsFeedback(session, r)).toBe(true);
  expect(resultNeedsFeedback({ ...session, selfAssessment: true }, r)).toBe(true);
});
