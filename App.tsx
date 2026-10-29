import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { WalletsProvider } from './src/wallets/WalletsProvider';
import Navigation from './src/navigation/Navigation';
import { ToastHost } from './src/components/Toast';
import { refreshWalletLocks } from './src/core/security/walletLock';
import { refreshRegistryLock } from './src/core/security/lockRegistry';

/**
 * Boot: load the local lock flags and re-read the cross-device lock registry.
 *
 * The registry read is what makes a wallet recovered on THIS device know it was
 * locked somewhere else. It never blocks the UI (the guards read cached state),
 * and a backend that cannot be reached leaves the last cached answer in place.
 */
function useLockSyncOnLaunch(): void {
  useEffect(() => {
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

function App(): React.JSX.Element {
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
