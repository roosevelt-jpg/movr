import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { radius, spacing } from '../theme';
import { useThemeColors } from '../ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: ButtonProps) {
  const colors = useThemeColors();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: spacing[5],
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        isPrimary && { backgroundColor: colors.electricViolet },
        variant === 'secondary' && {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.textPrimary,
        },
        isGhost && { backgroundColor: 'transparent' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text
          style={[
            { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
            variant === 'secondary' && { color: colors.textPrimary },
            isGhost && { color: colors.motionBlue },
          ]}
        >
          {label}
        </Text>
      )}
      {isPrimary ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.motionBlue,
            opacity: 0.25,
          }}
        />
      ) : null}
    </Pressable>
  );
}

export default Button;
