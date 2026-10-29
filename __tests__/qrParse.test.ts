import { parseQr, isActionable, chainName } from '../src/services/qrParse';

describe('what a scanned code means', () => {
  it('a bare EVM address is a wallet address', () => {
    const p = parseQr('0x9b21c6d5f0A1b2C3d4E5f60718293a4B5c6D7e8F');
    expect(p.kind).toBe('evm-address');
    expect(p.value).toBe('0x9b21c6d5f0A1b2C3d4E5f60718293a4B5c6D7e8F');
    expect(p.detail).toBe('0x9b21…7e8F');
    expect(isActionable(p)).toBe(true);
  });

  it('tolerates surrounding whitespace and newlines', () => {
    expect(parseQr('  0x9b21c6d5f0A1b2C3d4E5f60718293a4B5c6D7e8F\n').kind).toBe('evm-address');
  });

  it('reads an EIP-681 payment URI, including its chain', () => {
    const p = parseQr('ethereum:0x9b21c6d5f0A1b2C3d4E5f60718293a4B5c6D7e8F@56?value=1000000000000000000');
    expect(p.kind).toBe('payment');
    expect(p.chainId).toBe(56);
    expect(p.amount).toBe('1000000000000000000');
    expect(p.detail).toContain('BNB Chain');
  });

  it('reads an EIP-681 token transfer and exposes the token contract', () => {
    const p = parseQr('ethereum:0x14dC79964da2C08b23698B3D3cc7Ca32193d9955@1/transfer?address=0x9b21c6d5f0A1b2C3d4E5f60718293a4B5c6D7e8F&uint256=42');
    expect(p.kind).toBe('asset');
    expect(p.value).toBe('0x9b21c6d5f0A1b2C3d4E5f60718293a4B5c6D7e8F');
    expect(p.chainId).toBe(1);
    expect(p.amount).toBe('42');
  });

  it('reads a CAIP-19 asset URI', () => {
    const p = parseQr('eip155:1/erc20:0x14dC79964da2C08b23698B3D3cc7Ca32193d9955');
    expect(p.kind).toBe('asset');
    expect(p.chainId).toBe(1);
    expect(p.token).toBe('0x14dC79964da2C08b23698B3D3cc7Ca32193d9955');
    expect(p.detail).toBe('Ethereum');
  });

  it('recognises a WalletConnect pairing URI', () => {
    const p = parseQr('wc:8a5e5bdc-a0e4-47a2-8e1b-2d3b4c5d6e7f@2?relay-protocol=irn&symKey=abc');
    expect(p.kind).toBe('walletconnect');
    expect(p.label).toBe('WalletConnect');
  });

  it('recognises a link and shows its host', () => {
    const p = parseQr('https://app.veltraviawallet.com/pay?to=0xabc');
    expect(p.kind).toBe('url');
    expect(p.detail).toBe('app.veltraviawallet.com');
  });

  it('rejects unrelated text instead of pretending it is a wallet code', () => {
    for (const s of ['hello world', 'WIFI:S:Cafe;T:WPA;P:pass;;', '5', 'mailto:a@b.com']) {
      const p = parseQr(s);
      expect(p.kind).toBe('text');
      expect(isActionable(p)).toBe(false);
      expect(p.label).toBe('Not a wallet code');
    }
  });

  it('an unusable ethereum URI falls through to text rather than a broken payment', () => {
    const p = parseQr('ethereum:not-an-address@1');
    expect(p.kind).toBe('text');
  });

  it('handles empty input without throwing', () => {
    expect(parseQr('').kind).toBe('text');
    expect(parseQr('   ').label).toBe('Empty code');
  });

  it('names the chains it knows and falls back for the rest', () => {
    expect(chainName(1)).toBe('Ethereum');
    expect(chainName(137)).toBe('Polygon');
    expect(chainName(7777)).toBe('Chain 7777');
    expect(chainName(undefined)).toBe('');
  });
});
