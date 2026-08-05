import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from 'react-native';
import { colors, spacing, radius } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** Phase 5B — mobile Token screen */
export default function TokenScreen() {
  const [balance, setBalance] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      fetch(`${API}/token/balance`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/token/history`).then((r) => r.json()).catch(() => null),
    ]).then(([b, h]) => {
      if (b?.data) setBalance(b.data);
      if (h?.data) setHistory(h.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const redeem = async () => {
    const res = await fetch(`${API}/token/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    const json = await res.json();
    setMsg(json.message || (res.ok ? 'Redeemed' : 'Failed'));
    if (res.ok) load();
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>DriveToken</Text>
      <Text style={styles.balance}>{balance?.total?.toFixed?.(2) ?? '—'}</Text>
      <Text style={styles.sub}>
        Pending {balance?.pending ?? 0} · On-chain {balance?.onchain ?? 0}
      </Text>
      <View style={styles.rowInput}>
        <TextInput
          style={styles.input}
          placeholder="Redeem amount"
          placeholderTextColor={colors.textSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Pressable style={styles.btn} onPress={redeem}>
          <Text style={styles.btnText}>Redeem</Text>
        </Pressable>
      </View>
      {!!msg && <Text style={styles.msg}>{msg}</Text>}
      <FlatList
        data={history}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{item.activity_type}</Text>
            <Text style={styles.rowValue}>{Number(item.dvt_amount).toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  title: { color: colors.pureWhite, fontSize: 22, fontWeight: '700' },
  balance: { color: colors.pureWhite, fontSize: 40, fontWeight: '700', marginVertical: spacing[2] },
  sub: { color: colors.textSecondary, marginBottom: spacing[4] },
  rowInput: { flexDirection: 'row', gap: 8, marginBottom: spacing[3] },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.pureWhite,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  btn: {
    backgroundColor: colors.electricViolet,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
  },
  btnText: { color: colors.pureWhite, fontWeight: '700' },
  msg: { color: colors.textSecondary, marginBottom: spacing[3] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary },
  rowValue: { color: colors.pureWhite, fontWeight: '600' },
});
