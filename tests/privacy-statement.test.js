import { describe, it, expect } from 'vitest';
import { PRIVACY_TEXT } from '../src/components/PrivacyStatement.jsx';

describe('privacy statement copy', () => {
  it('states that assessment data stays on the device', () => {
    expect(PRIVACY_TEXT.join(' ')).toMatch(/stays? on (your|this) device/i);
  });
  it('discloses anonymous, cookieless counting and Do-Not-Track', () => {
    const all = PRIVACY_TEXT.join(' ');
    expect(all).toMatch(/anonymous/i);
    expect(all).toMatch(/cookieless|no cookies/i);
    expect(all).toMatch(/do[- ]not[- ]track/i);
  });
  it('does not mention the optional home-server sync', () => {
    expect(PRIVACY_TEXT.join(' ')).not.toMatch(/sync|home server|home-server|Raspberry Pi|Tailscale/i);
  });
});
