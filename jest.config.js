module.exports = {
  preset: '@react-native/jest-preset',
  // React Navigation v7 ships ES modules; let Babel transform them so
  // tests that mount the navigator (App.test) can load.
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
