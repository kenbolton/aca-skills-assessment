import { expect, test } from 'vitest';
import { ratePages, indexOfSkill } from '../src/lib/rate-pages.js';

const base = {
  paddlers: [{ target: 'L2' }],
  skills: [
    { id: 'a', level: 'L2' },
    { id: 'b', level: 'L1' },   // no paddler targets L1 -> excluded
    { id: 'c', level: 'L2' },
  ],
};
const withIntro = { ...base, intro: { sections: [{ heading: 'Overview' }] } };
const noIntro = { ...base, intro: null };

test('ratePages puts intro at index 0 and includes only applicable skills', () => {
  const pages = ratePages(withIntro);
  expect(pages[0]).toEqual({ intro: true });
  expect(pages.slice(1).map(p => p.id)).toEqual(['a', 'c']);
});

test('ratePages omits the intro page when there are no intro sections', () => {
  expect(ratePages(noIntro).map(p => p.id)).toEqual(['a', 'c']);
});

test('indexOfSkill returns the page index accounting for the intro offset', () => {
  expect(indexOfSkill(withIntro, 'c')).toBe(2);  // [intro, a, c]
  expect(indexOfSkill(noIntro, 'c')).toBe(1);    // [a, c]
});

test('indexOfSkill returns 0 for a missing or null skill id', () => {
  expect(indexOfSkill(withIntro, 'nope')).toBe(0);
  expect(indexOfSkill(withIntro, null)).toBe(0);
});
