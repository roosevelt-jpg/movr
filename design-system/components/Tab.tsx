import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export type TabItem = { key: string; label: string };

/**
 * Gradient underline active tab — matches Ride/Shop/Deliver home tabs.
 */
export function Tab({
  items,
  activeKey,
  onChange,
}: {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.row}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            {active ? <View style={styles.underline} /> : <View style={styles.underlinePlaceholder} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing[4],
  },
  item: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.scale.caption.size,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.pureWhite,
    fontWeight: '600',
  },
  underline: {
    marginTop: spacing[2],
    height: 2,
    alignSelf: 'stretch',
    borderRadius: 999,
    backgroundColor: colors.motionBlue,
  },
  underlinePlaceholder: {
    marginTop: spacing[2],
    height: 2,
  },
});

export default Tab;
