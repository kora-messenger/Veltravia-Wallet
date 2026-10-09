/**
 * Veltravia Wallet — navigation.
 *
 * Root:  Wallet exists? -> MainTabs : Onboarding stack
 * Tabs:  Home | Markets | Swap | Discover | Settings  (per approved mockup)
 *
 * v1 reality: Home, Markets and Settings are live. Swap and Discover render
 * their real screens but back onto "coming soon" bodies until v2. A coming
 * soon screen that is designed like the rest of the app is honest UI —
 * dead-looking buttons are not.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useTheme } from '../theme/ThemeProvider';
import FloatingTabBar from '../components/FloatingTabBar';
import type { NavigationContainerRef } from '@react-navigation/native';
import WalletsScreen from '../screens/wallet/WalletsScreen';
import NameWalletScreen from '../screens/wallet/NameWalletScreen';
import ImportWalletScreen from '../screens/wallet/ImportWalletScreen';
import ManageAccountScreen from '../screens/wallet/ManageAccountScreen';
import PasscodeScreen from '../screens/onboarding/PasscodeScreen';
import { setPasscode } from '../core/storage/passcode';

const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// Placeholder until screen files land in Phase 2 — typed to force wiring.
const HomeScreen = require('../screens/HomeScreen').default;
const MarketsScreen = require('../screens/MarketsScreen').default;
const SwapScreen = require('../screens/SwapScreen').default;
const DiscoverScreen = require('../screens/DiscoverScreen').default;
const SettingsScreen = require('../screens/SettingsScreen').default;
const WelcomeScreen = require('../screens/onboarding/WelcomeScreen').default;
const ActivityScreen = require('../screens/ActivityScreen').default;

export type RootStackParamList = {
  Onboarding: { finish?: 'create' | 'import' } | undefined;
  Passcode: { flow: 'create' | 'import' };
  MainTabs: undefined;
  Wallets: undefined;
  NameWallet: { origin?: 'created' | 'imported' } | undefined;
  ImportWallet: undefined;
  ManageAccount: { walletId: string };
  Activity: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Markets: undefined;
  Swap: undefined;
  Discover: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tabs.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Markets" component={MarketsScreen} />
      <Tabs.Screen name="Swap" component={SwapScreen} />
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function Navigation() {
  const { theme } = useTheme();
  return (
    <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding">
          {({ route }) => (
            <WelcomeScreen
              key={route.params?.finish ?? 'idle'}
              // Tap -> 2s spinner -> full-screen passcode (create, then confirm).
              onCreate={() => navigationRef.current?.navigate('Passcode', { flow: 'create' })}
              onImport={() => navigationRef.current?.navigate('Passcode', { flow: 'import' })}
              // Back from the passcode: buttons spin 2s again, then the account is created.
              autoLoadFor={route.params?.finish ?? null}
              onAutoLoadDone={(which: 'create' | 'import') =>
                which === 'create'
                  ? navigationRef.current?.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
                  : navigationRef.current?.reset({
                      index: 1,
                      routes: [{ name: 'MainTabs' }, { name: 'ImportWallet' }],
                    })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Passcode" options={{ animation: 'fade_from_bottom', gestureEnabled: false }}>
          {({ route }) => (
            <PasscodeScreen
              onBack={() => navigationRef.current?.goBack()}
              onDone={async (code) => {
                try {
                  // yield one frame so the blue boxes paint before hashing
                  await new Promise<void>((r) => requestAnimationFrame(() => r()));
                  await setPasscode(code);
                } catch {
                  // Keychain unavailable (e.g. emulator without lock screen): continue; app still opens.
                }
                navigationRef.current?.navigate('Onboarding', { finish: route.params.flow });
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Wallets" component={WalletsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="NameWallet" component={NameWalletScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ImportWallet" component={ImportWalletScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ManageAccount" component={ManageAccountScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Activity" component={ActivityScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
