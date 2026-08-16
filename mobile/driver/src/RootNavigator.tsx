import React, { useCallback, useEffect, useState } from 'react';
import LoginScreen from './screens/auth/LoginScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';
import OtpVerifyScreen from './screens/auth/OtpVerifyScreen';
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen';
import DashboardScreen from './screens/app/DashboardScreen';
import { hydrateAuthToken, persistAuthToken } from './lib/token';
import { registerPushForApp, unregisterPush } from './lib/push';
import { stopOnlineLocationUpdates } from './lib/location';

type Route =
  | { name: 'boot' }
  | { name: 'login'; identifier?: string }
  | { name: 'forgot' }
  | { name: 'otp'; identifier: string; firebasePhone?: boolean }
  | { name: 'reset'; resetToken: string; identifier: string }
  | { name: 'home' };

/** Login, forgot/reset password, then driver dashboard. */
export default function RootNavigator() {
  const [route, setRoute] = useState<Route>({ name: 'boot' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await hydrateAuthToken();
      if (cancelled) return;
      setRoute(token ? { name: 'home' } : { name: 'login' });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (route.name === 'home') registerPushForApp('driver');
  }, [route.name]);

  const signOut = useCallback(async () => {
    await stopOnlineLocationUpdates();
    await unregisterPush();
    await persistAuthToken(null);
    setRoute({ name: 'login' });
  }, []);

  if (route.name === 'boot') return null;

  if (route.name === 'login') {
    return (
      <LoginScreen
        initialIdentifier={route.identifier}
        onSuccess={() => setRoute({ name: 'home' })}
        onForgot={() => setRoute({ name: 'forgot' })}
      />
    );
  }

  if (route.name === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={() => setRoute({ name: 'login' })}
        onSent={(identifier, _devCode, firebasePhone) =>
          setRoute({ name: 'otp', identifier, firebasePhone })
        }
      />
    );
  }

  if (route.name === 'otp') {
    return (
      <OtpVerifyScreen
        identifier={route.identifier}
        purpose="reset"
        firebasePhone={route.firebasePhone}
        onBack={() => setRoute({ name: 'forgot' })}
        onVerified={(payload) => {
          if (!payload?.resetToken) {
            setRoute({ name: 'forgot' });
            return;
          }
          setRoute({
            name: 'reset',
            resetToken: payload.resetToken,
            identifier: route.identifier,
          });
        }}
      />
    );
  }

  if (route.name === 'reset') {
    return (
      <ResetPasswordScreen
        resetToken={route.resetToken}
        identifier={route.identifier}
        onBack={() => setRoute({ name: 'login', identifier: route.identifier })}
        onDone={() => setRoute({ name: 'login', identifier: route.identifier })}
      />
    );
  }

  return <DashboardScreen onSignOut={signOut} />;
}
