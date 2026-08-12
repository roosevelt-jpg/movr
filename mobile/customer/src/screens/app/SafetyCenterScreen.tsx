import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert,
  Linking,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Safety Center — SOS hold, share trip, contacts, emergency dial, record (mockup). */
export default function SafetyCenterScreen({ onBack }: { onBack?: () => void }) {
  const [holdSeconds] = useState(3);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [contactsCount, setContactsCount] = useState(3);
  const [emergencyDisplay, setEmergencyDisplay] = useState('199 / 112');
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAt = useRef(0);

  const load = () => {
    fetch(`${API}/safety/center`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setContactsCount(Number(j.data.contactsCount || 3));
          if (j.data.emergencyNumbers?.display) setEmergencyDisplay(j.data.emergencyNumbers.display);
          setRecording(Boolean(j.data.recording?.active));
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const clearHold = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setHoldProgress(0);
  };

  const triggerSos = async () => {
    clearHold();
    try {
      const res = await fetch(`${API}/safety/sos`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setMsg(json?.data?.message || 'Emergency alert sent');
      Alert.alert('SOS Sent', json?.data?.message || 'Contacts & Movr support notified');
    } catch {
      Alert.alert('SOS Sent', 'Emergency alert sent to contacts & Movr support');
    }
  };

  const onPressIn = () => {
    setHolding(true);
    startAt.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startAt.current) / (holdSeconds * 1000));
      setHoldProgress(p);
      if (p >= 1) triggerSos();
    }, 50);
  };

  const shareTrip = async () => {
    let url = 'https://mymovr.io/trip/share';
    try {
      let res = await fetch(`${API}/trust/share-trip`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      let json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        res = await fetch(`${API}/safety/share-trip`, {
          method: 'POST',
          headers: authHeaders(),
          body: '{}',
        });
        json = await res.json().catch(() => null);
      }
      url = json?.data?.publicUrl || json?.data?.shareUrl || url;
    } catch {
      /* use fallback */
    }
    await Share.share({ message: `Track my Movr trip: ${url}`, url });
  };

  const callEmergency = () => {
    const num = emergencyDisplay.split('/')[0].trim() || '199';
    Linking.openURL(`tel:${num}`).catch(() => undefined);
  };

  const toggleRecord = async () => {
    const res = await fetch(`${API}/safety/record-audio`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setRecording(Boolean(json?.data?.active));
    setMsg(json?.data?.message || (recording ? 'Recording saved' : 'Recording started'));
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Safety Center</Text>
      </View>
      <View style={styles.gradientLine} />

      <View style={styles.sosWrap}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={clearHold}
          style={[
            styles.sosOuter,
            holding && { borderColor: '#EF4444', transform: [{ scale: 1.02 }] },
          ]}
        >
          <View style={[styles.sosInner, { opacity: 0.85 + holdProgress * 0.15 }]}>
            <View style={styles.sosBox}>
              <Text style={styles.sosLabel}>SOS</Text>
            </View>
            <Text style={styles.sosWord}>sos</Text>
          </View>
        </Pressable>
        <Text style={styles.sosHint}>
          Hold {holdSeconds} seconds to send emergency alert to contacts & Movr support
        </Text>
        {holding ? (
          <Text style={styles.holdPct}>{Math.round(holdProgress * 100)}%</Text>
        ) : null}
      </View>

      <Card
        icon="📍"
        title="Share Trip Link"
        sub="Let trusted contacts track your journey"
        action="Share"
        actionColor="#A78BFA"
        onAction={shareTrip}
      />
      <Card
        icon="👥"
        title="Trusted Contacts"
        sub={`${contactsCount} contacts added`}
        action="Edit"
        actionColor="#A78BFA"
        onAction={() => setMsg(`${contactsCount} trusted contacts`)}
      />
      <Card
        icon="🚓"
        title="Call Emergency Services"
        sub={`Directly dial ${emergencyDisplay}`}
        action="Call"
        actionColor="#EF4444"
        onAction={callEmergency}
      />
      <Pressable
        style={[styles.card, recording && styles.cardRecording]}
        onPress={toggleRecord}
      >
        <Text style={styles.cardIcon}>🎙</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Record Audio</Text>
          <Text style={styles.cardSub}>Silent recording stored to cloud</Text>
        </View>
        <View style={[styles.recDot, recording && styles.recDotOn]} />
      </Pressable>

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

function Card({
  icon,
  title,
  sub,
  action,
  actionColor,
  onAction,
}: {
  icon: string;
  title: string;
  sub: string;
  action: string;
  actionColor: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
      <Pressable onPress={onAction}>
        <Text style={[styles.cardAction, { color: actionColor }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: spacing[4] },
  back: { color: '#FFF', fontSize: 22 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  gradientLine: {
    height: 2,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: '#8E2DE2',
  },
  sosWrap: { alignItems: 'center', paddingVertical: spacing[6] },
  sosOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#450A0A55',
  },
  sosInner: { alignItems: 'center' },
  sosBox: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sosLabel: { color: '#FFF', fontWeight: '900', fontSize: 22, letterSpacing: 1 },
  sosWord: { color: '#FFF', marginTop: 8, fontWeight: '600', fontSize: 14 },
  sosHint: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    lineHeight: 20,
  },
  holdPct: { color: '#EF4444', marginTop: 8, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[3],
    marginBottom: 10,
    gap: 12,
  },
  cardRecording: { borderWidth: 1.5, borderColor: '#EF4444' },
  cardIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  cardTitle: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  cardSub: { color: '#71717A', fontSize: 12, marginTop: 3 },
  cardAction: { fontWeight: '700', fontSize: 14 },
  recDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  recDotOn: { backgroundColor: '#EF4444' },
  msg: { color: '#A1A1AA', textAlign: 'center', marginTop: spacing[3] },
});
