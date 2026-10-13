import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { WalletsProvider } from './src/wallets/WalletsProvider';
import Navigation from './src/navigation/Navigation';
import { ToastHost } from './src/components/Toast';

export default function App(): React.JSX.Element {
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
