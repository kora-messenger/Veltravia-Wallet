/**
 * @format
 */

// Must run before anything that needs randomness (seed generation, nonces).
import './src/core/crypto/csprngInstall';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
