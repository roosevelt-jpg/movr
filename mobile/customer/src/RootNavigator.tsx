import React, { useCallback, useEffect, useState } from 'react';
import SplashScreen from './screens/auth/SplashScreen';
import OnboardingIntroScreen from './screens/auth/OnboardingIntroScreen';
import LoginScreen from './screens/auth/LoginScreen';
import SignupScreen from './screens/auth/SignupScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';
import OtpVerifyScreen from './screens/auth/OtpVerifyScreen';
import ResetPasswordScreen from './screens/auth/ResetPasswordScreen';
import ProfileSetupScreen from './screens/auth/ProfileSetupScreen';
import SuperAppHomeScreen from './screens/app/SuperAppHomeScreen';
import { hydrateAuthToken, persistAuthToken } from './lib/token';
import { registerPushForApp, unregisterPush } from './lib/push';

type Route =
  | { name: 'splash' }
  | { name: 'onboarding' }
  | { name: 'login'; identifier?: string }
  | { name: 'signup' }
  | { name: 'forgot' }
  | { name: 'otp'; identifier: string; purpose: 'reset' | 'signup'; devCode?: string; firebasePhone?: boolean }
  | { name: 'reset'; resetToken: string; identifier: string }
  | { name: 'profile' }
  | { name: 'home' };

/** Hosts login, forgot/reset password, and the super-app shell. */
export default function RootNavigator() {
  const [route, setRoute] = useState<Route>({ name: 'splash' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await hydrateAuthToken();
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        if (token) setRoute({ name: 'home' });
        else setRoute({ name: 'onboarding' });
      }, 900);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (route.name === 'home') {
      registerPushForApp('customer');
    }
  }, [route.name]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await persistAuthToken(null);
    setRoute({ name: 'login' });
  }, []);

  if (route.name === 'splash') return <SplashScreen />;

  if (route.name === 'onboarding') {
    return (
      <OnboardingIntroScreen
        onDone={() => setRoute({ name: 'signup' })}
        onSignIn={() => setRoute({ name: 'login' })}
      />
    );
  }

  if (route.name === 'login') {
    return (
      <LoginScreen
        initialIdentifier={route.identifier}
        onSuccess={() => setRoute({ name: 'home' })}
        onForgot={() => setRoute({ name: 'forgot' })}
        onCreate={() => setRoute({ name: 'signup' })}
      />
    );
  }

  if (route.name === 'signup') {
    return (
      <SignupScreen
        onSignIn={() => setRoute({ name: 'login' })}
        onSuccess={(phone, token) => {
          if (token) setRoute({ name: 'profile' });
          else setRoute({ name: 'otp', identifier: phone, purpose: 'signup' });
        }}
      />
    );
  }

  if (route.name === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={() => setRoute({ name: 'login' })}
        onSent={(identifier, _devCode, firebasePhone) =>
          setRoute({ name: 'otp', identifier, purpose: 'reset', firebasePhone })
        }
      />
    );
  }

  if (route.name === 'otp') {
    return (
      <OtpVerifyScreen
        identifier={route.identifier}
        phone={route.identifier}
        purpose={route.purpose}
        firebasePhone={route.firebasePhone}
        onBack={() =>
          setRoute(route.purpose === 'reset' ? { name: 'forgot' } : { name: 'signup' })
        }
        onVerified={(payload) => {
          if (route.purpose === 'reset') {
            if (!payload?.resetToken) {
              setRoute({ name: 'forgot' });
              return;
            }
            setRoute({
              name: 'reset',
              resetToken: payload.resetToken,
              identifier: route.identifier,
            });
            return;
          }
          setRoute({ name: 'profile' });
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

  if (route.name === 'profile') {
    return <ProfileSetupScreen onContinue={() => setRoute({ name: 'home' })} />;
  }

  return <SuperAppHomeScreen onSignOut={signOut} />;
}
