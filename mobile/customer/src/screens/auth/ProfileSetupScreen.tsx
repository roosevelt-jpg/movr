import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
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

/** Profile setup — Step 2 of 3 (mockup). */
export default function ProfileSetupScreen({
  onContinue,
}: {
  onContinue?: (profile: {
    firstName: string;
    lastName: string;
    email?: string;
    gender?: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/users/me/profile`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const u = j?.data;
        if (!u) return;
        if (u.firstName) setFirstName(u.firstName);
        if (u.lastName) setLastName(u.lastName);
        if (u.email) setEmail(u.email);
        if (u.gender === 'female' || u.gender === 'male' || u.gender === 'other') {
          setGender(u.gender);
        }
      })
      .catch(() => undefined);
  }, []);

  const initials = useMemo(() => {
    const a = (firstName || 'K')[0];
    const b = (lastName || 'A')[0];
    return `${a}${b}`.toUpperCase();
  }, [firstName, lastName]);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/users/me/profile-setup`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          gender,
          onboardingStep: 2,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not save profile');
      onContinue?.({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        gender,
      });
    } catch (e: any) {
      setError(e.message || 'Could not save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.progress}>
        <View style={[styles.seg, styles.segOn]} />
        <View style={[styles.seg, styles.segOn]} />
        <View style={styles.seg} />
      </View>
      <Text style={styles.step}>STEP 2 OF 3</Text>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.sub}>Tell us a bit about yourself</Text>

      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <View style={styles.avatarA} />
          <View style={styles.avatarB} />
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Pressable style={styles.cam}>
          <Text style={styles.camIcon}>📷</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldIcon}>👤</Text>
        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor="#71717A"
          value={firstName}
          onChangeText={setFirstName}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldIcon}>👤</Text>
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor="#71717A"
          value={lastName}
          onChangeText={setLastName}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldIcon}>✉</Text>
        <TextInput
          style={styles.input}
          placeholder="Email (optional)"
          placeholderTextColor="#71717A"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <Text style={styles.genderLabel}>GENDER</Text>
      <View style={styles.genders}>
        {(['male', 'female', 'other'] as const).map((g) => (
          <Pressable
            key={g}
            style={[styles.genderBtn, gender === g && styles.genderOn]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.genderText, gender === g && styles.genderTextOn]}>
              {g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Other'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.cta} onPress={submit} disabled={loading}>
        <View style={styles.ctaA} />
        <View style={styles.ctaB} />
        <Text style={styles.ctaText}>{loading ? 'Saving…' : 'Continue'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing[5], paddingTop: 24 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#27272A' },
  segOn: { backgroundColor: '#A855F7' },
  step: { color: '#71717A', fontSize: 11, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub: { color: '#A1A1AA', marginTop: 8, marginBottom: 28 },
  avatarWrap: { alignSelf: 'center', marginBottom: 28 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#3B82F6',
  },
  avatarA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A855F7', opacity: 0.8 },
  avatarB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3B82F6',
    opacity: 0.7,
    left: '40%',
  },
  initials: { color: '#fff', fontSize: 32, fontWeight: '800', zIndex: 1 },
  cam: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  camIcon: { fontSize: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  fieldIcon: { marginRight: 10, color: '#5B8AFF', fontSize: 14 },
  input: { flex: 1, color: '#fff', paddingVertical: 14, fontSize: 15 },
  genderLabel: {
    color: '#71717A',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 10,
  },
  genders: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  genderBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#27272A',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  genderOn: { borderColor: '#A855F7' },
  genderText: { color: '#71717A', fontWeight: '600' },
  genderTextOn: { color: '#fff' },
  error: { color: '#F87171', marginBottom: 12, textAlign: 'center' },
  cta: {
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 'auto' as any,
  },
  ctaA: { ...StyleSheet.absoluteFillObject, backgroundColor: '#3B82F6' },
  ctaB: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A855F7',
    opacity: 0.75,
    left: '45%',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, zIndex: 1 },
});
