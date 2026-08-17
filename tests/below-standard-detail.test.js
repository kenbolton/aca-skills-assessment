import { expect, test } from 'vitest';
import { BelowStandardDetail } from '../src/components/BelowStandardDetail.jsx';

// Flatten a Preact vnode tree to its visible text, so we can assert on rendered
// output without a DOM. Environment is node; this avoids new test deps.
function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  const children = node.props ? node.props.children : undefined;
  const inner = text(children);
  // Render nested function components (e.g. the item sections) too.
  if (typeof type === 'function') return text(type(node.props));
  return inner;
}

const base = { skillId: 'l2-stopping', name: 'Stopping', category: 'Core: Strokes', ratingLabel: 'Below', standard: 'Stop the kayak.', feedback: '' };

test('renders a Start here line pointing at the prerequisite', () => {
  const vnode = BelowStandardDetail({ items: [{ ...base, startHere: { skillId: 'l2-forward', name: 'Forward Paddling' } }], onEditSkill: () => {} });
  const out = text(vnode);
  expect(out).toMatch(/Start here/);
  expect(out).toMatch(/Forward Paddling/);
});

test('omits the Start here line when the item has no start-here', () => {
  const vnode = BelowStandardDetail({ items: [base], onEditSkill: () => {} });
  expect(text(vnode)).not.toMatch(/Start here/);
});
