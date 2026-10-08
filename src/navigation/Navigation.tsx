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
  Onboarding: undefined;
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
          {() => (
            <WelcomeScreen
              // Phase 2 replaces these with the real seed/PIN and import flows.
              onCreate={() => navigationRef.current?.navigate('MainTabs')}
              onImport={() => navigationRef.current?.navigate('MainTabs')}
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
