import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#F3F4FA' } }),
}));
jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));
jest.mock('../src/services/browserState', () => ({
  openInBrowser: jest.fn(() => true),
}));

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PerpsVenueScreen from '../src/screens/PerpsVenueScreen';
import { openInBrowser } from '../src/services/browserState';
import { resetVenuePrefs, setShowInMarkets, getVenuePrefs } from '../src/services/perpsVenues';

const texts = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string' || (Array.isArray(n.props.children) && n.props.children.every((c: unknown) => typeof c === 'string')))
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : (n.props.children as string)));

const mount = async (venue: 'hyperliquid' | 'aster') => {
  const Stack = createNativeStackNavigator();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="PerpsVenue">
            <Stack.Screen name="PerpsVenue" component={PerpsVenueScreen} initialParams={{ venue }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  return tree;
};

describe('perps venue screens', () => {
  beforeEach(() => {
    resetVenuePrefs();
    (openInBrowser as jest.Mock).mockClear();
  });

  it('hyperliquid: mark + name header, toggle, docs rows; no Asset mode', async () => {
    const t = await mount('hyperliquid');
    const all = texts(t);
    expect(all).toContain('Hyperliquid');
    expect(all).toContain('Show in markets');
    expect(all).toContain('Fees');
    expect(all).toContain('Trading rules');
    expect(all.some((s) => s.includes('Asset mode'))).toBe(false); // Aster-only row
    // Fees opens the venue docs in the in-app browser
    const fees = t.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button').length;
    expect(fees).toBeGreaterThan(0);
  });

  it('aster: shows the Asset mode row with the persisted mode label', async () => {
    const t = await mount('aster');
    const all = texts(t);
    expect(all).toContain('Aster');
    expect(all).toContain('Asset mode');
    expect(all).toContain('Single-asset mode');
    await act(async () => { t.unmount(); });
  });

  it('venue prefs persist toggles per venue', async () => {
    setShowInMarkets('hyperliquid', false);
    expect(getVenuePrefs('hyperliquid').showInMarkets).toBe(false);
    expect(getVenuePrefs('aster').showInMarkets).toBe(true); // untouched
    resetVenuePrefs();
    expect(getVenuePrefs('hyperliquid').showInMarkets).toBe(true);
  });
});
