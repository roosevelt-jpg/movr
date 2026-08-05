import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, TextInput, ScrollView } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import RecordingNoticeModal from './RecordingNoticeModal';

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

/**
 * Customer active ride — masked call/chat, live share, rider SOS + Call Police.
 */
export default function ActiveRideScreen({
  rideId,
  onComplete,
}: {
  rideId?: string;
  onComplete?: () => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [proxy, setProxy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState('');
  const [messages, setMessages] = useState<{ body: string; mine?: boolean }[]>([]);
  const [shareUrl, setShareUrl] = useState('');
  const [sosMsg, setSosMsg] = useState('');
  const [snapshot, setSnapshot] = useState<any>(null);
  const [emergencyTel, setEmergencyTel] = useState('tel:191');
  const [noticeAcked, setNoticeAcked] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    setNoticeAcked(false);
    fetch(`${API}/rides/${rideId}/masked-session`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.customerProxyNumber) setProxy(j.data.customerProxyNumber);
      })
      .catch(() => undefined);
  }, [rideId]);

  const shareTrip = async () => {
    if (!rideId) return;
    const res = await fetch(`${API}/rides/${rideId}/share-link`, { headers: authHeaders() });
    const json = await res.json();
    if (json?.data?.url) {
      setShareUrl(json.data.url);
      Linking.openURL(json.data.url).catch(() => undefined);
    }
  };

  const sendChat = async () => {
    if (!rideId || !chatBody.trim()) return;
    const body = chatBody.trim();
    setMessages((m) => [...m, { body, mine: true }]);
    setChatBody('');
    await fetch(`${API}/rides/${rideId}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    }).catch(() => undefined);
  };

  const triggerSos = async () => {
    if (!rideId) return;
    setSosMsg('');
    try {
      const res = await fetch(`${API}/sos/trigger`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rideId,
          triggeredBy: 'rider',
          lat: null,
          lng: null,
        }),
      });
      const json = await res.json();
      if (json?.data) {
        setSnapshot(json.data.snapshot);
        if (json.data.quickDial) setEmergencyTel(json.data.quickDial);
        setSosMsg('SOS active — contacts & ops notified');
      } else {
        setSosMsg(json.message || 'SOS failed');
      }
    } catch (e: any) {
      setSosMsg(e.message || 'SOS failed');
    }
  };

  return (
    <View style={styles.root}>
      {rideId ? (
        <RecordingNoticeModal
          visible={!noticeAcked}
          rideId={rideId}
          onAcknowledged={() => setNoticeAcked(true)}
        />
      ) : null}

      <View style={styles.map}>
        <Text style={styles.mapLabel}>Live trip</Text>
        <Pressable style={styles.sos} onPress={triggerSos}>
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => Linking.openURL(`tel:${proxy || '+233000000000'}`)}
        >
          <Text style={styles.iconGlyph}>📞</Text>
          <Text style={styles.iconLabel}>Call</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => setChatOpen((v) => !v)}>
          <Text style={styles.iconGlyph}>💬</Text>
          <Text style={styles.iconLabel}>Chat</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={shareTrip}>
          <Text style={styles.iconGlyph}>↗</Text>
          <Text style={styles.iconLabel}>Share</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => Linking.openURL(emergencyTel)}>
          <Text style={styles.iconGlyph}>🚓</Text>
          <Text style={styles.iconLabel}>Police</Text>
        </Pressable>
      </View>

      <Text style={styles.privacy}>Calls are number-masked for this ride</Text>
      {shareUrl ? <Text style={styles.share}>{shareUrl}</Text> : null}
      {sosMsg ? <Text style={styles.sosMsg}>{sosMsg}</Text> : null}

      {snapshot?.vehicle ? (
        <View style={styles.snap}>
          <Text style={styles.snapTitle}>Incident snapshot</Text>
          <Text style={styles.snapLine}>
            Vehicle · {snapshot.vehicle.document_number || snapshot.vehicle.plate || '—'}
          </Text>
          <Text style={styles.snapLine}>
            Status · {String(snapshot.vehicle.verified ? 'Verified' : 'Pending')}
          </Text>
        </View>
      ) : null}

      {chatOpen ? (
        <View style={styles.chat}>
          <ScrollView style={{ maxHeight: 120 }}>
            {messages.map((m, i) => (
              <Text key={i} style={[styles.chatMsg, m.mine && styles.chatMine]}>
                {m.body}
              </Text>
            ))}
          </ScrollView>
          <View style={styles.chatRow}>
            <TextInput
              style={styles.chatInput}
              value={chatBody}
              onChangeText={setChatBody}
              placeholder="Message driver…"
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable onPress={sendChat}>
              <Text style={styles.send}>Send</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {onComplete ? (
        <Pressable style={styles.cta} onPress={onComplete}>
          <Text style={styles.ctaText}>End ride</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.jetBlack, padding: spacing[4] },
  map: {
    flex: 1,
    minHeight: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLabel: { color: colors.textSecondary },
  sos: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sosText: { color: colors.pureWhite, fontWeight: '800', letterSpacing: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing[2] },
  iconBtn: { alignItems: 'center', gap: 4 },
  iconGlyph: { fontSize: 20 },
  iconLabel: { color: colors.textSecondary, fontSize: 11 },
  privacy: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: 8 },
  share: { color: colors.motionBlue, fontSize: 11, textAlign: 'center', marginBottom: 8 },
  sosMsg: { color: colors.error, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  snap: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  snapTitle: { color: colors.pureWhite, fontWeight: '700', marginBottom: 4 },
  snapLine: { color: colors.textSecondary, fontSize: 13 },
  chat: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  chatMsg: { color: colors.textSecondary, marginBottom: 4 },
  chatMine: { color: colors.pureWhite, textAlign: 'right' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.pureWhite,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  send: { color: colors.motionBlue, fontWeight: '700' },
  cta: {
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaText: { color: colors.pureWhite, fontWeight: '700' },
});
}
