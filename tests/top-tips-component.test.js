import { expect, test } from 'vitest';
import { TopTips } from '../src/components/TopTips.jsx';

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

const tips = [
  { id: 't1', text: 'one' }, { id: 't2', text: 'two' }, { id: 't3', text: 'three' },
  { id: 't4', text: 'four' }, { id: 't5', text: 'five' }, { id: 't6', text: 'six' },
];

test('shows the top 4 unchecked tips and a progress count', () => {
  const out = text(TopTips({ tips, mastered: [], onToggle: () => {} }));
  expect(out).toMatch(/Top Tips/);
  expect(out).toMatch(/0\/6/);
  expect(out).toMatch(/\bone\b/);
  expect(out).toMatch(/\bfour\b/);
  expect(out).not.toMatch(/\bfive\b/); // 5th not shown yet
});

test('a mastered tip surfaces the next and shows the mastered one as done', () => {
  const out = text(TopTips({ tips, mastered: ['t2'], onToggle: () => {} }));
  expect(out).toMatch(/1\/6/);
  expect(out).toMatch(/\bfive\b/);  // surfaced now
  expect(out).toMatch(/\btwo\b/);   // shown in the mastered list
});

test('all mastered shows the completion note and no to-do items', () => {
  const out = text(TopTips({ tips, mastered: ['t1', 't2', 't3', 't4', 't5', 't6'], onToggle: () => {} }));
  expect(out).toMatch(/All tips mastered/);
});

test('renders nothing when a skill has no tips', () => {
  expect(TopTips({ tips: [], mastered: [], onToggle: () => {} })).toBe(null);
});

test('the whelm meter widens or narrows the reveal', () => {
  const over = text(TopTips({ tips, mastered: [], onToggle: () => {}, whelm: 'over' }));
  expect(over).toMatch(/\bfive\b/);       // 5 revealed
  expect(over).not.toMatch(/\bsix\b/);

  const under = text(TopTips({ tips, mastered: [], onToggle: () => {}, whelm: 'under' }));
  expect(under).toMatch(/\bthree\b/);     // 3 revealed
  expect(under).not.toMatch(/\bfour\b/);
});

test('the meter shows only when a caller can store the choice', () => {
  const withMeter = text(TopTips({ tips, mastered: [], onToggle: () => {}, onWhelmChange: () => {} }));
  expect(withMeter).toMatch(/whelm/);
  expect(withMeter).toMatch(/over.*mid.*under/s);

  const without = text(TopTips({ tips, mastered: [], onToggle: () => {} }));
  expect(without).not.toMatch(/whelm/);
});
