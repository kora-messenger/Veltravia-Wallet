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
import { showToast } from '../components/Toast';
import { registerScanTarget } from '../services/scanTarget';
import type { NavigationContainerRef } from '@react-navigation/native';
import WalletsScreen from '../screens/wallet/WalletsScreen';
import NameWalletScreen from '../screens/wallet/NameWalletScreen';
import ImportWalletScreen from '../screens/wallet/ImportWalletScreen';
import ManageAccountScreen from '../screens/wallet/ManageAccountScreen';
import BalanceDetailsScreen from '../screens/wallet/BalanceDetailsScreen';
import AiChatScreen from '../screens/ai/AiChatScreen';
import PasscodeScreen from '../screens/onboarding/PasscodeScreen';
import SecretPhraseScreen from '../screens/wallet/SecretPhraseScreen';
import { walletManager } from '../core/wallet/walletManager';
import { parsePairingCode } from '../core/security/pairingSession';
import SelectRecoveryMethodScreen from '../screens/SelectRecoveryMethodScreen';
import BuyScreen from '../features/buy/BuyScreen';
import SelectCurrencyScreen from '../features/buy/SelectCurrencyScreen';
import AddressBookScreen from '../screens/AddressBookScreen';
import PerpsScreen from '../screens/PerpsScreen';
import { loadPerpsAccounts } from '../services/perpsAccount';
import PerpsAboutScreen from '../screens/PerpsAboutScreen';
import PerpsMenuScreen from '../screens/PerpsMenuScreen';
import PerpsDepositScreen from '../screens/PerpsDepositScreen';
import PerpsWithdrawScreen from '../screens/PerpsWithdrawScreen';
import PerpsSearchScreen from '../screens/PerpsSearchScreen';
import PerpsMarketScreen from '../screens/PerpsMarketScreen';
import DevicesScreen from '../screens/wallet/DevicesScreen';
import PairVerifyScreen from '../screens/wallet/PairVerifyScreen';
import PerpsTradeScreen from '../screens/PerpsTradeScreen';
import PerpsPayWithScreen from '../screens/PerpsPayWithScreen';
import PerpsActivityScreen from '../screens/PerpsActivityScreen';
import PerpsVenueScreen from '../screens/PerpsVenueScreen';
import { loadVenuePrefs } from '../services/perpsVenues';
import TokensScreen from '../screens/TokensScreen';
import SelectNetworkScreen from '../screens/SelectNetworkScreen';
import ManageCryptoScreen from '../screens/ManageCryptoScreen';
import ImportCryptoScreen from '../screens/ImportCryptoScreen';
import ScanQrScreen from '../screens/ScanQrScreen';
import NotificationSheet from '../components/NotificationSheet';
import LockScreen from '../screens/LockScreen';
import { setAppLocked } from '../core/security/appLockState';
import { registerBrowserNavigator } from '../services/browserState';
import BrowserScreen from '../screens/BrowserScreen';
import { setPasscode, hasPasscode } from '../core/storage/passcode';
import { setBiometricUnlockEnabled } from '../core/security/biometrics';
import { AppState, StyleSheet } from 'react-native';

const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();
// Any code can open a link in the in-app browser via openInBrowser(url).
registerBrowserNavigator({
  navigate: (name: string, params?: any) => (navigationRef.current as any)?.navigate(name, params),
});

/**
 * Drop the whole stack and land on the welcome screen. Used when this device has
 * been removed from its wallet group: there is no wallet here any more.
 */
export function resetToWelcome(): void {
  navigationRef.current?.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
}

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
  SecretPhrase: undefined;
  MainTabs: undefined;
  Wallets: undefined;
  NameWallet: { origin?: 'created' | 'imported' } | undefined;
  ImportWallet: undefined;
  SelectRecoveryMethod: undefined;
  ManageAccount: { walletId: string };
  Activity: undefined;
  Discover: undefined;
  Browser: { tabId: string; url: string };
  BalanceDetails: undefined;
  AiChat: { mode?: 'support' | 'fresh' } | undefined;
  Buy: { pickedCurrency?: string } | undefined;
  SelectCurrency: { selected?: string } | undefined;
  Settings: undefined;
  ManageCrypto: undefined;
  ImportCrypto: undefined;
  ScanQr: undefined;
  SelectNetwork: undefined;
  AddressBook: undefined;
  Perps: undefined;
  PerpsMenu: undefined;
  PerpsAbout: undefined;
  PerpsDeposit: { mode: 'deposit' | 'withdraw' };
  PerpsWithdraw: undefined;
  PerpsSearch: { mode?: 'long' | 'short' } | undefined;
  PerpsTrade: { venue: 'hyperliquid' | 'aster'; symbol: string; side: 'long' | 'short' };
  PerpsPayWith: { venue: 'hyperliquid' | 'aster' };
  PerpsMarket: { venue: 'hyperliquid' | 'aster'; symbol: string };
  Devices: undefined;
  PairVerify: { uri: string };
  PerpsActivity: undefined;
  PerpsVenue: { venue: 'hyperliquid' | 'aster' };
};

export type MainTabParamList = {
  Home: undefined;
  Markets: undefined;
  Swap: undefined;
  Perps: undefined;
  Tokens: undefined;
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
      <Tabs.Screen name="Perps" component={PerpsScreen} />
      <Tabs.Screen name="Tokens" component={TokensScreen} />
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
  // Current top route: the QR scanner stays reachable while the app is
  // locked (Trust parity) — the lock overlay skips the ScanQr route.
  const [routeName, setRouteName] = React.useState<string>('');
  const [booted, setBooted] = React.useState(false);
  const [walletExists, setWalletExists] = React.useState(false);
  // Cached passcode state so the background lock is SYNCHRONOUS. Reading the
  // keychain first leaves a window where the app resumes straight into the
  // screen the user left (e.g. the share view) with only the OS fingerprint
  // dialog over it — the lock screen must already be painted when we return.
  const hasPassRef = React.useRef(false);

  // Perps account balances (separate from the main wallet) load once at startup.
  React.useEffect(() => { loadPerpsAccounts(); loadVenuePrefs(); }, []);

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
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => setRouteName((navigationRef.current?.getCurrentRoute()?.name ?? '') as string)}
    >
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
              onAutoLoadDone={async (which: 'create' | 'import') => {
                if (which === 'create') {
                  // Trust's order, matched here: creating a wallet lands on Home.
                  // The phrase is generated and stored now, silently, and is shown
                  // later on demand (Wallets → manage → Show secret phrase).
                  try {
                    await walletManager.createWallet();
                  } catch {
                    // No CSPRNG / no keystore on this device: do not pretend a
                    // wallet exists. The welcome screen stays up.
                    return;
                  }
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
        <Stack.Screen name="SecretPhrase" options={{ animation: 'slide_from_right', gestureEnabled: false }}>
          {() => (
            <SecretPhraseScreen
              onBack={() => {
                // Leaving drops the words from memory with the component.
                navigationRef.current?.goBack();
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
              // Pair device: scan the code an existing device shows (Manage account
              // → Pair a new device), so this phone joins the wallet group.
              onPairDevice={() => {
                const off = registerScanTarget(
                  async (value) => {
                    off();
                    // Scanning only identifies the session. The six digits are typed
                    // on the verify screen, and the wallet lands only after they match.
                    navigationRef.current?.navigate('PairVerify', { uri: value });
                  },
                  undefined,
                  {
                    title: 'Scan pairing code',
                    // Checked here, not after navigating, so a wrong code never
                    // gets as far as the six-digit screen.
                    accept: (value) =>
                      parsePairingCode(value).ok
                        ? { ok: true as const, value }
                        : { ok: false as const, reason: "That isn't a valid Veltravia pairing code." },
                  },
                );
                navigationRef.current?.navigate('ScanQr');
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
        <Stack.Screen name="Discover" component={DiscoverScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="Browser" component={BrowserScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="BalanceDetails" component={BalanceDetailsScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Buy" component={BuyScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="SelectCurrency" component={SelectCurrencyScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ManageCrypto" component={ManageCryptoScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ImportCrypto" component={ImportCryptoScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ScanQr" component={ScanQrScreen} options={{ animation: 'fade', gestureEnabled: false, headerShown: false }} />
      <Stack.Screen name="SelectNetwork" component={SelectNetworkScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AddressBook" component={AddressBookScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PerpsMenu" component={PerpsMenuScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PerpsAbout" component={PerpsAboutScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PerpsDeposit" component={PerpsDepositScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PerpsSearch" component={PerpsSearchScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="PerpsMarket" component={PerpsMarketScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Devices" component={DevicesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PairVerify" options={{ animation: 'slide_from_right', gestureEnabled: false }}>
        {(props) => (
          <PairVerifyScreen
            uri={(props.route.params as { uri: string }).uri}
            onCancel={() => navigationRef.current?.goBack()}
            onOpenWallet={() => {
              // The wallet exists on this device now: land on the wallets list.
              navigationRef.current?.navigate('MainTabs');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="PerpsTrade" component={PerpsTradeScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PerpsPayWith" component={PerpsPayWithScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PerpsActivity" component={PerpsActivityScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="PerpsWithdraw"
        component={PerpsWithdrawScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen name="PerpsVenue" component={PerpsVenueScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="AiChat" component={AiChatScreen} options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
      <NotificationSheet visible={notifPrompt} onClose={() => setNotifPrompt(false)} />
      </React.Fragment>
    </NavigationContainer>
    {locked && routeName !== 'ScanQr' && (
      // Opaque, topmost layer. Sheets are AppModals and unmount while locked,
      // so this is the only passcode / fingerprint surface on screen.
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: theme.background }]}>
        <LockScreen
          onUnlock={unlock}
          onScan={() => (navigationRef.current as any)?.navigate('ScanQr')}
        />
      </View>
    )}
    </View>
  );
}
