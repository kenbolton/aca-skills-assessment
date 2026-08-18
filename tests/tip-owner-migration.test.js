import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { initStore, getTipChecks, putTipChecks, putSession, resetStore } from '../src/lib/store.js';
import { createSession } from '../src/lib/session.js';
import { LOCAL_LEARNER } from '../src/lib/top-tips.js';

// The vitest `node` environment has no global localStorage; match the shim
// pattern used in tests/store.test.js.
if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

const config = { scales: { L3: [{ value: 'meets', label: 'Meets' }] },
  skills: [{ id: 's1', level: 'L3', category: 'C', standard: 'x', optional: false }] };
const selfSession = name => createSession({
  id: 'sess-1', createdAt: '2026-08-01T00:00:00Z', config,
  paddlers: [{ name, target: 'L3' }], selfAssessment: true,
});

beforeEach(async () => {
  resetStore();
  await new Promise((res) => { const r = indexedDB.deleteDatabase('aca-assessment'); r.onsuccess = r.onerror = () => res(); });
  localStorage.clear();
});

// The app used to ask "Practising as" and to key a self-assessment by its one
// paddler. Both now write to LOCAL_LEARNER, so boot must adopt the old records
// rather than strand the mastery they hold.
test('adopts the old "Practising as" record', async () => {
  await putTipChecks({ learnerKey: 'ken', checks: { stopping: ['s1'] } });
  localStorage.setItem('aca-assessment:practice-name', 'Ken');

  await initStore();

  expect((await getTipChecks(LOCAL_LEARNER)).checks).toEqual({ stopping: ['s1'] });
  expect((await getTipChecks('ken')).checks).toEqual({});   // source dropped
  expect(localStorage.getItem('aca-assessment:practice-name')).toBe(null);
});

test('adopts a self-assessment paddler record and unions with the local one', async () => {
  await putSession(selfSession('Me'));
  await putTipChecks({ learnerKey: 'me', checks: { stopping: ['s1', 's2'] } });
  await putTipChecks({ learnerKey: LOCAL_LEARNER, checks: { stopping: ['s2'], 'wet-exit': ['w1'] } });

  await initStore();

  const checks = (await getTipChecks(LOCAL_LEARNER)).checks;
  expect(checks.stopping.sort()).toEqual(['s1', 's2']);     // union, no duplicate
  expect(checks['wet-exit']).toEqual(['w1']);
});

test('leaves a coach-rated paddler alone', async () => {
  const coached = createSession({
    id: 'sess-2', createdAt: '2026-08-02T00:00:00Z', config,
    paddlers: [{ name: 'Alex', target: 'L3' }], selfAssessment: false,
  });
  await putSession(coached);
  await putTipChecks({ learnerKey: 'alex', checks: { stopping: ['s1'] } });

  await initStore();

  expect((await getTipChecks('alex')).checks).toEqual({ stopping: ['s1'] });
  expect((await getTipChecks(LOCAL_LEARNER)).checks).toEqual({});
});

test('runs once, then leaves later name-keyed records untouched', async () => {
  await initStore();                                        // marks migration done
  await putTipChecks({ learnerKey: 'ken', checks: { stopping: ['s1'] } });
  localStorage.setItem('aca-assessment:practice-name', 'Ken');

  await initStore();

  expect((await getTipChecks('ken')).checks).toEqual({ stopping: ['s1'] });
  expect((await getTipChecks(LOCAL_LEARNER)).checks).toEqual({});
});
