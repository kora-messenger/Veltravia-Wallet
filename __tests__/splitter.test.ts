/** The directive splitter must never leak raw directive JSON into bubbles. */
// jest.mock placement is hoisted; keeps react-native-config out of the run.
jest.mock('../src/config/env', () => ({ APP_CONFIG: {}, processOpenRouterKey: () => '' }));
jest.mock('../src/core/security/walletLock', () => ({ walletLocked: () => false }));
import { newSplitter, feedSplitter, flushSplitter, parseDirective, hasDirective, MARKER } from '../src/ai/openrouterBrain';

function drain(state: ReturnType<typeof newSplitter>, deltas: string[]): string {
  let out = '';
  for (const d of deltas) out += feedSplitter(state, d);
  out += flushSplitter(state);
  return out;
}

test('bare wallet_unlock directive is intercepted, not shown', () => {
  const st = newSplitter();
  const visible = drain(st, ['{"action"', ':"wallet_unlock"}', ' ...']);
  expect(visible).toBe('');
  expect(hasDirective(st)).toBe(true);
  expect(parseDirective(st.directive)).toEqual({ action: 'wallet_unlock' });
});

test('bare directive split mid-token still intercepted', () => {
  const st = newSplitter();
  const visible = drain(st, ['Sure! {"ac', 'tion":"wallet_lock"}', 'junk']);
  expect(visible).toBe('Sure! ');
  expect(parseDirective(st.directive)).toEqual({ action: 'wallet_lock' });
});

test('fenced directive still works', () => {
  const st = newSplitter();
  const visible = drain(st, ['Here it is:\n' + MARKER + '\n{"action":"wallet_unlock"}\n' + MARKER.slice(0, 3)]);
  expect(visible).toBe('Here it is:\n');
  expect(parseDirective(st.directive)).toEqual({ action: 'wallet_unlock' });
});

test('plain JSON text with a different key is shown untouched', () => {
  const st = newSplitter();
  const visible = drain(st, ['{"apples": 3}']);
  expect(visible).toBe('{"apples": 3}');
  expect(hasDirective(st)).toBe(false);
});
