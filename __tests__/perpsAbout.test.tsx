import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#F3F4FA' } }),
}));

import PerpsAboutScreen, { GUIDE_STEPS } from '../src/screens/PerpsAboutScreen';

const texts = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string);

const mount = async () => {
  const Stack = createNativeStackNavigator();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="PerpsAbout">
            <Stack.Screen name="PerpsAbout" component={PerpsAboutScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  return tree;
};

describe('How perps work? guide', () => {
  it('has the six Trust-parity steps in order', () => {
    expect(GUIDE_STEPS.map((s) => s.title)).toEqual([
      'Introducing Perps',
      'What are Perps?',
      'Use leverage wisely',
      'Go long or short',
      'Protect your position',
      'Start trading in minutes',
    ]);
  });

  it('opens on step 1 with Next and Skip, and never mentions Trust-only tokens', async () => {
    const t = await mount();
    const all = texts(t);
    expect(all).toContain('Introducing Perps');
    expect(all).toContain('Next');
    expect(all).toContain('Skip');
    expect(GUIDE_STEPS.flatMap((s) => s.lines).join(' ')).not.toMatch(/TWT/);
    await act(async () => { t.unmount(); });
  });

  it('Next advances to step 2', async () => {
    const t = await mount();
    const next = t.root.find((n) => n.props.accessibilityLabel === 'Next' && typeof n.props.onPress === 'function');
    await act(async () => { next.props.onPress(); });
    const label = t.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
    expect(label).toContain('Step 2 of 6');
    await act(async () => { t.unmount(); });
  });
});
