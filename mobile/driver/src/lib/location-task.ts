import { DRIVER_LOCATION_TASK, postDriverLocation } from './location';

/**
 * Must run from the Expo host entry (driver-app/index.js) so the location
 * foreground-service task is registered in the JS bundle global scope.
 */
export function defineDriverLocationTask() {
  let TaskManager: any = null;
  try {
    TaskManager = require('expo-task-manager');
  } catch {
    return;
  }
  if (!TaskManager?.defineTask) return;
  try {
    TaskManager.defineTask(DRIVER_LOCATION_TASK, ({ data, error }: any) => {
      if (error || !data?.locations?.length) return;
      const loc = data.locations[data.locations.length - 1];
      if (!loc?.coords) return;
      postDriverLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        heading: loc.coords.heading,
        speed: loc.coords.speed,
      }).catch(() => undefined);
    });
  } catch {
    /* already defined in Fast Refresh */
  }
}
