import { registerRootComponent } from 'expo';
import App from './App';

try {
  require('../driver/src/lib/location-task').defineDriverLocationTask();
} catch {
  /* optional if expo-task-manager is missing */
}

registerRootComponent(App);
