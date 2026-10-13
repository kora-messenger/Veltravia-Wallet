/**
 * Veltravia AI — chat screen.
 *
 * Layout mirrors Trust's assistant (from the screen recording):
 *   header:  menu button | title ("New Chat" -> first message) | close
 *   empty:   greeting + topic chips (support triage)
 *   thread:  right-aligned grey user bubble, assistant text with shield
 *            "AI is thinking..." / tool progress lines, cards for actions
 *   input:   "Ask anything" pill; arrow -> purple Stop square while busy
 *   footer:  "AI-generated content. Not financial advice."
 *
 * The AI only PREPARES transfers. Approve -> biometric/passcode -> signer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Easing, Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { CloseIcon, VeltraviaMark } from '../../components/icons';
import { useAiChat } from '../../ai/useAiChat';
import { DISCLAIMER, MENU_DISCLAIMER, type ChatAction, type ChatContext, type ChatMessage } from '../../ai/protocol';
import { MOCK_HOLDINGS } from '../../services/portfolio';
import { revalidate } from '../../ai/transfer';
import { executeTransfer } from '../../ai/signer';
import { promptBiometrics, isBiometricUnlockEnabled } from '../../core/security/biometrics';
import ConsentCard from './ConsentCard';
import TransferApprovalCard from './TransferApprovalCard';
import PasscodeConfirmSheet from './PasscodeConfirmSheet';

const PURPLE = '#4A3CF0';

const TOPICS: { label: string; icon: 'coins' | 'fuel' | 'alert' | 'tool' | 'swap' | 'help' }[] = [
  { label: 'Token or balance not showing', icon: 'coins' },
  { label: 'Gas, fee or network problem', icon: 'fuel' },
  { label: 'Transaction stuck/failed', icon: 'alert' },
  { label: 'Report a bug/outage', icon: 'tool' },
  { label: 'Swap issue', icon: 'swap' },
  { label: 'Something else', icon: 'help' },
];

function TopicIcon({ kind, color }: { kind: (typeof TOPICS)[number]['icon']; color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {kind === 'coins' && (<><Path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z" {...p} /><Path d="M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" {...p} /></>)}
      {kind === 'fuel' && (<><Path d="M6 20V6a2 2 0 012-2h5a2 2 0 012 2v14M4 20h13M15 9h2a2 2 0 012 2v5a1.5 1.5 0 003 0V9l-3-3" {...p} /><Path d="M8 8h5" {...p} /></>)}
      {kind === 'alert' && (<><Path d="M12 21a9 9 0 100-18 9 9 0 000 18z" {...p} /><Path d="M12 8v5M12 16.2v.1" {...p} /></>)}
      {kind === 'tool' && (<Path d="M14.7 6.3a4 4 0 005 5l-9.4 9.4a2 2 0 01-2.8-2.8l9.4-9.4zM5 5l3 3M7 3l-2 2 2 2" {...p} />)}
      {kind === 'swap' && (<Path d="M4 9h13l-3-3M20 15H7l3 3" {...p} />)}
      {kind === 'help' && (<><Path d="M12 21a9 9 0 100-18 9 9 0 000 18z" {...p} /><Path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2M12 16.8v.1" {...p} /></>)}
    </Svg>
  );
}

const MenuLinesIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M5 8.5h14M5 15.5h9" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

const SendArrow = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/** Shield-and-dots shimmer used while the AI thinks. */
function Thinking({ label, color, ink }: { label: string; color: string; ink: string }) {
  const a = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    l.start();
    return () => l.stop();
  }, [a]);
  return (
    <View style={styles.thinkRow}>
      <VeltraviaMark size={22} />
      <Animated.Text style={[styles.thinkText, { color, opacity: a }]}>{label}</Animated.Text>
    </View>
  );
}

export default function AiChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dark = theme.mode === 'dark';
  const scrollRef = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<{ messageId: string; proposalId: string } | null>(null);
  const [passcodeFor, setPasscodeFor] = useState<{ messageId: string; actionIdx: number } | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  // Wallet context handed to the brain. Addresses come from the wallet layer;
  // until derivation is bundled we pass the active wallet's known addresses.
  const ctx: ChatContext = useMemo(
    () => ({
      addresses: {
        '1': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        '56': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        '137': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      },
      holdings: MOCK_HOLDINGS.map((h) => ({ symbol: h.symbol, amount: h.amount, price: h.price, change24h: h.change24h })),
      currency: 'USD',
      locale: 'en',
    }),
    []
  );

  const chat = useAiChat(ctx);
  const { messages, thinking, busy } = chat;
  const started = messages.length > 0;
  const firstUser = messages.find((m) => m.role === 'user')?.text;
  const title = firstUser ? firstUser : 'New Chat';

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, thinking]);

  const submit = useCallback(() => {
    if (busy) return;
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    chat.send(t);
  }, [busy, chat, draft]);

  /* ---- approval pipeline: validate -> authenticate -> execute ---- */
  const runApproval = useCallback(
    async (messageId: string, action: Extract<ChatAction, { kind: 'transfer_approval' }>) => {
      const check = revalidate(action.proposal, ctx);
      if (!check.ok) {
        chat.resolveCard(messageId, 'expired');
        chat.appendAssistant(check.reason);
        return;
      }
      setSending(action.proposal.id);
      const result = await executeTransfer(action.proposal);
      setSending(null);
      if (result.status === 'sent') {
        chat.resolveCard(messageId, 'approved');
        chat.appendAssistant(
          `Sent ${action.proposal.amount} ${action.proposal.symbol} to ${action.proposal.toAddress.slice(0, 6)}…${action.proposal.toAddress.slice(-4)}. ` +
            `Transaction hash: ${result.hash}`,
          [{ kind: 'open_activity', label: 'View in Activity' }]
        );
      } else {
        chat.resolveCard(messageId, 'rejected');
        chat.appendAssistant(result.message);
      }
    },
    [chat, ctx]
  );

  const onApprove = useCallback(
    async (messageId: string, action: Extract<ChatAction, { kind: 'transfer_approval' }>) => {
      if (sending) return;
      const check = revalidate(action.proposal, ctx);
      if (!check.ok) {
        chat.resolveCard(messageId, 'expired');
        chat.appendAssistant(check.reason);
        return;
      }
      setPendingApproval({ messageId, proposalId: action.proposal.id });
      let ok = false;
      if (await isBiometricUnlockEnabled()) {
        ok = await promptBiometrics('Confirm transfer', `Send ${action.proposal.amount} ${action.proposal.symbol}`);
      }
      if (ok) {
        setPendingApproval(null);
        await runApproval(messageId, action);
      } else {
        // biometrics off, cancelled, or failed -> passcode is the fallback
        const idx = messages.find((m) => m.id === messageId)?.actions.indexOf(action) ?? 0;
        setPasscodeFor({ messageId, actionIdx: idx });
      }
    },
    [chat, ctx, messages, runApproval, sending]
  );

  const onReject = useCallback(
    (messageId: string) => {
      chat.resolveCard(messageId, 'rejected');
      chat.appendAssistant('Okay, I cancelled that transfer. Nothing was sent.');
    },
    [chat]
  );

  const runShortcut = useCallback(
    (a: ChatAction) => {
      switch (a.kind) {
        case 'open_swap':
          navigation.navigate('MainTabs', { screen: 'Swap' });
          break;
        case 'open_activity':
          navigation.navigate('Activity');
          break;
        case 'open_receive':
          navigation.navigate('MainTabs', { screen: 'Home' });
          break;
        case 'talk_to_support':
          chat.appendAssistant(
            'Support chat with a human specialist is not live in this build yet. Describe the problem here and ' +
              "I'll do what I can. Veltravia will never ask for your seed phrase."
          );
          break;
        default:
          break;
      }
    },
    [chat, navigation]
  );

  const ink = theme.ink;
  const muted = theme.inkMuted;
  const pageBg = dark ? theme.background : '#FCFCFD';
  const chipBg = dark ? 'rgba(255,255,255,0.10)' : '#EDEDF1';
  const bubbleBg = dark ? 'rgba(255,255,255,0.10)' : '#EDEDF1';
  const topicBg = dark ? 'rgba(255,255,255,0.08)' : '#EFEFF3';

  const renderAssistant = (m: ChatMessage) => (
    <View key={m.id} style={styles.aiBlock}>
      {m.streaming && thinking && !m.text && !m.toolLabel && (
        <Thinking label="AI is thinking..." color={muted} ink={ink} />
      )}
      {!!m.toolLabel && <Thinking label={m.toolLabel} color={muted} ink={ink} />}
      {!!m.text && <Text style={[styles.aiText, { color: ink }]}>{m.text}</Text>}

      {m.consent && (
        <ConsentCard
          request={m.consent}
          resolved={m.resolved}
          onAllow={() => chat.answerConsent(m.id, m.consent!, true)}
          onDecline={() => chat.answerConsent(m.id, m.consent!, false)}
        />
      )}

      {m.actions.map((a, i) => {
        if (a.kind === 'transfer_approval') {
          return (
            <TransferApprovalCard
              key={i}
              proposal={a.proposal}
              resolved={m.resolved}
              busy={sending === a.proposal.id || pendingApproval?.proposalId === a.proposal.id}
              onApprove={() => onApprove(m.id, a)}
              onReject={() => onReject(m.id)}
            />
          );
        }
        if (a.kind === 'quick_reply') {
          return (
            <View key={i} style={styles.quickWrap}>
              {a.replies.map((r) => (
                <Pressable key={r.label} onPress={() => chat.send(r.send)} style={[styles.quick, { backgroundColor: topicBg }]}>
                  <Text style={[styles.quickText, { color: ink }]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          );
        }
        return (
          <Pressable key={i} onPress={() => runShortcut(a)} style={[styles.shortcut, { backgroundColor: topicBg }]}>
            <Text style={[styles.quickText, { color: ink }]}>{(a as any).label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: pageBg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => setMenuOpen(true)} style={[styles.hBtn, { backgroundColor: chipBg }]}>
          <MenuLinesIcon color={ink} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.title, { color: ink }]}>{title}</Text>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={[styles.hBtn, { backgroundColor: chipBg }]}>
          <CloseIcon size={22} color={ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef as any}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.thread, !started && styles.threadEmpty]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!started && (
          <View>
            <Text style={[styles.greet, { color: ink }]}>
              Hi, how can I help? Choose an option below or type a message.
            </Text>
            <View style={styles.topics}>
              {TOPICS.map((t) => (
                <Pressable
                  key={t.label}
                  onPress={() => chat.send(t.label)}
                  style={({ pressed }) => [styles.topic, { backgroundColor: topicBg, opacity: pressed ? 0.7 : 1 }]}
                >
                  <TopicIcon kind={t.icon} color={muted} />
                  <Text style={[styles.topicText, { color: ink }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.hint, { color: muted }]}>
              Try: "Send $20 of USDT to 0x…" or "How is my portfolio doing?"
            </Text>
          </View>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={[styles.userBubble, { backgroundColor: bubbleBg }]}>
              <Text style={[styles.userText, { color: ink }]}>{m.text}</Text>
            </View>
          ) : (
            renderAssistant(m)
          )
        )}
      </ScrollView>

      {/* input */}
      <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[styles.input, { borderColor: dark ? 'rgba(255,255,255,0.14)' : '#E3E3E8', backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask anything"
            placeholderTextColor={muted}
            style={[styles.inputText, { color: ink }]}
            onSubmitEditing={submit}
            returnKeyType="send"
            editable={!busy}
            multiline={false}
          />
          {busy ? (
            <Pressable onPress={chat.stop} style={[styles.sendBtn, { backgroundColor: PURPLE }]} accessibilityLabel="Stop generating">
              <View style={styles.stopSquare} />
            </Pressable>
          ) : (
            <Pressable
              onPress={submit}
              disabled={!draft.trim()}
              style={[styles.sendBtn, { backgroundColor: draft.trim() ? PURPLE : dark ? 'rgba(255,255,255,0.08)' : '#F0F0F5' }]}
              accessibilityLabel="Send"
            >
              <SendArrow color={draft.trim() ? '#fff' : muted} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.disclaimer, { color: muted }]}>{DISCLAIMER}</Text>
      </View>

      {/* menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.menu, { backgroundColor: dark ? '#10182A' : '#FFFFFF', paddingTop: insets.top + 12 }]} onPress={() => {}}>
            <Text style={[styles.menuTitle, { color: ink }]}>Veltravia AI</Text>
            <Pressable style={styles.menuItem} onPress={() => { chat.reset(); setMenuOpen(false); }}>
              <Text style={[styles.menuItemText, { color: ink }]}>New chat</Text>
            </Pressable>
            <Text style={[styles.menuLabel, { color: muted }]}>Recents</Text>
            <Text style={[styles.menuEmpty, { color: muted }]}>Your recent chats will appear here.</Text>
            <Text style={[styles.menuDisc, { color: muted }]}>{MENU_DISCLAIMER}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <PasscodeConfirmSheet
        visible={!!passcodeFor}
        onCancel={() => setPasscodeFor(null)}
        onVerified={async () => {
          const pf = passcodeFor;
          setPasscodeFor(null);
          setPendingApproval(null);
          if (!pf) return;
          const msg = messages.find((m) => m.id === pf.messageId);
          const act = msg?.actions[pf.actionIdx];
          if (act && act.kind === 'transfer_approval') await runApproval(pf.messageId, act);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, gap: 12 },
  hBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  thread: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  threadEmpty: { flexGrow: 1, justifyContent: 'flex-end' },
  greet: { fontSize: 17, lineHeight: 25, fontFamily: 'Inter-500', fontWeight: '500', marginBottom: 14 },
  topics: { gap: 10, alignItems: 'flex-start' },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11 },
  topicText: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500' },
  hint: { fontSize: 13, marginTop: 16, fontFamily: 'Inter-500', fontWeight: '500' },
  userBubble: { alignSelf: 'flex-end', maxWidth: '86%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userText: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-500', fontWeight: '500' },
  aiBlock: { gap: 8 },
  aiText: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter-400', fontWeight: '400' },
  thinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkText: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500' },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  quick: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  shortcut: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 2 },
  quickText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  inputWrap: { paddingHorizontal: 20, paddingTop: 8 },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 28, paddingLeft: 18, paddingRight: 8, height: 60 },
  inputText: { flex: 1, fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500', paddingVertical: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#fff' },
  disclaimer: { textAlign: 'center', fontSize: 13, marginTop: 10, fontFamily: 'Inter-500', fontWeight: '500' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  menu: { width: '78%', height: '100%', paddingHorizontal: 20 },
  menuTitle: { fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 18 },
  menuItem: { paddingVertical: 12 },
  menuItemText: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  menuLabel: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 20 },
  menuEmpty: { fontSize: 14, marginTop: 8, fontFamily: 'Inter-500', fontWeight: '500' },
  menuDisc: { fontSize: 12, lineHeight: 17, marginTop: 'auto' as any, paddingBottom: 24, fontFamily: 'Inter-500', fontWeight: '500' },
});
