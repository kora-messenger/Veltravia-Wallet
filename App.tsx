import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { WalletsProvider } from './src/wallets/WalletsProvider';
import Navigation from './src/navigation/Navigation';
import { ToastHost } from './src/components/Toast';
import { refreshWalletLocks } from './src/core/security/walletLock';
import { registerRemovalHandler, refreshRegistryLock } from './src/core/security/lockRegistry';
import { handleDeviceRemoved } from './src/core/security/deviceRemoval';
import { resetToWelcome } from './src/navigation/Navigation';
import { checkForUpdate, confirmBoot } from './src/core/ota';

/**
 * Boot: load the local lock flags and re-read the cross-device lock registry.
 *
 * The registry read is what makes a wallet recovered on THIS device know it was
 * locked somewhere else. It never blocks the UI (the guards read cached state),
 * and a backend that cannot be reached leaves the last cached answer in place.
 */
function useLockSyncOnLaunch(): void {
  useEffect(() => {
    // A device unlinked from its wallet group wipes itself and returns to the
    // welcome screen, wherever the discovery happened.
    registerRemovalHandler(async () => {
      await handleDeviceRemoved();
      resetToWelcome();
    });
    (async () => {
      try {
        await refreshWalletLocks();
        await refreshRegistryLock();
      } catch {
        /* offline: cached flags still apply */
      }
    })();
  }, []);
}

/**
 * Over-the-air JavaScript updates (see src/core/ota).
 *
 * `confirmBoot` runs first and unconditionally: the app rendered, so the bundle
 * the native side loaded is good and its boot counter can be reset. Without it,
 * a perfectly healthy update would be rolled back after three launches.
 *
 * The check itself is silent and never blocks: it installs the next signed
 * bundle in the background and the following cold start picks it up.
 */
function useOta(): void {
  useEffect(() => {
    confirmBoot();
    const t = setTimeout(() => { checkForUpdate().catch(() => {}); }, 4000);
    return () => clearTimeout(t);
  }, []);
}

function App(): React.JSX.Element {
  useOta();
  useLockSyncOnLaunch();
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WalletsProvider>
          <Navigation />
          <ToastHost />
        </WalletsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
