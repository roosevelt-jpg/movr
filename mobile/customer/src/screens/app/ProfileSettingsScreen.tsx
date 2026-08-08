import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
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

/** Profile — stats, ACCOUNT / REWARDS / SUPPORT, unread badge (mockup). */
export default function ProfileSettingsScreen({
  onSignOut,
  onEditProfile,
  onHelp,
  onOpenAi,
  onPrivacy,
  onNotifications,
  onDvtDashboard,
  onLeaderboard,
  onRewards,
  onSafety,
  onHistory,
  onRefer,
  onSettings,
  onDeals,
  onWishlist,
  onMerchantPayouts,
}: {
  onSignOut?: () => void;
  onEditProfile?: () => void;
  onHelp?: () => void;
  onOpenAi?: () => void;
  onPrivacy?: () => void;
  onNotifications?: () => void;
  onDvtDashboard?: () => void;
  onLeaderboard?: () => void;
  onRewards?: () => void;
  onSafety?: () => void;
  onHistory?: () => void;
  onRefer?: () => void;
  onSettings?: () => void;
  onDeals?: () => void;
  onWishlist?: () => void;
  onMerchantPayouts?: () => void;
}) {
  const [name, setName] = useState('Kwame Asante');
  const [initials, setInitials] = useState('KA');
  const [phone, setPhone] = useState('+234 801 234 5678');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [rides, setRides] = useState(47);
  const [rating, setRating] = useState(4.9);
  const [points, setPoints] = useState(850);
  const [unread, setUnread] = useState(3);

  useEffect(() => {
    fetch(`${API}/users/me/profile`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const u = j.data || j;
        if (u.name) setName(u.name);
        if (u.initials) setInitials(u.initials);
        if (u.phone) setPhone(u.phone);
        if (u.avatarUrl) setAvatarUrl(u.avatarUrl);
        if (u.stats) {
          setRides(Number(u.stats.rides ?? 47));
          setRating(Number(u.stats.rating ?? 4.9));
          setPoints(Number(u.stats.points ?? 850));
        }
        if (u.unreadNotifications != null) setUnread(Number(u.unreadNotifications));
      })
      .catch(() => undefined);
  }, []);

  const Row = ({
    icon,
    iconColor,
    label,
    badge,
    danger,
    onPress,
  }: {
    icon: string;
    iconColor?: string;
    label: string;
    badge?: number;
    danger?: boolean;
    onPress?: () => void;
  }) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowIcon, iconColor ? { color: iconColor } : null]}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      {badge != null && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Text style={styles.chev}>›</Text>
      )}
    </Pressable>
  );

  const signOut = () => {
    try {
      delete (globalThis as any).__MOVR_TOKEN__;
      if (typeof localStorage !== 'undefined') localStorage.removeItem('movr_token');
    } catch {
      /* ignore */
    }
    onSignOut?.();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.phone}>{phone}</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{rides}</Text>
          <Text style={styles.statLabel}>Rides</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{points}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
      </View>

      <Text style={styles.section}>ACCOUNT</Text>
      <View style={styles.group}>
        <Row icon="👤" iconColor="#5B8AFF" label="Personal Info" onPress={onEditProfile} />
        <Row icon="⚙️" iconColor="#A1A1AA" label="Settings" onPress={onSettings || onPrivacy} />
        <Row icon="🔒" iconColor="#EAB308" label="Privacy & Security" onPress={onPrivacy} />
        <Row
          icon="🔔"
          iconColor="#EAB308"
          label="Notifications"
          badge={unread}
          onPress={onNotifications}
        />
      </View>

      <Text style={styles.section}>REWARDS</Text>
      <View style={styles.group}>
        <Row icon="◎" iconColor="#A1A1AA" label="DVT Staking" onPress={onDvtDashboard} />
        <Row
          icon="🏆"
          iconColor="#EAB308"
          label="Rewards & Leaderboard"
          onPress={onLeaderboard || onRewards}
        />
        <Row icon="🏷" iconColor="#22C55E" label="Deals & Promos" onPress={onDeals} />
        <Row icon="🎁" iconColor="#A78BFA" label="Refer & Earn" onPress={onRefer} />
      </View>

      <Text style={styles.section}>ACTIVITY</Text>
      <View style={styles.group}>
        <Row icon="♡" iconColor="#F472B6" label="Wishlist" onPress={onWishlist} />
        <Row icon="🏦" iconColor="#34D399" label="Merchant payouts" onPress={onMerchantPayouts} />
        <Row icon="📋" iconColor="#60A5FA" label="Activity History" onPress={onHistory} />
        <Row icon="🛡" iconColor="#EF4444" label="Safety Center" onPress={onSafety} />
      </View>

      <Text style={styles.section}>SUPPORT</Text>
      <View style={styles.group}>
        {onOpenAi ? <Row icon="✦" label="Talk to Movr AI" onPress={onOpenAi} /> : null}
        <Row icon="💬" label="Help Center" onPress={onHelp} />
        <Row icon="🚪" iconColor="#B45309" label="Sign Out" danger onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingHorizontal: spacing[5] },
  header: {
    alignItems: 'center',
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E2DE2',
  },
  avatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 14 },
  phone: { color: '#A1A1AA', marginTop: 4, fontSize: 14 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
    marginTop: spacing[2],
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#71717A', fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 28, backgroundColor: '#2A2A2A' },
  section: {
    color: '#71717A',
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  group: { marginBottom: spacing[4] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  rowIcon: { width: 28, fontSize: 16, color: '#A1A1AA' },
  rowLabel: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  danger: { color: '#EF4444' },
  chev: { color: '#71717A', fontSize: 22, fontWeight: '300' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8E2DE2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
