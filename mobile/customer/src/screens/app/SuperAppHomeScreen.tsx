import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { formatCurrency } from '@movr/design-system/format';
import ShopHomeScreen from './ShopHomeScreen';
import ParcelHomeScreen from './ParcelHomeScreen';
import ParcelTrackingScreen from './ParcelTrackingScreen';
import RentalHomeScreen from './RentalHomeScreen';
import RentalConfirmScreen from './RentalConfirmScreen';
import ActiveRentalScreen from './ActiveRentalScreen';
import HomeScreen from './HomeScreen';
import WalletScreen from './WalletScreen';
import ProfileSettingsScreen from './ProfileSettingsScreen';
import InboxScreen from './InboxScreen';
import ClaimScreen from './ClaimScreen';
import WalletTopUpScreen from './WalletTopUpScreen';
import RewardsScreen from './RewardsScreen';
import SafetyCenterScreen from './SafetyCenterScreen';
import TripHistoryScreen from './TripHistoryScreen';
import ReferralScreen from './ReferralScreen';
import AppSettingsScreen from './AppSettingsScreen';
import ExploreScreen from './ExploreScreen';
import PaymentMethodsScreen from './PaymentMethodsScreen';
import DealsScreen from './DealsScreen';
import StakingScreen from './StakingScreen';
import HelpCentreScreen from './HelpCentreScreen';
import WithdrawScreen from './WithdrawScreen';
import ProductDetailScreen from './ProductDetailScreen';
import StoreProfileScreen from './StoreProfileScreen';
import SupportChatScreen from './SupportChatScreen';
import TokenScreen from './TokenScreen';
import TransactionReceiptScreen from './TransactionReceiptScreen';
import WishlistScreen from './WishlistScreen';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const CHICKEN_ID = 'c0000000-0000-4000-8000-000000000014';
const ZINGER_ID = 'd0000000-0000-4000-8000-000000000141';

type Tab = 'home' | 'shop' | 'wallet' | 'profile';
type Service =
  | 'hub'
  | 'ride'
  | 'shop'
  | 'deliver'
  | 'parcel_track'
  | 'rental'
  | 'rental_confirm'
  | 'rental_active'
  | 'notifications'
  | 'claim'
  | 'topup'
  | 'withdraw'
  | 'rewards'
  | 'safety'
  | 'history'
  | 'refer'
  | 'settings'
  | 'explore'
  | 'payments'
  | 'deals'
  | 'staking'
  | 'help'
  | 'support'
  | 'store'
  | 'product'
  | 'wishlist'
  | 'redeem'
  | 'receipt';

function authHeaders(): Record<string, string> {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 3600000) return 'Today · ' + new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff < 86400000 * 2) return 'Yesterday · ' + new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Super-app home — greeting, map pin, services, wallet card, recent, bottom nav.
 * Service taps open Ride / Shop / Deliver / Rental modules.
 */
export default function SuperAppHomeScreen({
  onOpenStore,
  onOpenWallet,
  onOpenProfile,
  onTopUp,
  onSend,
}: {
  onOpenVoice?: () => void;
  onOpenAi?: () => void;
  onOpenWhatsApp?: () => void;
  onOpenStore?: (storeId: string) => void;
  onOpenRecent?: () => void;
  onOpenWallet?: () => void;
  onOpenProfile?: () => void;
  onTopUp?: () => void;
  onSend?: () => void;
}) {
  const [service, setService] = useState<Service>('hub');
  const [tab, setTab] = useState<Tab>('home');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [storeId, setStoreId] = useState(CHICKEN_ID);
  const [productId, setProductId] = useState(ZINGER_ID);
  const [rentalVehicleId, setRentalVehicleId] = useState('e0000000-0000-4000-8000-000000000002');
  const [rentalMode, setRentalMode] = useState<'self_drive' | 'chauffeur'>('self_drive');
  const [parcelRef, setParcelRef] = useState('MVR-P-8821');
  const [receiptRideId, setReceiptRideId] = useState('f3000000-0000-4000-8000-000000004821');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/me/home-dashboard`, { headers: authHeaders() });
      const j = await res.json();
      if (j?.data) setData(j.data);
      else throw new Error('empty');
    } catch {
      setData({
        greeting: 'Good morning',
        name: 'Kwame Asante',
        initials: 'KA',
        location: { label: 'Victoria Island, Lagos', lat: 6.4281, lng: 3.4219 },
        wallet: { balance: 24500, currency: 'NGN', tokens: 2400, points: 850 },
        services: [
          { id: 'ride', label: 'Ride' },
          { id: 'shop', label: 'Shop' },
          { id: 'deliver', label: 'Deliver' },
          { id: 'rental', label: 'Rental' },
        ],
        recent: [
          { id: '1', kind: 'ride', title: 'Ride to Lekki', amount: 1200, at: new Date().toISOString() },
          {
            id: '2',
            kind: 'deliver',
            title: 'Package Delivery',
            amount: 800,
            at: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabBar = (
    <View style={styles.tabBar}>
      {(
        [
          { id: 'home' as Tab, label: 'Home', icon: '⌂' },
          { id: 'shop' as Tab, label: 'Shop', icon: '🛍' },
          { id: 'wallet' as Tab, label: 'Wallet', icon: '💳' },
          { id: 'profile' as Tab, label: 'Profile', icon: '👤' },
        ] as const
      ).map((t) => {
        const on = tab === t.id;
        return (
          <Pressable
            key={t.id}
            style={styles.tabItem}
            onPress={() => {
              setTab(t.id);
              if (t.id === 'shop') setService('shop');
              if (t.id === 'home') setService('hub');
              if (t.id === 'wallet') {
                setService('hub');
                onOpenWallet?.();
              }
              if (t.id === 'profile') {
                setService('hub');
                onOpenProfile?.();
              }
            }}
          >
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabLabel, on && styles.tabOn]}>{t.label}</Text>
            {on ? <View style={styles.tabDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (tab === 'wallet' && service === 'hub') {
    return (
      <View style={styles.root}>
        <WalletScreen
          onTopUp={() => setService('topup')}
          onWithdraw={() => setService('withdraw')}
          onTransfer={onSend}
          onClaimDvt={() => setService('claim')}
          onPaymentMethods={() => setService('payments')}
          onRedeem={() => setService('redeem')}
        />
        {tabBar}
      </View>
    );
  }

  if (tab === 'profile' && service === 'hub') {
    return (
      <View style={styles.root}>
        <ProfileSettingsScreen
          onLeaderboard={() => setService('rewards')}
          onDvtDashboard={() => setService('staking')}
          onNotifications={() => setService('notifications')}
          onRewards={() => setService('rewards')}
          onSafety={() => setService('safety')}
          onHistory={() => setService('history')}
          onRefer={() => setService('refer')}
          onSettings={() => setService('settings')}
          onDeals={() => setService('deals')}
          onPrivacy={() => setService('settings')}
          onHelp={() => setService('help')}
          onWishlist={() => setService('wishlist')}
        />
        {tabBar}
      </View>
    );
  }

  if (service === 'settings') {
    return (
      <View style={styles.root}>
        <AppSettingsScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'explore') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <ExploreScreen
          onOpenStore={onOpenStore}
          onRide={() => setService('ride')}
          onParcel={() => setService('deliver')}
          onRental={() => setService('rental')}
        />
      </View>
    );
  }
  if (service === 'payments') {
    return (
      <View style={styles.root}>
        <PaymentMethodsScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'deals') {
    return (
      <View style={styles.root}>
        <DealsScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'staking') {
    return (
      <View style={styles.root}>
        <StakingScreen onBack={() => setService('hub')} />
      </View>
    );
  }

  if (service === 'rewards') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Profile</Text>
        </Pressable>
        <RewardsScreen onRefer={() => setService('refer')} />
      </View>
    );
  }
  if (service === 'safety') {
    return (
      <View style={styles.root}>
        <SafetyCenterScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'history') {
    return (
      <View style={styles.root}>
        <TripHistoryScreen
          onBack={() => setService('hub')}
          onBookRide={() => setService('ride')}
          onBrowseStores={() => setService('shop')}
          onDeliver={() => setService('deliver')}
          onReceipt={(id) => {
            setReceiptRideId(id || 'f3000000-0000-4000-8000-000000004821');
            setService('receipt');
          }}
        />
        {tabBar}
      </View>
    );
  }
  if (service === 'redeem') {
    return (
      <View style={styles.root}>
        <TokenScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'receipt') {
    return (
      <View style={styles.root}>
        <TransactionReceiptScreen
          rideId={receiptRideId}
          onBack={() => setService('history')}
          onDone={() => setService('hub')}
        />
      </View>
    );
  }
  if (service === 'help') {
    return (
      <View style={styles.root}>
        <HelpCentreScreen
          onBack={() => setService('hub')}
          onOpenSupport={() => setService('support')}
        />
      </View>
    );
  }
  if (service === 'support') {
    return (
      <View style={styles.root}>
        <SupportChatScreen onBack={() => setService('help')} />
      </View>
    );
  }
  if (service === 'withdraw') {
    return (
      <View style={styles.root}>
        <WithdrawScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'store') {
    return (
      <View style={styles.root}>
        <StoreProfileScreen
          storeId={storeId}
          onBack={() => setService('shop')}
          onOpenProduct={(id) => {
            setProductId(id);
            setService('product');
          }}
        />
      </View>
    );
  }
  if (service === 'product') {
    return (
      <View style={styles.root}>
        <ProductDetailScreen
          productId={productId}
          storeId={storeId}
          onBack={() => setService('store')}
          onAdded={() => setService('store')}
        />
      </View>
    );
  }
  if (service === 'wishlist') {
    return (
      <View style={styles.root}>
        <WishlistScreen
          onBack={() => setService('shop')}
          onOpenProduct={(sid, pid) => {
            setStoreId(sid);
            setProductId(pid);
            setService('product');
          }}
        />
      </View>
    );
  }
  if (service === 'refer') {
    return (
      <View style={styles.root}>
        <ReferralScreen onBack={() => setService('hub')} />
      </View>
    );
  }

  if (service === 'notifications') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <InboxScreen onOpenClaim={() => setService('claim')} />
      </View>
    );
  }
  if (service === 'claim') {
    return (
      <View style={styles.root}>
        <ClaimScreen onBack={() => setService('hub')} />
      </View>
    );
  }
  if (service === 'topup') {
    return (
      <View style={styles.root}>
        <WalletTopUpScreen onBack={() => setService('hub')} onDone={() => setService('hub')} />
      </View>
    );
  }

  if (service === 'ride') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <HomeScreen
          pickupLabel={data?.location?.label}
          pickupLat={data?.location?.lat}
          pickupLng={data?.location?.lng}
        />
      </View>
    );
  }
  if (service === 'shop') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <ShopHomeScreen
          onOpenStore={(id) => {
            setStoreId(id || CHICKEN_ID);
            setService('store');
            onOpenStore?.(id);
          }}
          onOpenProduct={(sid, pid) => {
            setStoreId(sid);
            setProductId(pid);
            setService('product');
          }}
          onOpenWishlist={() => setService('wishlist')}
          userLat={data?.location?.lat}
          userLng={data?.location?.lng}
        />
      </View>
    );
  }
  if (service === 'deliver') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <ParcelHomeScreen
          onScheduled={(id) => {
            setParcelRef(id || 'MVR-P-8821');
            setService('parcel_track');
          }}
        />
      </View>
    );
  }
  if (service === 'parcel_track') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('deliver')} style={styles.back}>
          <Text style={styles.backText}>← Deliver</Text>
        </Pressable>
        <ParcelTrackingScreen parcelRef={parcelRef} onBack={() => setService('deliver')} />
      </View>
    );
  }
  if (service === 'rental') {
    return (
      <View style={styles.root}>
        <Pressable onPress={() => setService('hub')} style={styles.back}>
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <RentalHomeScreen
          onConfirm={({ vehicleId, mode }) => {
            setRentalVehicleId(vehicleId);
            setRentalMode(mode);
            setService('rental_confirm');
          }}
        />
      </View>
    );
  }
  if (service === 'rental_confirm') {
    return (
      <View style={styles.root}>
        <RentalConfirmScreen
          vehicleId={rentalVehicleId}
          mode={rentalMode}
          onBack={() => setService('rental')}
          onPaid={() => setService('rental_active')}
        />
      </View>
    );
  }
  if (service === 'rental_active') {
    return (
      <View style={styles.root}>
        <ActiveRentalScreen
          onBack={() => setService('hub')}
          onSupport={() => setService('help')}
        />
      </View>
    );
  }

  const w = data?.wallet || {};
  const recent = data?.recent || [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{data?.initials || 'KA'}</Text>
            </View>
            <View>
              <Text style={styles.greet}>
                {data?.greeting || 'Good morning'} 👋
              </Text>
              <Text style={styles.name}>{data?.name || 'Traveler'}</Text>
            </View>
          </View>
          <Pressable onPress={() => setService('notifications')}>
            <Text style={styles.bell}>🔔</Text>
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => setService('explore')}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search rides, stores, parcels...</Text>
        </Pressable>

        {loading && !data ? (
          <ActivityIndicator color="#8E2DE2" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.map}>
              <View style={styles.mapGlow} />
              <View style={styles.mapPin} />
              <View style={styles.locBar}>
                <View style={styles.locDot} />
                <Text style={styles.locText} numberOfLines={1}>
                  {data?.location?.label || 'Victoria Island, Lagos'}
                </Text>
                <Pressable onPress={() => setService('ride')}>
                  <Text style={styles.change}>Change</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.section}>SERVICES</Text>
            <View style={styles.services}>
              {[
                { id: 'ride' as Service, label: 'Ride', icon: '🚗' },
                { id: 'shop' as Service, label: 'Shop', icon: '🛍️' },
                { id: 'deliver' as Service, label: 'Deliver', icon: '📦' },
                { id: 'rental' as Service, label: 'Rental', icon: '🔑' },
              ].map((s) => (
                <Pressable key={s.id} style={styles.service} onPress={() => setService(s.id)}>
                  <Text style={styles.serviceIcon}>{s.icon}</Text>
                  <Text style={styles.serviceLabel}>{s.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.fairStrip} onPress={() => setService('ride')}>
              <Text style={styles.fairStripText}>
                Fair fares · driver keeps 100% · no commission
              </Text>
            </Pressable>

            <View style={styles.crossSell}>
              {[
                { id: 'deliver' as Service, t: 'Send a parcel?', s: 'Same-day across town' },
                { id: 'shop' as Service, t: 'Hungry?', s: 'Order from nearby stores' },
                { id: 'rental' as Service, t: 'Need a car for the day?', s: 'Self-drive & chauffeur' },
                { id: 'refer' as Service, t: 'Refer & earn', s: 'Invite friends to fair rides' },
              ].map((x) => (
                <Pressable key={x.id} style={styles.crossCard} onPress={() => setService(x.id)}>
                  <Text style={styles.crossTitle}>{x.t}</Text>
                  <Text style={styles.crossSub}>{x.s}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.wallet}>
              <View style={styles.walletA} />
              <View style={styles.walletB} />
              <Text style={styles.walletLabel}>TOTAL BALANCE</Text>
              <Text style={styles.walletBal}>
                {formatCurrency(Number(w.balance || 0), w.currency || 'NGN')}
              </Text>
              <Text style={styles.walletMeta}>
                {Number(w.tokens || 0).toLocaleString()} DVT Tokens · {Number(w.points || 0).toLocaleString()} pts
              </Text>
              <View style={styles.walletActions}>
                <Pressable style={styles.ghostBtn} onPress={onTopUp || onOpenWallet}>
                  <Text style={styles.ghostText}>Top Up</Text>
                </Pressable>
                <Pressable style={styles.ghostBtn} onPress={onSend || onOpenWallet}>
                  <Text style={styles.ghostText}>Send</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.section}>RECENT</Text>
            {recent.map((r: any) => (
              <View key={r.id} style={styles.recentRow}>
                <View style={styles.recentIcon}>
                  <Text>{r.kind === 'deliver' ? '📦' : '🚗'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle}>{r.title}</Text>
                  <Text style={styles.recentSub}>{relativeTime(r.at)}</Text>
                </View>
                <Text style={styles.recentAmt}>
                  {formatCurrency(Number(r.amount || 0), w.currency || 'NGN')}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {tabBar}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  back: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText: { color: '#a78bfa', fontWeight: '700' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8E2DE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800' },
  greet: { color: '#aaa', fontSize: 13 },
  name: { color: '#fff', fontWeight: '800', fontSize: 18 },
  bell: { fontSize: 20 },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#8E2DE2',
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchPlaceholder: { color: '#71717A', fontSize: 14 },
  map: {
    marginHorizontal: 16,
    height: 160,
    borderRadius: 18,
    backgroundColor: '#0c0c12',
    borderWidth: 1,
    borderColor: '#1f1f28',
    marginBottom: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  mapGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: 40,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(142,45,226,0.25)',
  },
  mapPin: {
    position: 'absolute',
    alignSelf: 'center',
    top: 58,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#8E2DE2',
  },
  locBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#141414',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  locDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8E2DE2' },
  locText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 13 },
  change: { color: '#c4b5fd', fontWeight: '700', fontSize: 13 },
  section: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  services: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  service: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  serviceIcon: { fontSize: 22 },
  serviceLabel: { color: '#fff', fontWeight: '700', fontSize: 12 },
  fairStrip: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#052e16',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  fairStripText: {
    color: '#86efac',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  crossSell: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  crossCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
  },
  crossTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  crossSub: { color: '#888', fontSize: 11, marginTop: 4 },
  wallet: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#4A00E0',
  },
  walletA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#8E2DE2', opacity: 0.85 },
  walletB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B5CFF',
    opacity: 0.55,
    left: '35%',
  },
  walletLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 1, zIndex: 1 },
  walletBal: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6, zIndex: 1 },
  walletMeta: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13, zIndex: 1 },
  walletActions: { flexDirection: 'row', gap: 10, marginTop: 16, zIndex: 1 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  ghostText: { color: '#fff', fontWeight: '700' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTitle: { color: '#fff', fontWeight: '700' },
  recentSub: { color: '#888', fontSize: 12, marginTop: 2 },
  recentAmt: { color: '#fff', fontWeight: '700' },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingVertical: 10,
    paddingBottom: 18,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 16 },
  tabLabel: { color: '#666', fontSize: 11, fontWeight: '600' },
  tabOn: { color: '#fff' },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#8E2DE2',
    marginTop: 2,
  },
});
