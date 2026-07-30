import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme';

export function LoadingSpinner() {
  return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <ActivityIndicator color={colors.electricViolet} />
    </View>
  );
}

export default LoadingSpinner;
