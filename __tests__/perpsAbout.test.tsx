import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#F3F4FA' } }),
}));

import PerpsAboutScreen, { GUIDE_STEPS } from '../src/screens/PerpsAboutScreen';

const PerpsMenuStub = () => null;

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
          <Stack.Navigator initialRouteName="PerpsMenu">
            <Stack.Screen name="PerpsMenu" component={PerpsMenuStub} />
            <Stack.Screen name="PerpsAbout" component={PerpsAboutScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  // open the guide the way the app does: pushed on top of PerpsMenu
  const menuNav = tree.root.findByType(PerpsMenuStub).props.navigation;
  await act(async () => { menuNav.navigate('PerpsAbout'); });
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

  it('opens on step 1 with Learn more and Skip, and never mentions Trust-only tokens', async () => {
    const t = await mount();
    const all = texts(t);
    expect(all).toContain('Introducing Perps');
    expect(all).toContain('Learn more');
    expect(all).toContain('Skip');
    expect(all).not.toContain('Next');
    expect(GUIDE_STEPS.flatMap((s) => s.lines).join(' ')).not.toMatch(/TWT/);
    await act(async () => { t.unmount(); });
  });

  it('Learn more on step 1 scrolls to step 2', async () => {
    const t = await mount();
    const btn = t.root.find((n) => n.props.accessibilityLabel === 'Learn more' && typeof n.props.onPress === 'function');
    await act(async () => { btn.props.onPress(); });
    const label = t.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
    expect(label).toContain('Step 2 of 6');
    await act(async () => { t.unmount(); });
  });

  it('Skip returns to the Perps menu screen', async () => {
    const t = await mount();
    const nav = t.root.findByType(PerpsAboutScreen).props.navigation;
    const skip = t.root.find((n) => n.props.accessibilityLabel === 'Skip' && typeof n.props.onPress === 'function');
    await act(async () => { skip.props.onPress(); });
    const state = nav.getState();
    expect(state.routes[state.index].name).toBe('PerpsMenu');
    await act(async () => { t.unmount(); });
  });

  const advanceToLast = async () => {
    const t = await mount();
    for (let i = 0; i < 5; i++) {
      const label = i === 0 ? 'Learn more' : 'Next';
      const btn = t.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
      await act(async () => { btn.props.onPress(); });
    }
    return t;
  };

  it('step 6 shows Start now with a bottom Learn more, no Next or Skip', async () => {
    const t = await advanceToLast();
    expect(t.root.find((n) => n.props.accessibilityLabel === 'Start now')).toBeTruthy();
    expect(t.root.find((n) => n.props.accessibilityLabel === 'Learn more')).toBeTruthy();
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Next' || n.props.accessibilityLabel === 'Skip')).toHaveLength(0);
    await act(async () => { t.unmount(); });
  });

  it('Start now returns to the Perps menu screen', async () => {
    const t = await advanceToLast();
    const nav = t.root.findByType(PerpsAboutScreen).props.navigation;
    const start = t.root.find((n) => n.props.accessibilityLabel === 'Start now' && typeof n.props.onPress === 'function');
    await act(async () => { start.props.onPress(); });
    const state = nav.getState();
    expect(state.routes[state.index].name).toBe('PerpsMenu');
    await act(async () => { t.unmount(); });
  });

  it('the bottom Learn more on step 6 returns to the Perps menu screen', async () => {
    const t = await advanceToLast();
    const nav = t.root.findByType(PerpsAboutScreen).props.navigation;
    const learn = t.root.find((n) => n.props.accessibilityLabel === 'Learn more' && typeof n.props.onPress === 'function');
    await act(async () => { learn.props.onPress(); });
    const state = nav.getState();
    expect(state.routes[state.index].name).toBe('PerpsMenu');
    await act(async () => { t.unmount(); });
  });
});
