import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surfaceAlt: '#FFFFFF' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

import BrowserScreen from '../src/screens/BrowserScreen';
import { WebView } from 'react-native-webview';

const renderBrowser = async (params: Record<string, unknown>) => {
  const Stack = createNativeStackNavigator<Record<string, object>>();
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Browser" component={BrowserScreen} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
  });
  const findText = (txt: string) => tree!.root.findAll((n) => typeof n.props.children === 'string' && n.props.children === txt);
  const labels = () => tree!.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
  return { findText, labels, tree: tree! };
};

describe('browser modes', () => {
  it('web mode: plain link chrome (no tabs/favorites), Open in browser menu', async () => {
    const { labels, findText } = await renderBrowser({ tabId: 't1', url: 'https://trustwallet.com/blog' });
    // dApp-only controls absent
    expect(labels()).not.toContain('Favorite');
    // web header buttons present
    expect(labels()).toContain('Back');
    expect(labels()).toContain('Browser menu');
    expect(findText('Scan QR code').length).toBe(0);
  });

  it('dApp mode: full chrome with tabs counter and favorites', async () => {
    const { labels } = await renderBrowser({ tabId: 't2', url: 'https://app.uniswap.org', dapp: true });
    expect(labels()).toContain('Favorite');
    expect(labels()).toContain('Close browser');
    expect(labels()).toContain('Reload');
  });
});

describe('dApp disclaimer gate', () => {
  it('web mode: page loads with no disclaimer', async () => {
    const { tree, labels } = await renderBrowser({ tabId: 'w1', url: 'https://trustwallet.com' });
    expect(labels()).not.toContain('Confirm');
    expect(tree.root.findAllByType(WebView).length).toBe(1);
  });

  it('dApp mode: nothing loads until the disclaimer is confirmed', async () => {
    const { tree, labels } = await renderBrowser({ tabId: 'd1', url: 'https://pancakeswap.finance', dapp: true });
    // disclaimer is up and the WebView is NOT mounted yet
    expect(labels()).toContain('Confirm');
    expect(tree.root.findAllByType(WebView).length).toBe(0);

    // Confirm is disabled until the checkbox is ticked
    const check = tree.root.find((n) => n.props.accessibilityLabel === 'I accept the Terms of Use' && typeof n.props.onPress === 'function');
    await act(async () => { check.props.onPress(); });
    const confirm = tree.root.find((n) => n.props.accessibilityLabel === 'Confirm' && typeof n.props.onPress === 'function');
    await act(async () => { confirm.props.onPress(); });

    // disclaimer passed, the dApp finally loads
    expect(tree.root.findAllByType(WebView).length).toBe(1);
  });
});
