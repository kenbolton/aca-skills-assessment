import { expect, test } from 'vitest';
import { PlainTerms } from '../src/components/PlainTerms.jsx';

// Flatten a Preact vnode tree to its visible text (env is node, no DOM).
function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

test('renders an "In plain terms" line with the gloss', () => {
  const out = text(PlainTerms({ gloss: 'Paddle forward in a straight line.' }));
  expect(out).toMatch(/In plain terms/);
  expect(out).toMatch(/Paddle forward in a straight line\./);
});

test('renders nothing when there is no gloss', () => {
  expect(PlainTerms({ gloss: null })).toBe(null);
  expect(PlainTerms({ gloss: '' })).toBe(null);
});
