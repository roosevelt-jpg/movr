import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Phase 7 — mobile staking */
export default function StakingScreen() {
  const [pools, setPools] = useState<any[]>([]);
  const [stakes, setStakes] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      fetch(`${API}/staking/pools`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/staking/my-stakes`).then((r) => r.json()).catch(() => null),
    ]).then(([p, s]) => {
      if (p?.data) setPools(p.data);
      if (s?.data?.stakes) setStakes(s.data.stakes);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const stakeFirst = async () => {
    if (!pools[0]) return;
    const res = await fetch(`${API}/staking/stake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId: pools[0].id, amount: Number(amount) }),
    });
    const json = await res.json();
    setMsg(json.message || (res.ok ? 'Staked' : 'Failed'));
    load();
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Staking</Text>
      <TextInput
        style={styles.input}
        placeholder="Amount (DVT)"
        placeholderTextColor={colors.textSecondary}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Pressable style={styles.btn} onPress={stakeFirst}>
        <Text style={styles.btnText}>Stake in first pool</Text>
      </Pressable>
      {!!msg && <Text style={styles.msg}>{msg}</Text>}
      <Text style={styles.section}>Pools</Text>
      <FlatList
        data={pools}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{item.name}</Text>
            <Text style={styles.rowValue}>{item.target_role}</Text>
          </View>
        )}
      />
      <Text style={styles.section}>My stakes</Text>
      <FlatList
        data={stakes}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{item.pool_name}</Text>
            <Text style={styles.rowValue}>{Number(item.amount).toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700', marginBottom: spacing[3] },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.pureWhite,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  btn: {
    backgroundColor: colors.forestGreen || colors.movrGreen,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  btnText: { color: colors.pureWhite, fontWeight: '700' },
  msg: { color: colors.textSecondary, marginBottom: spacing[2] },
  section: { color: colors.pureWhite, fontWeight: '700', marginTop: spacing[4], marginBottom: spacing[2] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, flex: 1 },
  rowValue: { color: colors.pureWhite, fontWeight: '600' },
});
