import { expect, test } from 'vitest';
import { SkillTipsPreview } from '../src/components/SkillTipsPreview.jsx';

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

test('shows the top N cue texts for a skill that has tips', () => {
  // l2-forward has 6 tips; the first is the "sit tall" cue.
  const out = text(SkillTipsPreview({ skillId: 'l2-forward', max: 3 }));
  expect(out).toMatch(/Sit tall/);           // first cue
  expect(out).toMatch(/\+3 more/);            // 6 total − 3 shown
  expect(out).not.toMatch(/Keep a light, even cadence/); // the 6th, not shown
});

test('no "+N more" when the skill has N or fewer tips', () => {
  const out = text(SkillTipsPreview({ skillId: 'l2-forward', max: 6 }));
  expect(out).not.toMatch(/more/);
});

test('renders nothing for a skill with no tips', () => {
  expect(SkillTipsPreview({ skillId: 'l2-float-plan' })).toBe(null);
  expect(SkillTipsPreview({ skillId: null })).toBe(null);
});
