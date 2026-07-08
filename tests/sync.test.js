import { afterEach, expect, test, vi } from 'vitest';
import { syncSession } from '../src/lib/sync.js';

const fat = {
  id: 'a', createdAt: 't', results: [{ skillId: 's1', rating: 'meets', feedback: '' }],
  skills: [{ id: 's1', level: 'L3', standard: 'x' }], scales: { L3: [{ value: 'meets' }] }, intro: null,
};

afterEach(() => { vi.unstubAllGlobals(); });

test('syncSession POSTs a one-session bundle and returns ok', async () => {
  let sent;
  vi.stubGlobal('fetch', async (url, opts) => {
    sent = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ syncedAt: 'T' }) };
  });
  const r = await syncSession(fat, '');
  expect(r).toEqual({ ok: true, syncedAt: 'T' });
  expect(sent.url).toBe('/sync');
  expect(sent.body.format).toBe('aca-archive-v2');
  expect(sent.body.sessions[0].id).toBe('a');
  expect(sent.body.sessions[0].skills).toBeUndefined();       // slim on the wire
  const ref = sent.body.sessions[0].skillSetRef;
  expect(sent.body.skillSets[ref]).toEqual({ skills: fat.skills, scales: fat.scales, intro: null });
});

test('syncSession reports an error when the server rejects', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 400 }));
  expect((await syncSession(fat, '')).ok).toBe(false);
});
