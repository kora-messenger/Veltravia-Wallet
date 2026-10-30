/**
 * Veltravia Wallet — Import crypto (2-in-1, Trust parity).
 * Opened by the "+" on Manage crypto.
 *
 * Header: back arrow, centered title, round (i) info button.
 * Two swipeable pages under an animated-underline tab bar:
 *   Token   - amber scam warning, Network picker, Address (Paste + scan),
 *             Name, Symbol, Decimals, Import.
 *   Network - amber warning, Network + Chainlist pickers, Name, Symbol,
 *             Node URL, Explorer URL (Optional), Import.
 * Fields are outlined with grey labels above; errors show only after the
 * user taps Import. Import stays tappable (Trust style) and validates.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, Animated, Keyboard,
  useWindowDimensions, Linking, KeyboardAvoidingView, Platform, type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, ScanIcon, InfoCircleIcon, ChevronRight } from '../components/icons';
import { NETWORKS } from '../data/assetCatalog';
import { pasteFromClipboard } from '../core/clipboard';
import { registerScanTarget } from '../services/scanTarget';
import { readSettings, writeSettings } from '../core/storage/secureStorage';
import { showToast } from '../components/Toast';
import {
  validateToken, validateNetwork, hasErrors,
  type TokenFormErrors, type NetworkFormErrors, type CustomToken, type CustomNetwork,
} from '../data/customAssets';

const EVM = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanche', 'celo'];
const AMBER_BG = '#F4E5DA';
const AMBER_DOT = '#B45309';

function WarnBanner({ text, learnMore }: { text: string; learnMore?: boolean }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  return (
    <View style={[styles.banner, { backgroundColor: dark ? 'rgba(180,83,9,0.18)' : AMBER_BG }]}>
      <View style={styles.bannerDot}><Text style={styles.bannerDotText}>i</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerText, { color: theme.ink }]}>{text}</Text>
        {learnMore && (
          <Pressable hitSlop={8} onPress={() => Linking.openURL('https://veltraviawallet.com/security').catch(() => {})}>
            <Text style={[styles.learnMore, { color: theme.brand }]}>Learn more</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Field({
  label, error, right, picker, onPick, ...input
}: { label: string; error?: string; right?: React.ReactNode; picker?: boolean; onPick?: () => void } & TextInputProps) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const border = error ? '#DC2626' : dark ? 'rgba(255,255,255,0.14)' : '#D9DAE0';
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: theme.inkMuted }]}>{label}</Text>
      <Pressable disabled={!picker} onPress={onPick} style={[styles.box, { borderColor: border, backgroundColor: dark ? '#12141F' : '#FFFFFF' }]}>
        <TextInput
          style={[styles.boxInput, { color: theme.ink }]}
          placeholderTextColor={theme.inkMuted}
          editable={!picker}
          pointerEvents={picker ? 'none' : 'auto'}
          autoCapitalize="none"
          autoCorrect={false}
          {...input}
        />
        {right}
      </Pressable>
      {!!error && <Text style={styles.err}>{error}</Text>}
    </View>
  );
}

export default function ImportCryptoScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<0 | 1>(0);

  // token form
  const [tNet, setTNet] = useState('ethereum');
  const [addr, setAddr] = useState('');
  const [tName, setTName] = useState('');
  const [tSym, setTSym] = useState('');
  const [tDec, setTDec] = useState('');
  const [tErr, setTErr] = useState<TokenFormErrors>({});

  // network form
  const [nBase, setNBase] = useState('ethereum');
  const [chainlist, setChainlist] = useState('');
  const [nName, setNName] = useState('');
  const [nSym, setNSym] = useState('');
  const [node, setNode] = useState('');
  const [explorer, setExplorer] = useState('');
  const [nErr, setNErr] = useState<NetworkFormErrors>({});

  const netName = (id: string) => NETWORKS.find((n) => n.id === id)?.name ?? id;

  // Cycle through networks on tap until the dedicated picker sheet lands.
  const cycleNet = (cur: string, set: (v: string) => void) => {
    const i = NETWORKS.findIndex((n) => n.id === cur);
    set(NETWORKS[(i + 1) % NETWORKS.length].id);
  };

  const goTab = (i: 0 | 1) => {
    Keyboard.dismiss();
    setTab(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  // Scan a QR to fill the contract address; unregistered on unmount.
  useEffect(
    () =>
      registerScanTarget(
        (v) => {
          setAddr(v.startsWith('ethereum:') ? v.slice(9) : v);
        },
        undefined,
        {
          title: 'Scan token address',
          accept: (raw) => {
            const value = raw.startsWith('ethereum:') ? raw.slice(9) : raw;
            // A contract address, not a phrase or a pairing code.
            return /^0x[0-9a-fA-F]{40}$/.test(value)
              ? { ok: true as const, value }
              : { ok: false as const, reason: "That QR code isn't a token address." };
          },
        },
      ),
    [],
  );
  const openScanner = () => navigation.navigate('ScanQr');

  const paste = async () => {
    const t = (await pasteFromClipboard()).trim();
    if (!t) return showToast('Clipboard is empty', { kind: 'info' });
    setAddr(t);
  };

  const importToken = async () => {
    const e = validateToken({ address: addr, name: tName, symbol: tSym, decimals: tDec }, EVM.includes(tNet));
    setTErr(e);
    if (hasErrors(e)) return;
    const st = await readSettings();
    const list: CustomToken[] = Array.isArray(st.customTokens) ? st.customTokens : [];
    if (list.some((x) => x.network === tNet && x.address.toLowerCase() === addr.trim().toLowerCase())) {
      return showToast('This token is already imported', { kind: 'info' });
    }
    list.push({ network: tNet, address: addr.trim(), name: tName.trim(), symbol: tSym.trim().toUpperCase(), decimals: Number(tDec) });
    const enabledNow: string[] = Array.isArray(st.enabledAssets) ? st.enabledAssets : [];
    await writeSettings({
      customTokens: list,
      enabledAssets: Array.from(new Set([...enabledNow, `${tSym.trim().toUpperCase()}:${tNet}`])),
    });
    showToast(`${tSym.trim().toUpperCase()} imported`, { kind: 'success' });
    navigation.goBack();
  };

  const importNetwork = async () => {
    const e = validateNetwork({ name: nName, symbol: nSym, nodeUrl: node, explorerUrl: explorer });
    setNErr(e);
    if (hasErrors(e)) return;
    const st = await readSettings();
    const list: CustomNetwork[] = Array.isArray(st.customNetworks) ? st.customNetworks : [];
    list.push({
      id: `custom-${Date.now()}`, name: nName.trim(), symbol: nSym.trim().toUpperCase(),
      nodeUrl: node.trim(), explorerUrl: explorer.trim() || undefined, chainlist: chainlist || undefined,
    });
    await writeSettings({ customNetworks: list });
    showToast(`${nName.trim()} added`, { kind: 'success' });
    navigation.goBack();
  };

  const indicatorX = scrollX.interpolate({ inputRange: [0, width], outputRange: [0, width / 2], extrapolate: 'clamp' });
  const tabActive = (i: number) =>
    scrollX.interpolate({ inputRange: [0, width], outputRange: i === 0 ? [1, 0] : [0, 1], extrapolate: 'clamp' });

  const importBtn = (onPress: () => void) => (
    <Pressable style={({ pressed }) => [styles.importBtn, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]} onPress={onPress}>
      <Text style={styles.importText}>Import</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['left', 'right', 'top']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={theme.inkMuted} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Import crypto</Text>
        <Pressable
          hitSlop={10}
          style={[styles.infoBtn, { backgroundColor: theme.mode === 'dark' ? '#3A3E54' : '#7A7E92' }]}
          onPress={() => Linking.openURL('https://veltraviawallet.com/help/custom-tokens').catch(() => {})}
        >
          <Text style={styles.infoI}>i</Text>
        </Pressable>
      </View>

      {/* tabs + animated underline */}
      <View style={styles.tabs}>
        {(['Token', 'Network'] as const).map((l, i) => (
          <Pressable key={l} style={styles.tab} onPress={() => goTab(i as 0 | 1)}>
            <Animated.Text style={[styles.tabText, { color: theme.ink, opacity: Animated.add(0.5, Animated.multiply(tabActive(i), 0.5)) }]}>
              {l}
            </Animated.Text>
          </Pressable>
        ))}
        <Animated.View style={[styles.underlineSlot, { width: width / 2, transform: [{ translateX: indicatorX }] }]}>
          <View style={[styles.underline, { backgroundColor: theme.brand }]} />
        </Animated.View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          ref={pager as any}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onMomentumScrollEnd={(e) => setTab(e.nativeEvent.contentOffset.x >= width / 2 ? 1 : 0)}
        >
          {/* ---------------- Token page ---------------- */}
          <ScrollView style={{ width }} contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <WarnBanner learnMore text="Anyone can create a token, including fake versions of existing tokens. Learn about scams and security risks." />
            <Field label="Network" value={netName(tNet)} picker onPick={() => cycleNet(tNet, setTNet)} />
            <Field
              label="Address"
              value={addr}
              onChangeText={setAddr}
              error={tErr.address}
              right={
                <View style={styles.addrActions}>
                  <Pressable hitSlop={10} onPress={paste}><Text style={[styles.paste, { color: theme.brand }]}>Paste</Text></Pressable>
                  <Pressable hitSlop={10} onPress={openScanner}>
                    <ScanIcon size={24} color={theme.inkMuted} />
                  </Pressable>
                </View>
              }
            />
            <Field label="Name" value={tName} onChangeText={setTName} error={tErr.name} />
            <Field label="Symbol" value={tSym} onChangeText={setTSym} error={tErr.symbol} autoCapitalize="characters" />
            <Field label="Decimals" value={tDec} onChangeText={(v) => setTDec(v.replace(/[^0-9]/g, ''))} error={tErr.decimals} keyboardType="number-pad" />
            {importBtn(importToken)}
          </ScrollView>

          {/* ---------------- Network page ---------------- */}
          <ScrollView style={{ width }} contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <WarnBanner text="A malicious network provider can lie about the state of the blockchain and record your network activity. Only add custom networks you trust." />
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Field label="Network" value={netName(nBase)} picker onPick={() => cycleNet(nBase, setNBase)} />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Chainlist"
                  value={chainlist}
                  placeholder="Select Profile"
                  picker
                  onPick={() => showToast('Chainlist profiles arrive with the backend feed', { kind: 'info' })}
                />
              </View>
            </View>
            <Field label="Name" value={nName} onChangeText={setNName} error={nErr.name} />
            <Field label="Symbol" value={nSym} onChangeText={setNSym} error={nErr.symbol} autoCapitalize="characters" />
            <Field label="Node URL" value={node} onChangeText={setNode} error={nErr.nodeUrl} keyboardType="url" />
            <Field label="Explorer URL (Optional)" value={explorer} onChangeText={setExplorer} error={nErr.explorerUrl} keyboardType="url" />
            {importBtn(importNetwork)}
          </ScrollView>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  title: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  infoBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoI: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-700', fontWeight: '800' },
  tabs: { flexDirection: 'row', height: 48 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  underlineSlot: { position: 'absolute', bottom: 0, left: 0, alignItems: 'center' },
  underline: { width: 56, height: 3, borderRadius: 2 },
  page: { paddingHorizontal: 16, paddingTop: 14 },
  banner: { flexDirection: 'row', gap: 12, borderRadius: 14, padding: 14, marginBottom: 6 },
  bannerDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: AMBER_DOT, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bannerDotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  bannerText: { fontSize: 15, fontFamily: 'Inter-400', lineHeight: 22 },
  learnMore: { fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 8 },
  fieldWrap: { marginTop: 14 },
  label: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500', marginBottom: 8 },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16 },
  boxInput: { flex: 1, fontSize: 18, fontFamily: 'Inter-600', fontWeight: '600', paddingVertical: 12 },
  addrActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  paste: { fontSize: 17, fontFamily: 'Inter-500', fontWeight: '500' },
  err: { color: '#DC2626', fontSize: 13, fontFamily: 'Inter-400', marginTop: 6 },
  twoCol: { flexDirection: 'row', gap: 16 },
  importBtn: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  importText: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
});
