import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { WalletsProvider } from './src/wallets/WalletsProvider';
import Navigation from './src/navigation/Navigation';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WalletsProvider>
          <Navigation />
        </WalletsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
