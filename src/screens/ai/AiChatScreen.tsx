/**
 * Veltravia AI — chat screen.
 *
 * Layout mirrors Trust's assistant (from the screen recording):
 *   header:  menu button | [new-chat button once started] | title ("New Chat") | close
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
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Platform, StatusBar, Animated, Easing, Modal, Image, Keyboard,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../../theme/ThemeProvider';
import { CloseIcon, PlusIcon } from '../../components/icons';
import { useAiChat } from '../../ai/useAiChat';
import { localBrain } from '../../ai/engine';
import { openRouterBrain } from '../../ai/openrouterBrain';
import { APP_CONFIG } from '../../config/env';
import { DISCLAIMER, type ChatAction, type ChatContext, type ChatMessage } from '../../ai/protocol';
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

/** "New chat" suggestions (Trust parity): three outlined pills with a leading icon. */
const FRESH_SUGGESTIONS: { label: string; icon: 'sparkle' | 'trend' | 'plus' }[] = [
  { label: 'How is my portfolio performing?', icon: 'sparkle' },
  { label: "What's moving the crypto market?", icon: 'trend' },
  { label: 'What are the top crypto trends?', icon: 'plus' },
];

function SuggestIcon({ kind, color }: { kind: 'sparkle' | 'trend' | 'plus'; color: string }) {
  const p = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {kind === 'sparkle' && (<><Path d="M10 4c.5 4 2.5 6 6.5 6.5-4 .5-6 2.5-6.5 6.5-.5-4-2.5-6-6.5-6.5C7.5 10 9.5 8 10 4z" fill={color} stroke={color} strokeWidth={0.6} strokeLinejoin="round" /><Path d="M18 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" fill={color} /></>)}
      {kind === 'trend' && (<Path d="M4 17l6-6 4 4 6-7M15 8h5v5" {...p} />)}
      {kind === 'plus' && (<><Path d="M12 21a9 9 0 100-18 9 9 0 000 18z" {...p} /><Path d="M12 8v8M8 12h8" {...p} /></>)}
    </Svg>
  );
}

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

const ComposeIcon = ({ color }: { color: string }) => (
  <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
    <Path
      d="M12 4.5H8.2C6 4.5 4.5 6 4.5 8.2v6.6c0 2.2 1.5 3.7 3.7 3.7H9v3.2l4-3.2h3.8c2.2 0 3.7-1.5 3.7-3.7V13"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M18.5 3v6.5M15.25 6.25h6.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

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

/** Header spinner: a 3/4 arc that rotates until the connection returns. */
function ArcSpinner({ color, size = 22 }: { color: string; size?: number }) {
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(r, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [r]);
  const rotate = r.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rad = size / 2 - 2.5;
  const c = size / 2;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Path
          d={`M ${c} ${c - rad} A ${rad} ${rad} 0 1 1 ${c - rad} ${c}`}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

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
      <Image source={require('../../assets/veltravia-shield.png')} style={styles.thinkLogo} resizeMode="contain" />
      <Animated.Text style={[styles.thinkText, { color, opacity: a }]}>{label}</Animated.Text>
    </View>
  );
}

/** In-session chat history for the Recents drawer. Chats can contain balances,
 *  so they live in memory only until an encrypted store backs them. */
interface SavedChat { id: string; title: string; messages: ChatMessage[]; at: number }
let RECENTS: SavedChat[] = [];

const chatTitle = (msgs: ChatMessage[]) => {
  const t = (msgs.find((m) => m.role === 'user')?.text ?? 'New Chat').replace(/\s+/g, ' ').trim();
  return t.length > 40 ? t.slice(0, 38).trimEnd() + '…' : t;
};

export default function AiChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dark = theme.mode === 'dark';
  // Opened from the headset -> 'support' (greeting + support topics).
  // "+ Chat" / "New chat" in the drawer -> 'fresh' (centered prompt + 3 suggestions).
  const [mode, setMode] = useState<'support' | 'fresh'>(route.params?.mode === 'fresh' ? 'fresh' : 'support');
  const scrollRef = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  // Edge-to-edge Android ignores adjustResize, so follow the keyboard ourselves.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  const kbOpen = kbHeight > 0;
  // Offline => the header shows "Reconnecting..." until the network is back (Trust parity).
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((st) => {
      // isInternetReachable is null while unknown; only treat an explicit false / not-connected as offline.
      setOffline(st.isConnected === false || st.isInternetReachable === false);
    });
    return () => unsub();
  }, []);
  const [recents, setRecents] = useState<SavedChat[]>(RECENTS);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // Hosted brain when the build has a key, otherwise the offline engine.
  const brain = APP_CONFIG.OPENROUTER_API_KEY ? openRouterBrain : localBrain;
  const chat = useAiChat(ctx, brain);
  const { messages, thinking, busy } = chat;
  const started = messages.length > 0;

  // Keep the active chat's snapshot in Recents as it grows.
  useEffect(() => {
    if (messages.length === 0 || busy) return;
    const id = activeId ?? 'c' + Date.now().toString(36);
    if (!activeId) setActiveId(id);
    const entry: SavedChat = { id, title: chatTitle(messages), messages, at: Date.now() };
    RECENTS = [entry, ...RECENTS.filter((c) => c.id !== id)].slice(0, 30);
    setRecents(RECENTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, busy]);

  const newChat = () => { chat.reset(); setActiveId(null); setMode('fresh'); setMenuOpen(false); };
  const openChat = (c: SavedChat) => { chat.load(c.messages); setActiveId(c.id); setMenuOpen(false); };
  const firstUser = messages.find((m) => m.role === 'user')?.text;
  // Trust parity: a fresh chat shows 'Veltravia AI' until the first send, then 'New Chat'. The first
  // message text only names the chat in the drawer's recents, never the header.
  const title = firstUser ? 'New Chat' : mode === 'fresh' ? 'Veltravia AI' : 'New Chat';

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, thinking, kbHeight]);

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
    <View style={[styles.root, { backgroundColor: pageBg, paddingBottom: kbHeight > 0 ? kbHeight + insets.bottom : 0 }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => setMenuOpen(true)} style={[styles.hBtn, { backgroundColor: chipBg }]}>
          <MenuLinesIcon color={ink} />
        </Pressable>
        {started && (
          <Pressable hitSlop={10} onPress={newChat} accessibilityLabel="New chat" style={[styles.hBtn, { backgroundColor: chipBg }]}>
            <ComposeIcon color={ink} />
          </Pressable>
        )}
        {offline ? (
          <View style={styles.reconnect}>
            <ArcSpinner color={muted} />
            <Text numberOfLines={1} style={[styles.reconnectText, { color: muted }]}>Reconnecting...</Text>
          </View>
        ) : (
          <Text numberOfLines={1} style={[styles.title, { color: ink }]}>{title}</Text>
        )}
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
        {!started && mode === 'support' && (
          <Text style={[styles.greet, { color: ink }]}>
            {'Hi \u{1F44B} How can I help? Choose an option below or type a message.'}
          </Text>
        )}
        {!started && mode === 'fresh' && (
          <View style={styles.freshWrap}>
            <Text style={[styles.freshText, { color: muted }]}>How can I help you today?</Text>
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

      {!started && mode === 'fresh' && (
        <View style={styles.topics}>
          {FRESH_SUGGESTIONS.map((t) => (
            <Pressable
              key={t.label}
              onPress={() => chat.send(t.label)}
              style={({ pressed }) => [
                styles.suggest,
                { borderColor: dark ? 'rgba(255,255,255,0.18)' : '#DEDEE4', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <SuggestIcon kind={t.icon} color={muted} />
              <Text style={[styles.topicText, { color: ink }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!started && mode === 'support' && (
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
      )}

      {/* input */}
      <View style={[styles.inputWrap, { paddingBottom: kbOpen ? 10 : Math.max(insets.bottom, 12) }]}>
        <View
          style={[
            styles.input,
            {
              borderColor: dark ? 'rgba(255,255,255,0.14)' : '#E3E3E8',
              backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
              opacity: offline ? 0.55 : 1,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask anything"
            placeholderTextColor={muted}
            style={[styles.inputText, { color: ink }]}
            onSubmitEditing={submit}
            returnKeyType="send"
            // Wrap onto new lines instead of scrolling sideways, but keep the keyboard's
            // "Send" key: submitBehavior=submit stops Enter from inserting a newline.
            multiline
            submitBehavior="submit"
            // Top-anchored: as the box grows the text stays put and the box grows UP
            // (center-anchoring made the text slide down on every new line).
            textAlignVertical="top"
            scrollEnabled
            editable={!busy && !offline}
          />
          {busy ? (
            <Pressable onPress={chat.stop} style={[styles.sendBtn, { backgroundColor: PURPLE }]} accessibilityLabel="Stop generating">
              <View style={styles.stopSquare} />
            </Pressable>
          ) : (
            <Pressable
              onPress={submit}
              disabled={!draft.trim() || offline}
              style={[styles.sendBtn, { backgroundColor: draft.trim() ? PURPLE : dark ? 'rgba(255,255,255,0.08)' : '#F0F0F5' }]}
              accessibilityLabel="Send"
            >
              <SendArrow color={draft.trim() ? '#fff' : muted} />
            </Pressable>
          )}
        </View>
        <Text style={[styles.disclaimer, { color: muted }]}>{DISCLAIMER}</Text>
      </View>

      {/* menu: Trust-style drawer */}
      <Modal visible={menuOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={[
              styles.menu,
              { backgroundColor: dark ? '#10182A' : '#FCFCFD', paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0) + 12 },
            ]}
            onPress={() => {}}
          >
            <View style={styles.menuHead}>
              <Image
                source={dark ? require('../../assets/veltravia-ai-bot-dark.png') : require('../../assets/veltravia-ai-bot-light.png')}
                style={styles.menuBot}
                resizeMode="contain"
              />
              <Text style={[styles.menuTitle, { color: ink }]}>Veltravia AI</Text>
            </View>

            <Text style={[styles.menuLabel, { color: muted }]}>Recents</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {recents.length === 0 ? (
                <Text style={[styles.menuEmpty, { color: muted }]}>Your recent chats will appear here.</Text>
              ) : (
                recents.map((c) => (
                  <Pressable key={c.id} style={styles.recentRow} onPress={() => openChat(c)}>
                    <Text numberOfLines={1} style={[styles.recentText, { color: ink }]}>{c.title}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Pressable
              onPress={newChat}
              accessibilityLabel="New chat"
              style={[styles.menuNew, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#EFEFF3', marginBottom: Math.max(insets.bottom, 16) }]}
            >
              <PlusIcon size={20} color={ink} />
              <Text style={[styles.menuNewText, { color: ink }]}>Chat</Text>
            </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, gap: 12 },
  hBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  reconnect: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reconnectText: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  thread: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 14 },
  threadEmpty: { flexGrow: 1, justifyContent: 'flex-start' },
  greet: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-500', fontWeight: '500' },
  topics: { gap: 8, alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 14 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  freshWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 360 },
  freshText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  topicText: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  userBubble: { alignSelf: 'flex-end', maxWidth: '86%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userText: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter-500', fontWeight: '500' },
  aiBlock: { gap: 8 },
  aiText: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-400', fontWeight: '400' },
  thinkLogo: { width: 22, height: 22 },
  thinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkText: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  quick: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  shortcut: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 2 },
  quickText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  inputWrap: { paddingHorizontal: 20, paddingTop: 8 },
  input: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 28, paddingLeft: 18, paddingRight: 8, minHeight: 60, paddingVertical: 8 },
  inputText: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: 'Inter-500', fontWeight: '500', paddingTop: 12, paddingBottom: 10, maxHeight: 118 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#fff' },
  disclaimer: { textAlign: 'center', fontSize: 11, marginTop: 10, fontFamily: 'Inter-500', fontWeight: '500', opacity: 0.55 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  menu: { width: '80%', height: '100%', paddingHorizontal: 20, borderTopRightRadius: 28 },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 26 },
  menuBot: { width: 48, height: 48 },
  menuTitle: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  menuLabel: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600', marginBottom: 10 },
  menuEmpty: { fontSize: 12, marginTop: 4, fontFamily: 'Inter-500', fontWeight: '500' },
  recentRow: { paddingVertical: 12 },
  recentText: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  menuNew: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  menuNewText: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
});
