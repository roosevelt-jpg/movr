import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import DriverHomeScreen from './DriverHomeScreen';
import IncomingRideRequestScreen from './IncomingRideRequestScreen';
import ActiveRideScreen from './ActiveRideScreen';
import DriverEarningsScreen from './DriverEarningsScreen';
import SettlementHubScreen from './SettlementHubScreen';

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
  const [mode, setMode] = useState<'home' | 'offer' | 'nav' | 'earnings' | 'settlement'>('home');
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

  if (mode === 'earnings') {
    return (
      <View style={styles.root}>
        <DriverEarningsScreen
          onWithdraw={props.onWithdraw}
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
