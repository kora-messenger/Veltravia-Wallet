import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF','#4A90D9'], surface: '#F5F5F7', positive: '#158444', negative: '#D63232' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/core/storage/secureStorage', () => ({ readSettings: jest.fn(async () => ({})), writeSettings: jest.fn(async () => ({})) }));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ wallets: [], activeWallet: { id: 'w1', name: 'W' }, setActiveWallet: jest.fn(), reload: jest.fn() }),
  WalletsProvider: ({ children }: any) => children,
}));

import DevicesScreen from '../src/screens/wallet/DevicesScreen';
const Stack = createNativeStackNavigator<any>();

it('Devices: tapping Pair a new device', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
        <NavigationContainer>
          <Stack.Navigator><Stack.Screen name="Devices" component={DevicesScreen} /></Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  const btns = tree.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
  const target = btns[btns.length - 1];
  console.log('buttons:', btns.length, 'target?', !!target);
  await act(async () => { target!.props.onPress(); });
  await act(async () => {});
  console.log('after press ok');
  await act(async () => { tree.unmount(); });
});
