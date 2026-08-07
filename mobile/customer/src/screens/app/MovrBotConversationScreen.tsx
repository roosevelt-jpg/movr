import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { spacing, radius } from '@movr/design-system/theme';
import { useThemeColors } from '@movr/design-system/ThemeProvider';
import { aiApi } from '../../services/api';

type AiCard = {
  kind?: string;
  title: string;
  subtitle?: string;
  price?: string | number;
  badge?: string;
  href?: string;
  meta?: Record<string, any>;
};

type AiAction = {
  label: string;
  href?: string;
  action?: string;
  payload?: Record<string, any>;
};

type Msg = {
  id: string;
  from: 'user' | 'bot' | 'agent';
  text: string;
  cards?: AiCard[];
  actions?: AiAction[];
};

function authCountry(): string {
  try {
    const stored =
      (globalThis as any).__MOVR_COUNTRY__ ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_country') : null);
    return String(stored || 'GH').toUpperCase();
  } catch {
    return 'GH';
  }
}

/**
 * Movr AI in-app chat — rides, shops, rates, rankings; escalates to live agents.
 * Replaces the old scripted voice-bot demo with POST /ai/chat.
 */
export default function MovrBotConversationScreen({
  onBack,
  onOpenSupport,
  onNavigate,
}: {
  onBack?: () => void;
  onOpenSupport?: () => void;
  onNavigate?: (target: string) => void;
}) {
  const colors = useThemeColors();
  const styles = makeStyles(colors);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      text: 'Hi! I’m Movr AI. Ask about rides, rates, or stores — or say “talk to a human” for a live agent.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [escalated, setEscalated] = useState(false);
  const listRef = useRef<FlatList>(null);
  const seq = useRef(1);

  const push = (m: Omit<Msg, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: String(seq.current++) }]);
  };

  const escalate = async (subject = 'In-app Movr AI escalation') => {
    setBusy(true);
    try {
      const transcript = messages.map((m) => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      const res = await aiApi.escalate({
        transcript,
        subject,
        channel: 'in_app',
      });
      const data = res.data?.data || res.data || {};
      setEscalated(true);
      push({
        from: 'agent',
        text: data.reply || 'A live Movr specialist has been notified.',
      });
    } catch {
      push({
        from: 'bot',
        text: 'Could not reach agents right now — open Support from Help.',
        actions: onOpenSupport ? [{ label: 'Open Support', action: 'open_support' }] : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (a: AiAction) => {
    const key = String(a.action || '').toLowerCase();
    if (key === 'escalate' || /human|agent|support/i.test(a.label)) {
      await escalate(a.label);
      return;
    }
    if (key === 'open_support' || key === 'support') {
      onOpenSupport?.();
      return;
    }
    if (key === 'suggest' && a.payload?.message) {
      setInput(String(a.payload.message));
      return;
    }
    if (key === 'book_ride' && a.payload?.message) {
      await sendMessage(String(a.payload.message));
      return;
    }
    if (a.href?.startsWith('http')) {
      Linking.openURL(a.href).catch(() => undefined);
      return;
    }
    if (a.href) {
      onNavigate?.(a.href.replace(/^\//, ''));
      return;
    }
    if (a.label) {
      await sendMessage(a.label);
    }
  };

  const sendMessage = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    if (!raw) setInput('');
    push({ from: 'user', text });

    if (/\b(human|agent|real person|specialist|live support)\b/i.test(text)) {
      await escalate();
      return;
    }

    setBusy(true);
    try {
      const res = await aiApi.chat({
        message: text,
        sessionId,
        countryCode: authCountry(),
      });
      const data = res.data?.data || res.data || {};
      if (data.sessionId) setSessionId(String(data.sessionId));
      if (data.escalated) setEscalated(true);

      const cards: AiCard[] = Array.isArray(data.cards) ? data.cards : [];
      const actions: AiAction[] = Array.isArray(data.actions) ? data.actions : [];

      push({
        from: data.escalated ? 'agent' : 'bot',
        text: data.reply || 'Done.',
        cards: cards.length ? cards : undefined,
        actions: actions.length ? actions : undefined,
      });

      if (data.needsAuth) {
        push({
          from: 'bot',
          text: 'Sign in to complete booking from Movr AI.',
        });
      }
    } catch {
      push({
        from: 'bot',
        text: 'I hit a snag. Try again, or ask for a live agent.',
        actions: [{ label: 'Talk to a human', action: 'escalate' }],
      });
    } finally {
      setBusy(false);
    }
  };

  const renderCards = (cards?: AiCard[]) => {
    if (!cards?.length) return null;
    return (
      <View style={styles.cards}>
        {cards.map((c, i) => (
          <Pressable
            key={`${c.title}-${i}`}
            style={styles.card}
            onPress={() => {
              if (c.href?.startsWith('http')) Linking.openURL(c.href).catch(() => undefined);
              else if (c.href) onNavigate?.(c.href.replace(/^\//, ''));
            }}
          >
            <Text style={styles.cardTitle}>{c.title}</Text>
            {c.badge ? <Text style={styles.cardBadge}>{c.badge}</Text> : null}
            {c.subtitle ? <Text style={styles.cardSub}>{c.subtitle}</Text> : null}
            {c.price != null ? (
              <Text style={styles.cardPrice}>
                {typeof c.price === 'number' ? `GH₵${c.price}` : String(c.price)}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  };

  const renderActions = (actions?: AiAction[]) => {
    if (!actions?.length) return null;
    return (
      <View style={styles.actionRow}>
        {actions.map((a, i) => (
          <Pressable
            key={`${a.label}-${i}`}
            style={styles.actionBtn}
            onPress={() => runAction(a).catch(() => undefined)}
          >
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
            <Text style={styles.backText}>←</Text>
          </Pressable>
        ) : null}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Movr AI</Text>
          <Text style={styles.botLabel}>
            {escalated ? 'Live agent queue' : 'Always on · can escalate'}
          </Text>
        </View>
        {onOpenSupport ? (
          <Pressable onPress={onOpenSupport}>
            <Text style={styles.supportLink}>Support</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View>
            <View
              style={[
                styles.bubble,
                item.from === 'user'
                  ? styles.userBubble
                  : item.from === 'agent'
                    ? styles.agentBubble
                    : styles.botBubble,
              ]}
            >
              {item.from === 'agent' ? <Text style={styles.agentTag}>Agent</Text> : null}
              <Text style={styles.msgText}>{item.text}</Text>
              {renderCards(item.cards)}
            </View>
            {item.from !== 'user' ? renderActions(item.actions) : null}
          </View>
        )}
      />

      {busy ? (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color={colors.motionBlue} />
          <Text style={styles.typingText}>Movr AI is typing…</Text>
        </View>
      ) : null}

      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickBtn}
          onPress={() => escalate().catch(() => undefined)}
          disabled={busy}
        >
          <Text style={styles.quickText}>Live agent</Text>
        </Pressable>
        <Pressable
          style={styles.quickBtn}
          onPress={() => sendMessage('Top stores near me').catch(() => undefined)}
          disabled={busy}
        >
          <Text style={styles.quickText}>Top stores</Text>
        </Pressable>
        <Pressable
          style={styles.quickBtn}
          onPress={() => sendMessage('Ride to the airport').catch(() => undefined)}
          disabled={busy}
        >
          <Text style={styles.quickText}>Airport fare</Text>
        </Pressable>
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask Movr AI…"
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          editable={!busy}
          onSubmitEditing={() => sendMessage().catch(() => undefined)}
        />
        <Pressable
          style={[styles.send, busy && { opacity: 0.5 }]}
          onPress={() => sendMessage().catch(() => undefined)}
          disabled={busy || !input.trim()}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.jetBlack },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { paddingRight: 4 },
    backText: { color: colors.textSecondary, fontSize: 18 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.electricViolet,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: colors.pureWhite, fontWeight: '700', fontSize: 12 },
    title: { color: colors.pureWhite, fontWeight: '700', fontSize: 16 },
    botLabel: { color: colors.success, fontSize: 12, marginTop: 2 },
    supportLink: { color: colors.motionBlue, fontWeight: '600', fontSize: 13 },
    list: { padding: spacing[4], paddingBottom: spacing[6] },
    bubble: {
      maxWidth: '88%',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 6,
    },
    userBubble: { alignSelf: 'flex-end', backgroundColor: colors.motionBlue },
    botBubble: { alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated },
    agentBubble: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(0,217,122,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(0,217,122,0.35)',
    },
    agentTag: {
      color: colors.success,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    msgText: { color: colors.pureWhite, fontSize: 15, lineHeight: 21 },
    cards: { marginTop: 10, gap: 8 },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.jetBlack,
      padding: 10,
    },
    cardTitle: { color: colors.pureWhite, fontWeight: '700', fontSize: 14 },
    cardBadge: {
      color: colors.motionBlue,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
      textTransform: 'uppercase',
    },
    cardSub: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    cardPrice: { color: colors.pureWhite, fontWeight: '700', fontSize: 16, marginTop: 6 },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
      paddingLeft: 4,
    },
    actionBtn: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.motionBlue,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surfaceElevated,
    },
    actionText: { color: colors.pureWhite, fontWeight: '600', fontSize: 13 },
    typing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing[4],
      marginBottom: 6,
    },
    typingText: { color: colors.textSecondary, fontSize: 12 },
    quickRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: spacing[4],
      marginBottom: 8,
    },
    quickBtn: {
      flex: 1,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      alignItems: 'center',
    },
    quickText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
    composer: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.pill,
      color: colors.pureWhite,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    send: {
      backgroundColor: colors.motionBlue,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    sendText: { color: colors.pureWhite, fontWeight: '700' },
  });
}
