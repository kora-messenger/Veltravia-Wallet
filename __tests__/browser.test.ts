import {
  hostOf, normalizeUrl, openTab, closeTab, toggleFavorite, isFavorite,
  openInBrowser, registerBrowserNavigator,
} from '../src/services/browserState';

describe('in-app browser state', () => {
  it('extracts a clean host', () => {
    expect(hostOf('https://www.asterdex.com/path?q=1')).toBe('asterdex.com');
    expect(hostOf('https://app.aave.com')).toBe('app.aave.com');
  });
  it('normalises bare domains to https', () => {
    expect(normalizeUrl('app.uniswap.org')).toBe('https://app.uniswap.org');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });
  it('dedupes tabs by host and closes them', () => {
    const a = openTab('https://app.aave.com/markets');
    const b = openTab('https://app.aave.com/other');
    expect(b.id).toBe(a.id);
    closeTab(a.id);
  });
  it('toggles favorites by host', () => {
    expect(isFavorite('https://curve.fi/#/swap')).toBe(false);
    expect(toggleFavorite('https://curve.fi/#/swap')).toBe(true);
    expect(isFavorite('https://curve.fi/other')).toBe(true);
    expect(toggleFavorite('https://curve.fi')).toBe(false);
  });
});

describe('openInBrowser safety', () => {
  const nav = { navigate: jest.fn() };
  beforeEach(() => { nav.navigate.mockClear(); registerBrowserNavigator(nav); });

  it('opens https links in the Browser screen', () => {
    expect(openInBrowser('https://pancakeswap.finance')).toBe(true);
    expect(nav.navigate).toHaveBeenCalledWith('Browser', expect.objectContaining({ url: 'https://pancakeswap.finance' }));
  });
  it('refuses dangerous schemes', () => {
    for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'intent://x#Intent;end', 'data:text/html,<script>1</script>', 'ftp://x.com']) {
      expect(openInBrowser(bad)).toBe(false);
    }
    // normalizeUrl prefixes bare strings, so scheme-less junk is still only ever https://...
    expect(nav.navigate).not.toHaveBeenCalledWith('Browser', expect.objectContaining({ url: expect.stringMatching(/^(javascript|file|intent|data):/) }));
  });
});
