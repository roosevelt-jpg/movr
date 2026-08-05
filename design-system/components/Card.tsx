import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { radius, spacing } from '../theme';
import { useThemeColors } from '../ThemeProvider';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing[4],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default Card;
