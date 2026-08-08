import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Linking,
} from 'react-native';
import { spacing } from '@movr/design-system/theme';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function copyText(text: string) {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
      await (navigator as any).clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through */
  }
  await Share.share({ message: text });
}

/** Refer & Earn — code, share channels, stats (mockup). */
export default function ReferralScreen({ onBack }: { onBack?: () => void }) {
  const [code, setCode] = useState('KWAME50');
  const [shareLink, setShareLink] = useState('https://movr.io/r/KWAME50');
  const [headline, setHeadline] = useState('Give ₦500, Get 50 pts');
  const [body, setBody] = useState(
    'Share your code. When a friend completes their first ride, you both win.'
  );
  const [invited, setInvited] = useState(8);
  const [joined, setJoined] = useState(5);
  const [pts, setPts] = useState(250);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = authHeaders();
    Promise.all([
      fetch(`${API}/referrals/my-code`, { headers: h }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/referrals/progress`, { headers: h }).then((r) => r.json()).catch(() => null),
    ]).then(([c, p]) => {
      if (c?.data?.code) setCode(c.data.code);
      if (c?.data?.shareLink) setShareLink(c.data.shareLink);
      if (p?.data) {
        setInvited(Number(p.data.invitedCount ?? 8));
        setJoined(Number(p.data.joinedCount ?? 5));
        setPts(Number(p.data.ptsEarned ?? p.data.totalRewards ?? 250));
        if (p.data.promo?.headline) setHeadline(p.data.promo.headline);
        if (p.data.promo?.body) setBody(p.data.promo.body);
      }
    });
  }, []);

  const copyCode = async () => {
    await copyText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const msg = `Join MOVR with my code ${code} and get ₦500 off. ${shareLink}`;

  const shareWhatsApp = () => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  const shareSms = () => Linking.openURL(`sms:?body=${encodeURIComponent(msg)}`);
  const shareIg = () => Share.share({ message: msg });
  const copyLink = async () => {
    await copyText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: spacing[10] }}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Refer & Earn</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.giftCircle}>
          <Text style={styles.gift}>🎁</Text>
        </View>
      </View>

      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>

      <Pressable style={styles.codeCard} onPress={copyCode}>
        <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.tapCopy}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
      </Pressable>

      <View style={styles.shareGrid}>
        {[
          { id: 'wa', label: 'WhatsApp', icon: '💬', onPress: shareWhatsApp },
          { id: 'sms', label: 'SMS', icon: '✉️', onPress: shareSms },
          { id: 'ig', label: 'Instagram', icon: '📷', onPress: shareIg },
          { id: 'link', label: 'Copy Link', icon: '🔗', onPress: copyLink },
        ].map((b) => (
          <Pressable key={b.id} style={styles.shareBtn} onPress={b.onPress}>
            <Text style={styles.shareIcon}>{b.icon}</Text>
            <Text style={styles.shareLabel}>{b.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>YOUR REFERRAL STATS</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{invited}</Text>
            <Text style={styles.statLab}>Invited</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{joined}</Text>
            <Text style={styles.statLab}>Joined</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: '#A78BFA' }]}>{pts}</Text>
            <Text style={styles.statLab}>Pts earned</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: spacing[4],
    marginBottom: spacing[3],
  },
  back: { color: '#FFF', fontSize: 22 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  hero: { alignItems: 'center', marginVertical: spacing[4] },
  giftCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4C1D95',
  },
  gift: { fontSize: 48 },
  headline: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: spacing[5],
    lineHeight: 20,
    paddingHorizontal: spacing[2],
  },
  codeCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#8E2DE2',
    borderRadius: 16,
    padding: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[4],
    backgroundColor: '#141414',
  },
  codeLabel: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  code: { color: '#FFF', fontSize: 28, fontWeight: '800', marginVertical: 8 },
  tapCopy: { color: '#A1A1AA', fontSize: 12 },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing[5] },
  shareBtn: {
    width: '47%',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareIcon: { fontSize: 22, marginBottom: 6 },
  shareLabel: { color: '#FFF', fontWeight: '600' },
  statsCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: spacing[4],
  },
  statsTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, height: 36, backgroundColor: '#27272A' },
  statNum: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  statLab: { color: '#71717A', fontSize: 12, marginTop: 4 },
});
