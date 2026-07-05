import { expect, test } from 'vitest';
import { sessionToCsv } from '../src/lib/csv.js';

// Hand-made session fixture (v2 shape)
function makeSession() {
  return {
    id: 'sess-001',
    createdAt: '2026-07-09T12:00:00Z',
    levelId: 'L1',
    levelName: 'Level 1',
    location: 'Cold Spring',
    scale: [
      { value: 'no', label: 'No', requiresFeedback: true },
      { value: 'below', label: 'Below', requiresFeedback: true },
      { value: 'pass', label: 'Pass' },
    ],
    paddlers: [
      { id: 'p1', name: 'Alex' },
      { id: 'p2', name: 'Jordan' },
    ],
    skills: [
      { id: 'sk1', name: 'Wet Exit', category: 'Rescues', standard: 'Exit calmly', optional: false },
      { id: 'sk2', name: 'Brace', category: 'Rescues', standard: 'Recover', optional: true },
    ],
    results: [
      { paddlerId: 'p1', skillId: 'sk1', rating: 'pass', feedback: '' },
      { paddlerId: 'p1', skillId: 'sk2', rating: 'below', feedback: 'Needs practice' },
      { paddlerId: 'p2', skillId: 'sk1', rating: null, feedback: '' },
      { paddlerId: 'p2', skillId: 'sk2', rating: 'pass', feedback: '' },
    ],
  };
}

test('sessionToCsv produces header row exactly as specified', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  expect(lines[0]).toBe('Level,Paddler,Category,Skill,Optional,Rating,Feedback');
});

test('sessionToCsv produces one row per result in order', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Header + 4 results
  expect(lines).toHaveLength(5);
});

test('sessionToCsv normal row with rating and feedback', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // First result: Alex, Wet Exit (sk1), pass, empty feedback
  expect(lines[1]).toBe('Level 1,Alex,Rescues,Wet Exit,,Pass,');
});

test('sessionToCsv row with null rating shows empty Rating column', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Third result: Jordan, Wet Exit (sk1), null rating, empty feedback
  expect(lines[3]).toBe('Level 1,Jordan,Rescues,Wet Exit,,,');
});

test('sessionToCsv optional skill shows Optional=yes', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Second result: Alex, Brace (sk2), below, feedback 'Needs practice'
  expect(lines[2]).toBe('Level 1,Alex,Rescues,Brace,yes,Below,Needs practice');
});

test('sessionToCsv Rating shows label not value', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Second result has rating 'below' which should show as 'Below'
  expect(lines[2]).toContain('Below');
  // First result has rating 'pass' which should show as 'Pass'
  expect(lines[1]).toContain('Pass');
});

test('sessionToCsv feedback with comma and double-quote is properly escaped', () => {
  const session = {
    ...makeSession(),
    results: [
      {
        paddlerId: 'p1',
        skillId: 'sk1',
        rating: 'pass',
        feedback: 'Good, but needs "more" work',
      },
    ],
  };
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Feedback with comma and quote should be wrapped and escaped
  expect(lines[1]).toBe('Level 1,Alex,Rescues,Wet Exit,,Pass,"Good, but needs ""more"" work"');
});

test('sessionToCsv field with comma is quoted', () => {
  const session = {
    ...makeSession(),
    skills: [
      { id: 'sk1', name: 'Wet Exit, Advanced', category: 'Rescues', standard: 'Exit calmly', optional: false },
    ],
    results: [
      { paddlerId: 'p1', skillId: 'sk1', rating: 'pass', feedback: '' },
    ],
  };
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Skill name with comma should be quoted
  expect(lines[1]).toBe('Level 1,Alex,Rescues,"Wet Exit, Advanced",,Pass,');
});

test('sessionToCsv field with newline is quoted', () => {
  const session = {
    ...makeSession(),
    results: [
      { paddlerId: 'p1', skillId: 'sk1', rating: 'pass', feedback: 'Line 1\nLine 2' },
    ],
  };
  const csv = sessionToCsv(session);
  // The CSV should contain the feedback field properly quoted with newline inside
  // Note: the CSV output will span multiple lines due to the newline in the quoted field
  expect(csv).toContain('Level 1,Alex,Rescues,Wet Exit,,Pass,"Line 1');
  expect(csv).toContain('Line 2"');
});

test('sessionToCsv field without special chars is unquoted', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');
  // Normal fields without comma, quote, or newline should not be quoted
  expect(lines[1]).toBe('Level 1,Alex,Rescues,Wet Exit,,Pass,');
  // Fields like level, paddler name, category, skill name should be unquoted
  expect(lines[1]).not.toContain('"Level 1"');
  expect(lines[1]).not.toContain('"Alex"');
});

test('sessionToCsv with multiple paddlers and skills creates correct matrix', () => {
  const session = makeSession();
  const csv = sessionToCsv(session);
  const lines = csv.split('\n');

  // Verify all rows are present
  expect(lines).toHaveLength(5); // header + 4 results

  // Verify row order matches session.results order
  // Result 0: p1, sk1 -> Alex, Wet Exit
  expect(lines[1]).toContain('Alex');
  expect(lines[1]).toContain('Wet Exit');

  // Result 1: p1, sk2 -> Alex, Brace
  expect(lines[2]).toContain('Alex');
  expect(lines[2]).toContain('Brace');

  // Result 2: p2, sk1 -> Jordan, Wet Exit
  expect(lines[3]).toContain('Jordan');
  expect(lines[3]).toContain('Wet Exit');

  // Result 3: p2, sk2 -> Jordan, Brace
  expect(lines[4]).toContain('Jordan');
  expect(lines[4]).toContain('Brace');
});
