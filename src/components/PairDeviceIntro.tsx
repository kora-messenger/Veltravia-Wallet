/**
 * Veltravia Wallet — "Pair a New Device" introduction.
 *
 * This is the screen shown BEFORE any code exists. It explains what is about to
 * happen, what the other phone will get, and how long the code lives, so the
 * owner can decide while nothing has been minted yet.
 *
 * The illustration is drawn in vector rather than shipped as a bitmap: it has to
 * hold up on every density, and its glow and dashed link scale without blurring.
 * It is decorative, so it is hidden from screen readers; the title and the list
 * carry the meaning.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { ShieldCheckIcon, ClockIcon } from './icons';

const VIOLET = '#584CFF';
const DEEP = '#3B3BFF';
const TEAL = '#22D3EE';

/* A 4-point star, the small sparkle beside the phones. */
function Sparkle({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const d = `M ${x} ${y - r} Q ${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y} Q ${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r} Q ${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y} Q ${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r} Z`;
  return <Path d={d} fill={color} />;
}

/* A tiny QR: three finder squares, a scatter of modules. */
function MiniQr({ x, y, s, fg, bg }: { x: number; y: number; s: number; fg: string; bg: string }) {
  const u = s / 21; // 21 modules, the smallest real QR version
  const finder = (fx: number, fy: number) => (
    <G key={`${fx}-${fy}`}>
      <Rect x={x + fx * u} y={y + fy * u} width={u * 7} height={u * 7} rx={u * 1.6} fill={fg} />
      <Rect x={x + (fx + 1) * u} y={y + (fy + 1) * u} width={u * 5} height={u * 5} rx={u} fill={bg} />
      <Rect x={x + (fx + 2) * u} y={y + (fy + 2) * u} width={u * 3} height={u * 3} rx={u * 0.6} fill={fg} />
    </G>
  );
  const modules = [
    [10, 2], [12, 2], [14, 3], [10, 4], [13, 5], [11, 7], [15, 7], [10, 9], [12, 9], [14, 10],
    [11, 12], [13, 13], [15, 13], [10, 15], [12, 16], [14, 17], [11, 18], [13, 19], [15, 15],
    [2, 10], [4, 10], [6, 11], [3, 12], [5, 13], [7, 14], [2, 14], [4, 16], [6, 17], [3, 18],
    [8, 10], [9, 12], [7, 8], [16, 4], [18, 6], [17, 9],
  ];
  return (
    <G>
      <Rect x={x - u} y={y - u} width={s + u * 2} height={s + u * 2} rx={u * 2} fill={bg} />
      {modules.map(([mx, my], i) => (
        <Rect key={i} x={x + mx * u} y={y + my * u} width={u} height={u} rx={u * 0.28} fill={fg} />
      ))}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </G>
  );
}

export function PairIntroArt({ width = 300 }: { width?: number }) {
  const h = Math.round(width * 0.62);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width, height: h, alignSelf: 'center' }}
    >
      <Svg width={width} height={h} viewBox="0 0 300 186">
        <Defs>
          <LinearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={TEAL} />
            <Stop offset="0.5" stopColor={VIOLET} />
            <Stop offset="1" stopColor={DEEP} />
          </LinearGradient>
          <LinearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={TEAL} stopOpacity="0.9" />
            <Stop offset="1" stopColor={VIOLET} stopOpacity="0.9" />
          </LinearGradient>
          <LinearGradient id="halo" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={VIOLET} stopOpacity="0.16" />
            <Stop offset="1" stopColor={TEAL} stopOpacity="0.04" />
          </LinearGradient>
        </Defs>

        {/* soft aura behind the whole group */}
        <Circle cx="150" cy="94" r="88" fill="url(#halo)" />
        <Circle cx="150" cy="94" r="66" fill="none" stroke={VIOLET} strokeOpacity="0.10" />

        {/* the dashed link, drawn under the phones so it appears to pass behind them */}
        <Path
          d="M 74 100 C 100 58, 200 58, 226 100"
          fill="none"
          stroke="url(#glow)"
          strokeWidth="2.4"
          strokeDasharray="7 6"
          strokeLinecap="round"
        />

        {/* left phone, dark UI */}
        <G>
          <Rect x="30" y="42" width="70" height="118" rx="12" fill="#0B1020" />
          <Rect x="30" y="42" width="70" height="118" rx="12" fill="none" stroke="#1E2A4A" strokeWidth="1.2" />
          <Rect x="58" y="47" width="14" height="2.6" rx="1.3" fill="#25314F" />
          <Rect x="38" y="57" width="34" height="2.8" rx="1.4" fill="#4E5B7D" />
          <Rect x="38" y="63" width="46" height="2.2" rx="1.1" fill="#2A3450" />
          <Rect x="38" y="68" width="40" height="2.2" rx="1.1" fill="#2A3450" />
          <MiniQr x={41} y={78} s={48} fg="#0B1020" bg="#FFFFFF" />
          <Rect x="41" y="133" width="26" height="8" rx="4" fill="#1B2440" />
          <Rect x="71" y="133" width="22" height="8" rx="4" fill={VIOLET} />
          <Rect x="41" y="146" width="52" height="8" rx="4" fill="#1B2440" />
        </G>

        {/* right phone, light UI */}
        <G>
          <Rect x="200" y="42" width="70" height="118" rx="12" fill="#FFFFFF" stroke="#E4E7F2" strokeWidth="1.2" />
          <Rect x="228" y="47" width="14" height="2.6" rx="1.3" fill="#DCE0EE" />
          <Rect x="208" y="57" width="34" height="2.8" rx="1.4" fill="#B9C0D6" />
          <Rect x="208" y="63" width="46" height="2.2" rx="1.1" fill="#E7EAF4" />
          <Rect x="208" y="68" width="40" height="2.2" rx="1.1" fill="#E7EAF4" />
          <MiniQr x={211} y={78} s={48} fg="#101828" bg="#F6F7FC" />
          {/* scanner brackets over the light phone's code */}
          <Path d="M 207 84 h 6 M 207 84 v 6" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M 263 84 h -6 M 263 84 v 6" stroke={VIOLET} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M 207 122 h 6 M 207 122 v -6" stroke={VIOLET} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M 263 122 h -6 M 263 122 v -6" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Rect x="211" y="133" width="48" height="8" rx="4" fill="#EFF1F8" />
          <Rect x="211" y="146" width="48" height="8" rx="4" fill="#EFF1F8" />
        </G>

        {/* the shield that ties them together */}
        <G>
          <Circle cx="150" cy="62" r="21" fill="#FFFFFF" opacity="0.9" />
          <Path
            d="M150 44 l14 5.2 v10.6 c0 9.4 -6.6 16.4 -14 19.4 c-7.4 -3 -14 -10 -14 -19.4 V49.2 Z"
            fill="url(#shield)"
          />
          <Rect x="145" y="56.5" width="10" height="8.4" rx="2.2" fill="#FFFFFF" />
          <Path d="M147.4 56.5 v-2.6 a2.6 2.6 0 0 1 5.2 0 v2.6" stroke="#FFFFFF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        </G>

        {/* sparkles */}
        <Sparkle x={18} y={74} r={6} color="#A5B4FC" />
        <Sparkle x={282} y={78} r={5} color="#C7D2FE" />
        <Sparkle x={24} y={148} r={4} color="#C7D2FE" />
      </Svg>
    </View>
  );
}

export interface IntroFeature {
  title: string;
  body: string;
  icon: 'shield' | 'phone' | 'clock';
}

export const PAIR_FEATURES: IntroFeature[] = [
  {
    title: 'Secure & Encrypted',
    body: 'Your wallet stays protected. No one can access your funds without your permission.',
    icon: 'shield',
  },
  {
    title: 'Link to Your Wallet',
    body: 'The new device will have the same wallet, addresses and balance as this device.',
    icon: 'phone',
  },
  {
    title: 'QR Code Expires',
    body: 'The code will expire in 60 seconds for your security.',
    icon: 'clock',
  },
];

function PhoneGlyph({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6.5" y="2.5" width="11" height="19" rx="2.6" fill="none" stroke={color} strokeWidth="1.8" />
      <Rect x="10" y="18.4" width="4" height="1.5" rx="0.75" fill={color} />
    </Svg>
  );
}

export default function PairDeviceIntro({
  accent,
  accentText,
  titleColor,
  bodyColor,
}: {
  accent: string;
  accentText: string;
  titleColor: string;
  bodyColor: string;
}) {
  return (
    <View style={styles.wrap} testID="pairIntro">
      <PairIntroArt />
      <Text style={[styles.title, { color: titleColor }]} testID="pairIntroTitle">
        Pair a New Device
      </Text>
      <Text style={[styles.lede, { color: bodyColor }]}>
        Scan the QR code with your new device to securely link it to your Veltravia Wallet.
      </Text>

      <View style={styles.features}>
        {PAIR_FEATURES.map((f) => (
          <View key={f.title} style={styles.feature} testID={`pairFeature-${f.icon}`}>
            <View style={[styles.bubble, { backgroundColor: accent }]}>
              {f.icon === 'shield' ? (
                <ShieldCheckIcon size={18} color={accentText} strokeWidth={1.9} />
              ) : f.icon === 'clock' ? (
                <ClockIcon size={18} color={accentText} strokeWidth={1.9} />
              ) : (
                <PhoneGlyph color={accentText} />
              )}
            </View>
            <View style={styles.featureBody}>
              <Text style={[styles.featureTitle, { color: titleColor }]}>{f.title}</Text>
              <Text style={[styles.featureText, { color: bodyColor }]}>{f.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.notice, { backgroundColor: accent }]} testID="pairNotice">
        <ShieldCheckIcon size={16} color={accentText} strokeWidth={2} />
        <Text style={[styles.noticeText, { color: accentText }]}>
          Only show this QR code to someone you are pairing in person. Do not share it with anyone.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  lede: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', paddingHorizontal: 6 },
  features: { gap: 14, marginTop: 6 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  featureBody: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 14.5, fontFamily: 'Inter-600', fontWeight: '600' },
  featureText: { fontSize: 12.5, lineHeight: 18 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginTop: 6 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17.5, fontFamily: 'Inter-500' },
});
