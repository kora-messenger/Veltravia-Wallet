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
import BalanceDetailsScreen from '../screens/wallet/BalanceDetailsScreen';
import AiChatScreen from '../screens/ai/AiChatScreen';
import PasscodeScreen from '../screens/onboarding/PasscodeScreen';
import SelectRecoveryMethodScreen from '../screens/SelectRecoveryMethodScreen';
import BuyScreen from '../features/buy/BuyScreen';
import SelectCurrencyScreen from '../features/buy/SelectCurrencyScreen';
import NotificationSheet from '../components/NotificationSheet';
import LockScreen from '../screens/LockScreen';
import { setAppLocked } from '../core/security/appLockState';
import { setPasscode, hasPasscode } from '../core/storage/passcode';
import { setBiometricUnlockEnabled } from '../core/security/biometrics';
import { AppState, StyleSheet } from 'react-native';

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
  SelectRecoveryMethod: undefined;
  ManageAccount: { walletId: string };
  Activity: undefined;
  Discover: undefined;
  BalanceDetails: undefined;
  AiChat: { mode?: 'support' | 'fresh' } | undefined;
  Buy: { pickedCurrency?: string } | undefined;
  SelectCurrency: { selected?: string } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Markets: undefined;
  Swap: undefined;
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
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function Navigation() {
  const { theme } = useTheme();
  // Shown once over the home screen right after the create-path account
  // is created (biometric allowed or denied — both paths land on it).
  const [notifPrompt, setNotifPrompt] = React.useState(false);
  // Locked whenever a passcode exists: cold start + every return from
  // background, like Trust. Unlock reveals the app (MainTabs for an
  // existing wallet); the welcome screen never shows again.
  const [locked, setLocked] = React.useState(true);
  const [booted, setBooted] = React.useState(false);
  const [walletExists, setWalletExists] = React.useState(false);
  // Cached passcode state so the background lock is SYNCHRONOUS. Reading the
  // keychain first leaves a window where the app resumes straight into the
  // screen the user left (e.g. the share view) with only the OS fingerprint
  // dialog over it — the lock screen must already be painted when we return.
  const hasPassRef = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      // A passcode is only ever set at the end of onboarding, so it is the
      // reliable "this device has a wallet" signal. (hasWallet() reads a
      // biometric-protected item and would pop a prompt just to check.)
      const has = await hasPasscode();
      if (alive) {
        hasPassRef.current = has;
        setWalletExists(has);
        setLocked(has);
        setBooted(true);
      }
    })().catch(() => {
      if (alive) {
        setLocked(false);
        setBooted(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        // Lock IMMEDIATELY from the cached state so the lock screen is the
        // frame the system shows on resume; the async re-read only reconciles
        // the stack (a wallet created this session).
        setLocked(hasPassRef.current);
        hasPasscode()
          .then((has) => {
            hasPassRef.current = has;
            setWalletExists(has);
            setLocked(has);
          })
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = React.useCallback(() => {
    setLocked(false);
  }, []);

  // Publish to every <AppModal> so open sheets (Receive QR, filters, menus...)
  // vanish the moment the app locks. Native Modals sit above this overlay, so
  // this is the only way the lock screen is the ONE thing on screen.
  React.useEffect(() => {
    setAppLocked(locked);
  }, [locked]);

  // Until we know the state, show a solid screen; while locked, show ONLY
  // the lock screen. The welcome/app stack is not mounted underneath, so
  // nothing can bleed through (that was the overlap bug).
  if (!booted) {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
    {/* The navigator stays mounted while locked so the screen the user was on
        (e.g. Wallets) survives unlock; the opaque lock overlay covers it. */}
    <NavigationContainer ref={navigationRef}>
      <React.Fragment>
      <Stack.Navigator
        initialRouteName={walletExists ? 'MainTabs' : 'Onboarding'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding">
          {({ route }) => (
            <WelcomeScreen
              key={route.params?.finish ?? 'idle'}
              // Tap -> 2s spinner -> full-screen passcode (create, then confirm).
              onCreate={() => navigationRef.current?.navigate('Passcode', { flow: 'create' })}
              onImport={() => navigationRef.current?.navigate('Passcode', { flow: 'import' })}
              // Back from the passcode: buttons spin 2s again, then the account is created.
              autoLoadFor={route.params?.finish ?? null}
              onAutoLoadDone={(which: 'create' | 'import') => {
                if (which === 'create') {
                  navigationRef.current?.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                  setNotifPrompt(true);
                } else {
                  navigationRef.current?.navigate('SelectRecoveryMethod');
                }
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Passcode" options={{ animation: 'fade_from_bottom', gestureEnabled: false }}>
          {({ route }) => (
            <PasscodeScreen
              onBack={() => navigationRef.current?.goBack()}
              onDone={async (code, biometric) => {
                setBiometricUnlockEnabled(biometric === 'allowed');
                try {
                  // yield one frame so the blue boxes paint before hashing
                  await new Promise<void>((r) => requestAnimationFrame(() => r()));
                  await setPasscode(code);
                } catch {
                  // Keychain unavailable (e.g. emulator without lock screen): continue; app still opens.
                }
                navigationRef.current?.navigate('Onboarding', { finish: route.params.flow });
                // 'biometric' outcome is consumed later by settings;
                // both allowed and denied continue to the same next step.
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="SelectRecoveryMethod" options={{ animation: 'slide_from_right' }}>
          {() => (
            <SelectRecoveryMethodScreen
              // Back arrow returns to the welcome screen (the stack root).
              onBack={() => navigationRef.current?.goBack()}
              onSecretPhrase={() => navigationRef.current?.navigate('ImportWallet')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Wallets" component={WalletsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="NameWallet" component={NameWalletScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ImportWallet" component={ImportWalletScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ManageAccount" component={ManageAccountScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Activity" component={ActivityScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Discover" component={DiscoverScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="BalanceDetails" component={BalanceDetailsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Buy" component={BuyScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="SelectCurrency" component={SelectCurrencyScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="AiChat" component={AiChatScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
      <NotificationSheet visible={notifPrompt} onClose={() => setNotifPrompt(false)} />
      </React.Fragment>
    </NavigationContainer>
    {locked && (
      // Opaque, topmost layer. Sheets are AppModals and unmount while locked,
      // so this is the only passcode / fingerprint surface on screen.
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: theme.background }]}>
        <LockScreen onUnlock={unlock} />
      </View>
    )}
    </View>
  );
}
