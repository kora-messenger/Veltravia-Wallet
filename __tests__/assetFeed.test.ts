import { ASSETS } from '../src/data/assetCatalog';

// Mirrors ManageCryptoScreen's feed rule: symbol-prefix first, then contains, each A-Z.
function feed(q: string) {
  const az = [...ASSETS].sort((x, y) => x.symbol.localeCompare(y.symbol) || x.name.localeCompare(y.name));
  const query = q.trim().toLowerCase();
  if (!query) return az;
  const prefix = az.filter((a) => a.symbol.toLowerCase().startsWith(query));
  const rest = az.filter(
    (a) => !a.symbol.toLowerCase().startsWith(query) &&
      (a.symbol.toLowerCase().includes(query) || a.fullName.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)),
  );
  return [...prefix, ...rest];
}

describe('Manage crypto feed', () => {
  it('empty query is the A-Z directory', () => {
    const syms = feed('').map((a) => a.symbol);
    expect([...syms]).toEqual([...syms].sort((a, b) => a.localeCompare(b)));
  });
  it('typing a letter surfaces symbol-prefix matches first', () => {
    const out = feed('a').map((a) => a.symbol);
    const firstNonPrefix = out.findIndex((s) => !s.toLowerCase().startsWith('a'));
    const lastPrefix = out.map((s) => s.toLowerCase().startsWith('a')).lastIndexOf(true);
    expect(firstNonPrefix === -1 || lastPrefix < firstNonPrefix).toBe(true);
    expect(out[0].toLowerCase().startsWith('a')).toBe(true);
  });
  it('a query with no match returns nothing (-> No results found)', () => {
    expect(feed('zzzz')).toHaveLength(0);
  });
  it('narrows as more characters are typed', () => {
    expect(feed('do').length).toBeLessThanOrEqual(feed('d').length);
  });
});
