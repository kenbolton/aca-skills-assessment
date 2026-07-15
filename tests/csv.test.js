import { expect, test } from 'vitest';
import { sessionToCsv, cmsGrade } from '../src/lib/csv.js';

const session = {
  scales: { L1: [], L2: [{ value: 'below', label: 'Below', requiresFeedback: true }, { value: 'l1', label: 'L1', requiresFeedback: true, dualOnly: true }, { value: 'meets', label: 'Meets', requiresFeedback: false }, { value: 'exceeds', label: 'Exceeds', requiresFeedback: false }] },
  paddlers: [{ id: 'p', name: 'Alex', target: 'L2' }],
  skills: [{ id: 'd', level: 'L2', category: 'Strokes', name: 'Fwd', optional: false, l1Standard: 'x' }],
  results: [{ paddlerId: 'p', skillId: 'd', rating: 'l1', feedback: 'said "hi", ok' }],
};

test('CSV header + row includes Type, Target, Landing, CMS Grade, and the rating label', () => {
  const lines = sessionToCsv(session).split('\n');
  expect(lines[0]).toBe('Type,Paddler,Target,Landing,Category,Skill,Optional,Rating,CMS Grade,Feedback');
  // an l1 mark on a dual skill is below the L2 standard -> CMS "Below"
  expect(lines[1]).toBe('Assessment,Alex,L2,L1,Strokes,Fwd,,L1,Below,"said ""hi"", ok"');
});

// The CMS Paddler Evaluation form is a certified assessor's official record. A
// self-review must never emit CMS-shaped grades, or it invites transcription into
// the ACA's system as though an assessor made the call.
test('a self-assessment is labelled Type=Self-assessment and emits no CMS grade', () => {
  const lines = sessionToCsv({ ...session, selfAssessment: true }).split('\n');
  expect(lines[1].startsWith('Self-assessment,')).toBe(true);
  const cms = lines[1].split(',')[8];
  expect(cms).toBe('');
  // the rating itself is still recorded — only the CMS column is withheld
  expect(lines[1]).toContain('L1');
});

test('cmsGrade collapses the scale to the official Meets/Below (blank when nothing to enter)', () => {
  expect(['meets', 'exceeds', 'pass'].map(cmsGrade)).toEqual(['Meets', 'Meets', 'Meets']);
  expect(['below', 'no', 'l1'].map(cmsGrade)).toEqual(['Below', 'Below', 'Below']);
  expect([cmsGrade('dno'), cmsGrade(null), cmsGrade('')]).toEqual(['', '', '']);
});
