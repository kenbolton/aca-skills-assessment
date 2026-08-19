import { expect, test } from 'vitest';
import { SkillTipsPreview } from '../src/components/SkillTipsPreview.jsx';
import { tipsFor } from '../src/lib/top-tips.js';

// Counts come from the data, so adding cues to a technique cannot break these.
const forwardTips = tipsFor('l2-forward');

function text(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  const type = node.type;
  if (typeof type === 'function') return text(type(node.props));
  return text(node.props ? node.props.children : undefined);
}

test('shows the top N cue texts for a skill that has tips', () => {
  // The first l2-forward cue is the "sit tall" one.
  const out = text(SkillTipsPreview({ skillId: 'l2-forward', max: 3 }));
  expect(out).toMatch(/Sit tall/);                                  // first cue
  expect(out).toContain(`+${forwardTips.length - 3} more`);         // the rest are counted
  expect(out).not.toContain(forwardTips[3].text);                   // the 4th is not shown
});

test('no "+N more" when the skill has N or fewer tips', () => {
  const out = text(SkillTipsPreview({ skillId: 'l2-forward', max: forwardTips.length }));
  expect(out).not.toMatch(/more/);
});

test('renders nothing for a skill with no tips', () => {
  expect(SkillTipsPreview({ skillId: 'l2-float-plan' })).toBe(null);
  expect(SkillTipsPreview({ skillId: null })).toBe(null);
});
