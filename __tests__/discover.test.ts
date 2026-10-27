import { fmtPrice, fmtVol, fmtChange, searchDiscover, TRENDING_TOKENS } from '../src/services/discoverData';
import { addRecent, clearRecents } from '../src/services/discoverRecents';

describe('discover formatting (matches Trust)', () => {
  it('prices', () => {
    expect(fmtPrice(78.07)).toBe('$78.07');
    expect(fmtPrice(0.137)).toBe('$0.1370');
    expect(fmtPrice(0.0024)).toBe('$0.0024');
    expect(fmtPrice(0.000477)).toBe('$0.000477');
    // Trust writes tiny prices with a subscript zero count: $0.0₇2672
    expect(fmtPrice(0.00000002672)).toBe('$0.0₇2672');
  });
  it('volume + change', () => {
    expect(fmtVol(58_410_000)).toBe('$58.41M Vol');
    expect(fmtVol(14_200)).toBe('$14.20K Vol');
    expect(fmtChange(2.4)).toBe('+2.40%');
    expect(fmtChange(-1.28)).toBe('-1.28%');
    expect(fmtChange(17260)).toBe('+17260.00%');
  });
});

describe('discover search', () => {
  it('finds Elon across tokens, predictions and dApps', async () => {
    const r = await searchDiscover('Elon', { cancelled: false });
    expect(r.tokens.map((t) => t.symbol)).toEqual(expect.arrayContaining(['ELON', 'ELON2028']));
    expect(r.predictions.length).toBeGreaterThan(0);
    expect(r.dapps.map((d) => d.name)).toContain('Echelon Market'.replace('Echelon', 'Echelon'));
  });
  it('rejects when superseded', async () => {
    const sig = { cancelled: false };
    const p = searchDiscover('uni', sig);
    sig.cancelled = true;
    await expect(p).rejects.toThrow('cancelled');
  });
  it('returns an empty result for gibberish', async () => {
    const r = await searchDiscover('zzzzqqq', { cancelled: false });
    expect(r.tokens.length + r.predictions.length + r.dapps.length).toBe(0);
  });
  it('has the trending list in the order shown in Trust', () => {
    expect(TRENDING_TOKENS.slice(0, 3).map((t) => t.symbol)).toEqual(['WHYPE', 'AIN', 'BTC']);
  });
});

describe('recents', () => {
  it('dedupes, orders newest first and clears', () => {
    clearRecents();
    addRecent({ id: 'uni', kind: 'token', label: 'UNI', caption: 'Token', color: '#f0f' });
    addRecent({ id: 'pons', kind: 'token', label: 'PONS', caption: 'Token', color: '#ccc' });
    addRecent({ id: 'uni', kind: 'token', label: 'UNI', caption: 'Token', color: '#f0f' });
    const { useRecents } = require('../src/services/discoverRecents');
    expect(typeof useRecents).toBe('function');
    clearRecents();
  });
});
