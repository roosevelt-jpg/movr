import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, TextInput, ScrollView, Image } from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { formatCurrency } from '@movr/design-system/format';
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
 * Customer active ride — map + ETA/SOS, driver card, Share/Route, fare footer.
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

  const [ride, setRide] = useState<any>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState('');
  const [messages, setMessages] = useState<{ body: string; mine?: boolean }[]>([]);
  const [shareUrl, setShareUrl] = useState('');
  const [sosMsg, setSosMsg] = useState('');
  const [emergencyTel, setEmergencyTel] = useState('tel:191');
  const [noticeAcked, setNoticeAcked] = useState(false);

  const loadRide = async () => {
    if (!rideId) return;
    const res = await fetch(`${API}/rides/${rideId}`, { headers: authHeaders() });
    const json = await res.json();
    if (json?.data) setRide(json.data);
  };

  useEffect(() => {
    if (!rideId) return;
    setNoticeAcked(false);
    loadRide().catch(() => undefined);
    const t = setInterval(() => {
      loadRide().catch(() => undefined);
    }, 8000);
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
    return () => clearInterval(t);
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

  const openRoute = () => {
    const d = ride?.dropoff;
    if (d?.lat != null && d?.lng != null) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`
      ).catch(() => undefined);
      return;
    }
    const q = encodeURIComponent(ride?.destinationName || ride?.dropoff?.address || '');
    if (q) Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => undefined);
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
          lat: ride?.pickup?.lat ?? null,
          lng: ride?.pickup?.lng ?? null,
        }),
      });
      const json = await res.json();
      if (json?.data) {
        if (json.data.quickDial) setEmergencyTel(json.data.quickDial);
        setSosMsg('SOS active — contacts & ops notified');
      } else {
        setSosMsg(json.message || 'SOS failed');
      }
    } catch (e: any) {
      setSosMsg(e.message || 'SOS failed');
    }
  };

  const driver = ride?.driver;
  const eta = Number(ride?.etaMinutes ?? 6);
  const fare = Number(ride?.fare ?? 0);
  const dest = ride?.destinationName || ride?.dropoff?.address || 'Destination';
  const plate = driver?.vehicle?.plate || '—';
  const model = driver?.vehicle?.model || 'Vehicle';
  const rating = Number(driver?.rating ?? 4.9).toFixed(1);
  const driverLine = `${plate} · ${model} · ★ ${rating}`;

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
        <View style={styles.gridOverlay} />
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>ETA {eta} min</Text>
        </View>
        <Pressable style={styles.sos} onPress={triggerSos}>
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
        <View style={[styles.dot, styles.dotWhite, { top: '28%', left: '22%' }]} />
        <View style={[styles.dotRing, { bottom: '22%', right: '18%' }]}>
          <View style={styles.dotBlue} />
        </View>
      </View>

      <View style={styles.driverCard}>
        <View style={styles.driverRow}>
          {driver?.avatarUrl ? (
            <Image source={{ uri: driver.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{driver?.name || 'Finding driver…'}</Text>
            <Text style={styles.driverMeta}>{driver ? driverLine : 'Assigning vehicle'}</Text>
          </View>
          <Pressable
            style={styles.squareBtn}
            onPress={() => Linking.openURL(`tel:${proxy || '+233000000000'}`)}
          >
            <Text style={styles.squareGlyph}>📞</Text>
          </Pressable>
          <Pressable style={styles.squareBtn} onPress={() => setChatOpen((v) => !v)}>
            <Text style={styles.squareGlyph}>💬</Text>
          </Pressable>
        </View>

        <View style={styles.footerActions}>
          <Pressable style={styles.actionHalf} onPress={shareTrip}>
            <Text style={styles.actionHalfText}>↗  Share trip</Text>
          </Pressable>
          <Pressable style={styles.actionHalf} onPress={openRoute}>
            <Text style={styles.actionHalfText}>📍  Route</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.statusLine}>
        Arriving at {dest} · {formatCurrency(fare, ride?.currency || 'GHS')} fare
      </Text>

      {shareUrl ? <Text style={styles.share}>{shareUrl}</Text> : null}
      {sosMsg ? <Text style={styles.sosMsg}>{sosMsg}</Text> : null}

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
      minHeight: 220,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing[3],
      overflow: 'hidden',
    },
    gridOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.15,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    etaBadge: {
      position: 'absolute',
      top: spacing[3],
      left: spacing[3],
      backgroundColor: colors.jetBlack,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      zIndex: 2,
    },
    etaText: { color: colors.pureWhite, fontWeight: '700', fontSize: 13 },
    sos: {
      position: 'absolute',
      top: spacing[3],
      right: spacing[3],
      backgroundColor: '#F5B7B1',
      borderRadius: radius.pill,
      paddingHorizontal: 18,
      paddingVertical: 10,
      zIndex: 2,
    },
    sosText: { color: colors.jetBlack, fontWeight: '800', letterSpacing: 1 },
    dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
    dotWhite: { backgroundColor: colors.pureWhite },
    dotRing: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 3,
      borderColor: colors.motionBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotBlue: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.motionBlue,
    },
    driverCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing[4],
      marginBottom: spacing[3],
    },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
    },
    driverName: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
    driverMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
    squareBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    squareGlyph: { fontSize: 16 },
    footerActions: {
      flexDirection: 'row',
      gap: spacing[2],
      marginTop: spacing[4],
    },
    actionHalf: {
      flex: 1,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    actionHalfText: { color: colors.pureWhite, fontWeight: '600', fontSize: 14 },
    statusLine: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 14,
      marginBottom: spacing[3],
    },
    share: { color: colors.motionBlue, fontSize: 11, textAlign: 'center', marginBottom: 8 },
    sosMsg: { color: colors.error, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
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
