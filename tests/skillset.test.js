import { expect, test } from 'vitest';
import { skillSetRef, blobOf, isSlim, slimSession, fattenSession, bundleOf, BUNDLE_FORMAT } from '../src/lib/skillset.js';

const blob = { skills: [{ id: 's1', level: 'L3', standard: 'x' }], scales: { L3: [{ value: 'meets' }] }, intro: null };
const fat = { id: 'a', createdAt: 't', results: [{ skillId: 's1', rating: 'meets' }], ...blob };

test('skillSetRef is deterministic and discriminating', () => {
  expect(skillSetRef(blob)).toBe(skillSetRef(blob));
  expect(skillSetRef(blob)).toMatch(/^sk-[0-9a-f]{8}$/);
  const changed = { ...blob, skills: [{ id: 's1', level: 'L3', standard: 'CHANGED' }] };
  expect(skillSetRef(changed)).not.toBe(skillSetRef(blob));
});

test('blobOf extracts the three fields, normalizing intro', () => {
  expect(blobOf(fat)).toEqual(blob);
  expect(blobOf({ skills: [], scales: {} }).intro).toBe(null);
});

test('slimSession drops the blob and adds the ref; isSlim detects it', () => {
  const ref = skillSetRef(blob);
  const slim = slimSession(fat, ref);
  expect(slim.skills).toBeUndefined();
  expect(slim.scales).toBeUndefined();
  expect(slim.intro).toBeUndefined();
  expect(slim.skillSetRef).toBe(ref);
  expect(slim.id).toBe('a');
  expect(isSlim(slim)).toBe(true);
  expect(isSlim(fat)).toBe(false);
});

test('fattenSession is the inverse of slimSession given the blob', () => {
  const ref = skillSetRef(blob);
  const back = fattenSession(slimSession(fat, ref), blob);
  expect(back).toEqual(fat);
  expect(back.skillSetRef).toBeUndefined();
});

test('bundleOf slims fat sessions and dedups shared blobs', () => {
  const s1 = { id: 'a', results: [], ...blob };   // `blob` fixture already defined at top of file
  const s2 = { id: 'b', results: [], ...blob };    // same config -> same ref
  const b = bundleOf([s1, s2]);
  expect(b.format).toBe(BUNDLE_FORMAT);
  expect(b.sessions.every(s => !s.skills && typeof s.skillSetRef === 'string')).toBe(true);
  expect(Object.keys(b.skillSets)).toHaveLength(1);            // dedup
  expect(b.skillSets[b.sessions[0].skillSetRef]).toEqual(blob);
});

test('bundleOf passes an already-slim session through unchanged', () => {
  const slim = { id: 'a', results: [], skillSetRef: 'sk-12345678' };
  const b = bundleOf([slim]);
  expect(b.sessions[0]).toBe(slim);
  expect(Object.keys(b.skillSets)).toHaveLength(0);
});
