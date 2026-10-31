import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', surface: '#FFFFFF', surfaceAlt: '#F2F2F5', buttonGradient: ['#6C63FF', '#4A90D9'], brandGradient: ['#6C63FF', '#4A90D9'] }, isDark: false }),
}));
jest.mock('../src/services/browserState', () => ({ openInBrowser: jest.fn() }));
jest.mock('../src/core/security/deviceRemoval', () => ({ takeRemovalNotice: () => null }));
const mockCheckOnline = jest.fn();
jest.mock('../src/services/connectivity', () => ({
  checkOnline: (...a: any[]) => mockCheckOnline(...a),
  offlineMessage: () => 'You are offline. Connect to the internet to create or restore a wallet.',
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, SafeAreaProvider: View };
});

import WelcomeScreen from '../src/screens/onboarding/WelcomeScreen';

const mount = async (props: any) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<WelcomeScreen {...props} />); });
  return tree;
};

const press = async (tree: renderer.ReactTestRenderer, label: string) => {
  const node = tree.root.findAll(
    (n) => n.props.label === label && typeof n.props.onPress === 'function',
  )[0];
  expect(node).toBeTruthy();
  await act(async () => { node.props.onPress(); });
  return node;
};

describe('the two onboarding buttons need the network', () => {
  beforeEach(() => { jest.useFakeTimers(); mockCheckOnline.mockReset(); });

  it('Create: offline means no flow starts, and it says why', async () => {
    mockCheckOnline.mockResolvedValue({ online: false, reason: 'offline' });
    const onCreate = jest.fn();
    const t = await mount({ onCreate, onImport: jest.fn() });
    await press(t, 'Create a wallet');
    await act(async () => { jest.advanceTimersByTime(3000); });

    expect(mockCheckOnline).toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
    expect(t.root.findAll((n) => n.props.testID === 'welcomeNetNote').length).toBeGreaterThan(0);
    await act(async () => { t.unmount(); });
  });

  it('Restore: offline means no flow starts either', async () => {
    mockCheckOnline.mockResolvedValue({ online: false, reason: 'unreachable' });
    const onImport = jest.fn();
    const t = await mount({ onCreate: jest.fn(), onImport });
    await press(t, 'I already have a wallet');
    await act(async () => { jest.advanceTimersByTime(3000); });

    expect(onImport).not.toHaveBeenCalled();
    await act(async () => { t.unmount(); });
  });

  it('online: the flow starts as before', async () => {
    mockCheckOnline.mockResolvedValue({ online: true });
    const onCreate = jest.fn();
    const t = await mount({ onCreate, onImport: jest.fn() });
    await press(t, 'Create a wallet');
    await act(async () => { jest.advanceTimersByTime(2100); });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(t.root.findAll((n) => n.props.testID === 'welcomeNetNote').length).toBe(0);
    await act(async () => { t.unmount(); });
  });
});
