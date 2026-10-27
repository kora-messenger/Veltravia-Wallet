import { isEvmAddress, isHttpUrl, validateToken, validateNetwork, hasErrors } from '../src/data/customAssets';

const GOOD = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT contract

describe('custom token validation', () => {
  it('accepts a valid EVM token', () => {
    expect(hasErrors(validateToken({ address: GOOD, name: 'Tether', symbol: 'USDT', decimals: '6' }, true))).toBe(false);
  });
  it('flags every empty field', () => {
    const e = validateToken({ address: '', name: '', symbol: '', decimals: '' }, true);
    expect(Object.keys(e).sort()).toEqual(['address', 'decimals', 'name', 'symbol']);
  });
  it('rejects a malformed EVM address but allows non-EVM formats', () => {
    expect(isEvmAddress('0x123')).toBe(false);
    expect(isEvmAddress(GOOD)).toBe(true);
    expect(validateToken({ address: '0x123', name: 'a', symbol: 'A', decimals: '1' }, true).address).toBeTruthy();
    expect(validateToken({ address: 'TXyz123', name: 'a', symbol: 'A', decimals: '1' }, false).address).toBeUndefined();
  });
  it('bounds decimals to 0-36 integers', () => {
    const f = { address: GOOD, name: 'a', symbol: 'A' };
    expect(validateToken({ ...f, decimals: '0' }, true).decimals).toBeUndefined();
    expect(validateToken({ ...f, decimals: '36' }, true).decimals).toBeUndefined();
    expect(validateToken({ ...f, decimals: '37' }, true).decimals).toBeTruthy();
    expect(validateToken({ ...f, decimals: '1.5' }, true).decimals).toBeTruthy();
  });
});

describe('custom network validation', () => {
  it('accepts a full valid network (explorer optional)', () => {
    expect(hasErrors(validateNetwork({ name: 'My Chain', symbol: 'MYC', nodeUrl: 'https://rpc.mychain.io', explorerUrl: '' }))).toBe(false);
  });
  it('requires name, symbol and node URL', () => {
    const e = validateNetwork({ name: '', symbol: '', nodeUrl: '', explorerUrl: '' });
    expect(Object.keys(e).sort()).toEqual(['name', 'nodeUrl', 'symbol']);
  });
  it('rejects non-http(s) and malformed URLs', () => {
    expect(isHttpUrl('https://rpc.example.com')).toBe(true);
    expect(isHttpUrl('ftp://rpc.example.com')).toBe(false);
    expect(isHttpUrl('rpc.example.com')).toBe(false);
    expect(isHttpUrl('https://')).toBe(false);
    expect(validateNetwork({ name: 'a', symbol: 'A', nodeUrl: 'nope', explorerUrl: '' }).nodeUrl).toBeTruthy();
    expect(validateNetwork({ name: 'a', symbol: 'A', nodeUrl: 'https://rpc.a.io', explorerUrl: 'bad' }).explorerUrl).toBeTruthy();
  });
});
