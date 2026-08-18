import { expect, test, describe } from 'vitest';
import { suggestTipUrl, DISCORD_URL } from '../src/lib/suggest.js';

test('DISCORD_URL is a Discord invite', () => {
  expect(DISCORD_URL).toMatch(/^https:\/\/discord\.gg\/\w+$/);
});

function params(url) {
  return new URL(url).searchParams;
}

describe('suggestTipUrl', () => {
  test('builds a GitHub new-issue URL for a skill', () => {
    const url = suggestTipUrl({ skillId: 'l2-forward', name: 'Forward Paddling', level: 'L2' });
    expect(url.startsWith('https://github.com/kenbolton/aca-skills-assessment/issues/new')).toBe(true);
    const p = params(url);
    expect(p.get('labels')).toBe('top-tip');
    expect(p.get('title')).toBe('Top Tip suggestion: Forward Paddling (L2)');
    // body carries the context and prompts the contributor
    expect(p.get('body')).toMatch(/l2-forward/);
    expect(p.get('body')).toMatch(/cue/i);
  });

  test('special characters in the name are encoded, not broken', () => {
    const url = suggestTipUrl({ skillId: 'l2-wet-exit', name: 'Capsize & Wet Exit', level: 'L2' });
    // The raw URL must not contain a bare & from the name (it would split params).
    expect(params(url).get('title')).toBe('Top Tip suggestion: Capsize & Wet Exit (L2)');
  });

  test('works with no skill (a general suggestion)', () => {
    const url = suggestTipUrl(null);
    const p = params(url);
    expect(p.get('labels')).toBe('top-tip');
    expect(p.get('title')).toMatch(/Top Tip suggestion/);
  });
});
