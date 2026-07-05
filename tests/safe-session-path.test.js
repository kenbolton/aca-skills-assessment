import { expect, test } from 'vitest';
import { safeSessionPath } from '../src/lib/safe-session-path.js';

const DIR = '/srv/app/pi/sessions';

test('accepts a clean id and returns a path inside the dir', () => {
  const p = safeSessionPath(DIR, 'sess-123');
  expect(p).toBe('/srv/app/pi/sessions/sess-123.json');
});

test('sanitizes disallowed characters (no traversal escape)', () => {
  // slashes/dots become underscores -> stays inside DIR
  expect(safeSessionPath(DIR, '../../etc/passwd')).toBe('/srv/app/pi/sessions/______etc_passwd.json');
});

test('returns null for an id that sanitizes to empty', () => {
  expect(safeSessionPath(DIR, '')).toBeNull();
  expect(safeSessionPath(DIR, '///')).toBeNull();
});
