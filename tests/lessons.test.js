import { expect, test } from 'vitest';
import lessons from '../src/data/lessons.json';

test('lessons.json maps skill ids to non-empty slugs', () => {
  const entries = Object.entries(lessons);
  expect(entries.length).toBeGreaterThan(0);
  for (const [skillId, slug] of entries) {
    expect(skillId).toMatch(/^l[12]-/);
    expect(typeof slug).toBe('string');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  }
});
