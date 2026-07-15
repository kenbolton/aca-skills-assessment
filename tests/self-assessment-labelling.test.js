import { expect, test } from 'vitest';
import { SELF_ASSESSMENT_NOTICE } from '../src/lib/pdf.js';
import {
  ACA_ATTRIBUTION, INDEPENDENCE_NOTICE, LEDGER_NOTICE,
  SELF_ASSESSMENT_NOTICE as NOTICE_SOURCE,
} from '../src/lib/notices.js';
import { Attribution } from '../src/components/Attribution.jsx';
import { sessionToCsv } from '../src/lib/csv.js';
import { resultNeedsFeedback } from '../src/lib/validation.js';

// The attribution wording was duplicated between Attribution.jsx and pdf.js and
// silently drifted: the component named the Jan-2025 verification while the
// exported PDF still claimed only rev. 5/1/2024. One source now; these keep it so.

test('pdf.js re-exports the notice from notices.js rather than keeping a copy', () => {
  expect(SELF_ASSESSMENT_NOTICE).toBe(NOTICE_SOURCE);
});

test('the in-app footer renders the shared attribution strings verbatim', () => {
  const vdom = Attribution();
  const rendered = JSON.stringify(vdom);
  expect(rendered).toContain(ACA_ATTRIBUTION);
  expect(rendered).toContain(INDEPENDENCE_NOTICE);
});

test('the attribution names both the transcribed revision and what verified it', () => {
  expect(ACA_ATTRIBUTION).toMatch(/rev\. 5\/1\/2024/);
  expect(ACA_ATTRIBUTION).toMatch(/January 2025/);
  expect(ACA_ATTRIBUTION).toMatch(/the guides govern/i);
});

test('the ledger notice denies that an assessor export is a certificate', () => {
  expect(LEDGER_NOTICE).toMatch(/not a certificate/i);
  expect(LEDGER_NOTICE).toMatch(/confers no ACA level/i);
  expect(LEDGER_NOTICE).toMatch(/issued by the ACA/i);
});

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
