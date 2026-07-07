import { describe, it, expect } from 'vitest';
import { startEventPath } from '../src/lib/start-metric.js';

describe('startEventPath', () => {
  it('sanitizes the L1/L2 slash and marks group', () => {
    expect(startEventPath('L1/L2', false)).toBe('/start/L1-L2/group');
  });
  it('keeps a standalone level and marks self', () => {
    expect(startEventPath('L3', true)).toBe('/start/L3/self');
  });
  it('handles L4/L5 group', () => {
    expect(startEventPath('L5', false)).toBe('/start/L5/group');
  });
});
