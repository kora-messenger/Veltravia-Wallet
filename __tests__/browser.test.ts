import {
  hostOf, normalizeUrl, openTab, closeTab, toggleFavorite, isFavorite,
  openInBrowser, registerBrowserNavigator, isAllowedNavigation, siteModeLabel,
  nextBarsVisible, parseScrollMessage, BAR_SCROLL_THRESHOLD, BAR_EDGE_ZONE,
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

describe('desktop / mobile site switch', () => {
  it('menu label flips with the mode', () => {
    expect(siteModeLabel(false)).toBe('Request Desktop Website');
    expect(siteModeLabel(true)).toBe('Request Mobile Website');
  });
});

describe('navigation gate', () => {
  it('allows web pages and in-page frames', () => {
    expect(isAllowedNavigation('https://pendle.finance/app')).toBe(true);
    expect(isAllowedNavigation('http://example.com')).toBe(true);
    expect(isAllowedNavigation('about:blank')).toBe(true);
    expect(isAllowedNavigation('about:srcdoc')).toBe(true);
  });
  it('refuses everything else', () => {
    for (const u of ['javascript:alert(1)', 'intent://x#Intent;end', 'file:///etc/passwd', 'data:text/html,hi', 'blob:https://x/1', 'about:config']) {
      expect(isAllowedNavigation(u)).toBe(false);
    }
  });
});

describe('auto-hiding bars (Trust scroll behaviour)', () => {
  const page = { height: 5000, viewport: 800 };
  const at = (y: number) => ({ y, ...page });

  it('hides while scrolling down', () => {
    expect(nextBarsVisible(400, at(460), true)).toBe(false);
  });
  it('shows again while scrolling up', () => {
    expect(nextBarsVisible(460, at(400), false)).toBe(true);
  });
  it('ignores tiny jitter', () => {
    expect(nextBarsVisible(400, at(400 + BAR_SCROLL_THRESHOLD - 1), true)).toBe(true);
    expect(nextBarsVisible(400, at(400 + BAR_SCROLL_THRESHOLD - 1), false)).toBe(false);
  });
  it('is always shown at the very top', () => {
    expect(nextBarsVisible(100, at(BAR_EDGE_ZONE - 1), false)).toBe(true);
  });
  it('comes back at the very end of the page even while scrolling down', () => {
    const bottomY = page.height - page.viewport; // fully scrolled
    expect(nextBarsVisible(bottomY - 80, at(bottomY), false)).toBe(true);
    expect(nextBarsVisible(bottomY - 80, at(bottomY - BAR_EDGE_ZONE + 2), false)).toBe(true);
  });
  it('stays hidden mid-page when scrolling down', () => {
    expect(nextBarsVisible(2000, at(2200), false)).toBe(false);
  });
  it('a short page (no scroll room) always shows the bars', () => {
    expect(nextBarsVisible(0, { y: 0, height: 600, viewport: 800 }, false)).toBe(true);
  });
});

describe('scroll message parsing', () => {
  it('accepts our scroll message', () => {
    expect(parseScrollMessage(JSON.stringify({ t: 'scroll', y: 120, h: 3000, v: 800 }))).toEqual({ y: 120, height: 3000, viewport: 800 });
  });
  it('ignores anything else', () => {
    expect(parseScrollMessage('hello')).toBeNull();
    expect(parseScrollMessage(JSON.stringify({ t: 'other', y: 1, h: 2, v: 3 }))).toBeNull();
    expect(parseScrollMessage(JSON.stringify({ t: 'scroll', y: 'x', h: 2, v: 3 }))).toBeNull();
    expect(parseScrollMessage(JSON.stringify({ t: 'scroll', y: NaN, h: 2, v: 3 }))).toBeNull();
  });
});
