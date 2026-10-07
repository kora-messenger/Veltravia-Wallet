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
import { IS_TESTNET } from '../config/env';
import type { NavigationContainerRef } from '@react-navigation/native';

const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// Placeholder until screen files land in Phase 2 — typed to force wiring.
const HomeScreen = require('../screens/HomeScreen').default;
const MarketsScreen = require('../screens/MarketsScreen').default;
const SwapScreen = require('../screens/SwapScreen').default;
const DiscoverScreen = require('../screens/DiscoverScreen').default;
const SettingsScreen = require('../screens/SettingsScreen').default;
const WelcomeScreen = require('../screens/onboarding/WelcomeScreen').default;

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.inkMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
      }}
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
      {IS_TESTNET && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            alignSelf: 'center',
            zIndex: 999,
            backgroundColor: theme.warning,
            paddingHorizontal: 12,
            paddingVertical: 2,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>
            TESTNET
          </Text>
        </View>
      )}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
