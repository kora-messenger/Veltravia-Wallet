// Native modules that don't exist under Jest. Mocked so tests that mount the
// whole app tree (App.test) can load. Pure-JS unit tests are unaffected.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(() => jest.fn()),
  },
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('react-native-config', () => ({ Config: {}, default: {} }));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  ACCESS_CONTROL: {},
  SECURITY_LEVEL: {},
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-webview', () => ({ WebView: 'WebView', default: 'WebView' }));

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => ({ id: 'back' }),
  useCodeScanner: () => ({ codeTypes: ['qr'], onCodeScanned: jest.fn() }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ assets: [] })),
}));
