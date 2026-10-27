import { DISCLAIMER_TEXT } from '../src/components/DappDisclaimerModal';
import { openInBrowser } from '../src/services/browserState';

jest.mock('../src/services/browserState', () => {
  const real = jest.requireActual('../src/services/browserState');
  return { ...real, registerBrowserNavigator: real.registerBrowserNavigator };
});

describe('dApp disclaimer content', () => {
  it('carries the approved wording, Veltravia-branded', () => {
    expect(DISCLAIMER_TEXT).toContain('We do not own, operate, or endorse any third-party dApps or websites.');
    expect(DISCLAIMER_TEXT).toContain('entirely at your own risk');
    expect(DISCLAIMER_TEXT).toContain('including disputed transactions');
    expect(DISCLAIMER_TEXT).toContain('By using Veltravia wallet, you agree to our Terms of Service.');
    expect(DISCLAIMER_TEXT).toContain('Always verify the legitimacy of dApps and conduct your own research');
  });
  it('has no Trust Wallet mention', () => {
    expect(DISCLAIMER_TEXT).not.toMatch(/Trust Wallet/i);
  });
});

describe('openInBrowser dapp flag', () => {
  it('rejects non-http schemes before navigating', () => {
    expect(openInBrowser('javascript:alert(1)')).toBe(false);
    expect(openInBrowser('file:///etc/passwd')).toBe(false);
  });
});
