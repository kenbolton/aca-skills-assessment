import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { initStore, getTipChecks, putTipChecks, resetStore } from '../src/lib/store.js';

beforeEach(async () => {
  resetStore();
  await new Promise((res) => { const r = indexedDB.deleteDatabase('aca-assessment'); r.onsuccess = r.onerror = () => res(); });
});

test('getTipChecks returns an empty record for an unknown learner', async () => {
  await initStore();
  const rec = await getTipChecks('alex');
  expect(rec).toEqual({ learnerKey: 'alex', checks: {} });
});

test('put then get round-trips a learner tip-check record', async () => {
  await initStore();
  await putTipChecks({ learnerKey: 'alex', checks: { 'l2-forward': ['f1', 'f2'] } });
  const rec = await getTipChecks('alex');
  expect(rec.checks['l2-forward']).toEqual(['f1', 'f2']);
});

test('records are isolated per learner', async () => {
  await initStore();
  await putTipChecks({ learnerKey: 'alex', checks: { 'l2-forward': ['f1'] } });
  await putTipChecks({ learnerKey: 'sam', checks: { 'l2-forward': ['f3'] } });
  expect((await getTipChecks('alex')).checks['l2-forward']).toEqual(['f1']);
  expect((await getTipChecks('sam')).checks['l2-forward']).toEqual(['f3']);
});
