import { expect, test } from 'vitest';
import { FeedbackSummary } from '../src/components/FeedbackSummary.jsx';

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

const base = {
  target: 'L2', metCount: 30, coreTotal: 36,
  strengths: ['Forward Paddling', 'Assisted Rescue'],
  priorityNext: { skillId: 'l2-wet-exit', name: 'Capsize & Wet Exit' },
};

test('shows goal progress, named strengths, and the one priority', () => {
  const out = text(FeedbackSummary({ summary: base }));
  expect(out).toMatch(/Toward L2/);
  expect(out).toMatch(/30 of 36/);
  expect(out).toMatch(/Strengths:/);
  expect(out).toMatch(/Forward Paddling/);
  expect(out).toMatch(/Assisted Rescue/);
  expect(out).toMatch(/Start with:/);
  expect(out).toMatch(/Capsize & Wet Exit/);
});

test('omits the Strengths line when there are none', () => {
  const out = text(FeedbackSummary({ summary: { ...base, strengths: [] } }));
  expect(out).not.toMatch(/Strengths:/);
});

test('omits the Start with line when there is no gap', () => {
  const out = text(FeedbackSummary({ summary: { ...base, priorityNext: null } }));
  expect(out).not.toMatch(/Start with:/);
});

test('renders nothing without a target', () => {
  expect(FeedbackSummary({ summary: { ...base, target: null } })).toBe(null);
});
