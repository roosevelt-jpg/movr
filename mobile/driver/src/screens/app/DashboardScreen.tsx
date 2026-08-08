import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import DriverHomeScreen from './DriverHomeScreen';
import IncomingRideRequestScreen from './IncomingRideRequestScreen';
import ActiveRideScreen from './ActiveRideScreen';
import DriverEarningsScreen from './DriverEarningsScreen';
import SettlementHubScreen from './SettlementHubScreen';
import VerificationStatusScreen from './VerificationStatusScreen';
import WithdrawEarningsScreen from './WithdrawEarningsScreen';

/**
 * Driver dashboard host — Home map (mockup), incoming offer overlay, active nav, earnings.
 */
export default function DashboardScreen(props: {
  onWithdraw?: () => void;
  onDemand?: () => void;
  onVehicle?: () => void;
  onPerformance?: () => void;
  onSubscription?: () => void;
}) {
  const [mode, setMode] = useState<
    'home' | 'offer' | 'nav' | 'earnings' | 'settlement' | 'withdraw' | 'verify'
  >('home');
  const [offerId, setOfferId] = useState<string | undefined>();
  const [rideId, setRideId] = useState<string | undefined>();

  if (mode === 'offer') {
    return (
      <IncomingRideRequestScreen
        offerId={offerId}
        onAccepted={(id) => {
          setRideId(id);
          setMode('nav');
        }}
        onDeclined={() => setMode('home')}
      />
    );
  }

  if (mode === 'nav') {
    return (
      <ActiveRideScreen
        rideId={rideId}
        onArrived={() => setMode('home')}
      />
    );
  }

  if (mode === 'settlement') {
    return (
      <View style={styles.root}>
        <SettlementHubScreen onBack={() => setMode('earnings')} />
      </View>
    );
  }

  if (mode === 'verify') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setMode('withdraw')} style={{ padding: 16 }}>
          <Text style={{ color: '#a1a1aa' }}>← Withdraw</Text>
        </Pressable>
        <VerificationStatusScreen />
      </View>
    );
  }

  if (mode === 'withdraw') {
    return (
      <View style={styles.root}>
        <WithdrawEarningsScreen
          onBack={() => setMode('earnings')}
          onVerify={() => setMode('verify')}
        />
      </View>
    );
  }

  if (mode === 'earnings') {
    return (
      <View style={styles.root}>
        <DriverEarningsScreen
          onWithdraw={() => setMode('withdraw')}
          onSettlement={() => setMode('settlement')}
          onDemand={props.onDemand}
          onVehicle={props.onVehicle}
          onPerformance={props.onPerformance}
          onSubscription={props.onSubscription}
        />
      </View>
    );
  }

  return (
    <DriverHomeScreen
      {...props}
      onWithdraw={() => setMode('withdraw')}
      onEarnings={() => setMode('earnings')}
      onOffer={(id) => {
        setOfferId(id);
        setMode('offer');
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
