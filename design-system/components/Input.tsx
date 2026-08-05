import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { radius, spacing } from '../theme';
import { useThemeColors } from '../ThemeProvider';

interface InputProps extends TextInputProps {
  label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
  const colors = useThemeColors();
  return (
    <View style={{ width: '100%', marginBottom: spacing[3] }}>
      {label ? (
        <Text style={{ color: colors.textSecondary, marginBottom: spacing[2], fontSize: 13 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          {
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.textPrimary,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
            fontSize: 16,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export default Input;
