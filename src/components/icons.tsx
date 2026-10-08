/**
 * Veltravia Wallet — vector icon set.
 *
 * Everything the Home mockup needs, drawn as SVG so it stays crisp on any
 * density and follows the theme (stroke color is a prop). No emoji, no
 * bitmap icons.
 */
import React from 'react';
import Svg, {
  Path,
  Circle,
  Rect,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  G,
  Polyline,
} from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24' });
const stroke = (color: string, w: number) => ({
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

/* ---------------- quick actions ---------------- */
export const SendIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M7 17L17 7" {...stroke(color, strokeWidth)} />
    <Path d="M8 7h9v9" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const ReceiveIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 4v11" {...stroke(color, strokeWidth)} />
    <Path d="M7 11l5 5 5-5" {...stroke(color, strokeWidth)} />
    <Path d="M5 20h14" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const SwapIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M5 8h14" {...stroke(color, strokeWidth)} />
    <Path d="M15 4l4 4-4 4" {...stroke(color, strokeWidth)} />
    <Path d="M19 16H5" {...stroke(color, strokeWidth)} />
    <Path d="M9 12l-4 4 4 4" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const BuyIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Rect x="3" y="5.5" width="18" height="13" rx="2.5" {...stroke(color, strokeWidth)} />
    <Path d="M3 10h18" {...stroke(color, strokeWidth)} />
    <Path d="M7 15h3" {...stroke(color, strokeWidth)} />
  </Svg>
);

/* ---------------- header ---------------- */
/** Profile avatar placeholder — replaced by the user's photo in Phase 2. */
export const PersonIcon = ({ size = 24, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="8.2" r="3.6" fill={color} />
    <Path
      d="M5 19.5c.8-3.4 3.6-5 7-5s6.2 1.6 7 5c.2.8-.4 1.5-1.2 1.5H6.2c-.8 0-1.4-.7-1.2-1.5z"
      fill={color}
    />
  </Svg>
);
export const BellIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path
      d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16z"
      {...stroke(color, strokeWidth)}
    />
    <Path d="M10 21a2 2 0 004 0" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** QR scan (header action, replaces the profile slot). */
export const ScanIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 8V6a2 2 0 012-2h2" {...stroke(color, strokeWidth)} />
    <Path d="M16 4h2a2 2 0 012 2v2" {...stroke(color, strokeWidth)} />
    <Path d="M20 16v2a2 2 0 01-2 2h-2" {...stroke(color, strokeWidth)} />
    <Path d="M8 20H6a2 2 0 01-2-2v-2" {...stroke(color, strokeWidth)} />
    <Path d="M4 12h16" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const EyeIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path
      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
      {...stroke(color, strokeWidth)}
    />
    <Circle cx="12" cy="12" r="3" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const ChevronRight = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M9 6l6 6-6 6" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Small trend arrows used in the 24h change pill. */
export const ArrowUpSmall = ({ size = 12, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Path d="M3 7.5l3-3 3 3" {...stroke(color, 1.8)} />
  </Svg>
);
export const DashSmall = ({ size = 12, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Circle cx="6" cy="6" r="2.4" {...stroke(color, 1.5)} />
  </Svg>
);

/* ---------------- tab bar ---------------- */
export const HomeTabIcon = ({ size = 24, color = '#000', filled }: IconProps & { filled?: boolean }) => (
  <Svg {...base(size)}>
    <Path
      d="M4 11.2L12 4l8 7.2V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1v-7.8z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
  </Svg>
);

export const MarketsTabIcon = ({ size = 24, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6 20V11" {...stroke(color, 2)} />
    <Path d="M12 20V5" {...stroke(color, 2)} />
    <Path d="M18 20v-6" {...stroke(color, 2)} />
    <Path d="M4 20h16" {...stroke(color, 1.6)} />
  </Svg>
);

export const DiscoverTabIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="9" {...stroke(color, strokeWidth)} />
    <Path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const SettingsTabIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 7h9M17 7h3" {...stroke(color, strokeWidth)} />
    <Circle cx="15" cy="7" r="2" {...stroke(color, strokeWidth)} />
    <Path d="M4 12h3M11 12h9" {...stroke(color, strokeWidth)} />
    <Circle cx="9" cy="12" r="2" {...stroke(color, strokeWidth)} />
    <Path d="M4 17h9M17 17h3" {...stroke(color, strokeWidth)} />
    <Circle cx="15" cy="17" r="2" {...stroke(color, strokeWidth)} />
  </Svg>
);

/* ---------------- UI chrome (close / back / plus / support / sliders / more / shield) ---------------- */
export const CloseIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6 6l12 12M18 6L6 18" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const BackIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M15 5l-7 7 7 7" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const PlusIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 5v14M5 12h14" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const MoreIcon = ({ size = 24, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="5.5" cy="12" r="1.7" fill={color} />
    <Circle cx="12" cy="12" r="1.7" fill={color} />
    <Circle cx="18.5" cy="12" r="1.7" fill={color} />
  </Svg>
);

/** Customer-support headset. */
export const SupportIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 14v-2a8 8 0 0 1 16 0v2" {...stroke(color, strokeWidth)} />
    <Rect x="3" y="13" width="4" height="6" rx="1.6" {...stroke(color, strokeWidth)} />
    <Rect x="17" y="13" width="4" height="6" rx="1.6" {...stroke(color, strokeWidth)} />
    <Path d="M19 19c0 1.7-1.8 2.5-4.5 2.5H13" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Settings: three horizontal sliders (clean, professional; no gear teeth). */
export const SlidersIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 7h9M17 7h3" {...stroke(color, strokeWidth)} />
    <Circle cx="15" cy="7" r="2" {...stroke(color, strokeWidth)} />
    <Path d="M4 12h3M11 12h9" {...stroke(color, strokeWidth)} />
    <Circle cx="9" cy="12" r="2" {...stroke(color, strokeWidth)} />
    <Path d="M4 17h9M17 17h3" {...stroke(color, strokeWidth)} />
    <Circle cx="15" cy="17" r="2" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Import / restore: arrow into a tray. */
export const ImportIcon = ({ size = 24, color = '#000', strokeWidth = 1.9 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" {...stroke(color, strokeWidth)} />
    <Path d="M5 19h14" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Settings gear: ring with 8 rounded teeth and a centre hub. */
export const GearIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path
      d="M10.3 3.4a1.8 1.8 0 0 1 3.4 0l.3.9a1.8 1.8 0 0 0 2.4 1l.9-.4a1.8 1.8 0 0 1 2.4 2.4l-.4.9a1.8 1.8 0 0 0 1 2.4l.9.3a1.8 1.8 0 0 1 0 3.4l-.9.3a1.8 1.8 0 0 0-1 2.4l.4.9a1.8 1.8 0 0 1-2.4 2.4l-.9-.4a1.8 1.8 0 0 0-2.4 1l-.3.9a1.8 1.8 0 0 1-3.4 0l-.3-.9a1.8 1.8 0 0 0-2.4-1l-.9.4a1.8 1.8 0 0 1-2.4-2.4l.4-.9a1.8 1.8 0 0 0-1-2.4l-.9-.3a1.8 1.8 0 0 1 0-3.4l.9-.3a1.8 1.8 0 0 0 1-2.4l-.4-.9A1.8 1.8 0 0 1 6.7 4.9l.9.4a1.8 1.8 0 0 0 2.4-1l.3-.9z"
      {...stroke(color, strokeWidth)}
    />
    <Circle cx="12" cy="12" r="3.2" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Cloud outline for the backup action. */
export const CloudIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path
      d="M7 18.5h10.2a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z"
      {...stroke(color, strokeWidth)}
    />
  </Svg>
);

/** Pencil (edit badge on the avatar). */
export const PencilIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" {...stroke(color, strokeWidth)} />
    <Path d="M14.5 6.5l3 3" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Cloud with an up arrow: the backup row icon. */
export const CloudUploadIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M7 18.5h10.2a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z" {...stroke(color, strokeWidth)} />
    <Path d="M12 16v-5M9.8 12.9L12 10.7l2.2 2.2" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Face / biometric scan frame: the "Show secret phrase" row icon. */
export const ScanFaceIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" {...stroke(color, strokeWidth)} />
    <Path d="M9 10v1.2M15 10v1.2M12 10v3.2h-1M9.2 15.6c1.7 1.4 4 1.4 5.6 0" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Filled info / alert circle (warning card). */
export const AlertCircleIcon = ({ size = 24, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M12 7v6" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    <Circle cx="12" cy="16.6" r="1.25" fill="#FFFFFF" />
  </Svg>
);

/** Outline info circle (muted notes). */
export const InfoCircleIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="9" {...stroke(color, strokeWidth)} />
    <Path d="M12 11v5" {...stroke(color, strokeWidth + 0.2)} />
    <Circle cx="12" cy="7.7" r="1.1" fill={color} />
  </Svg>
);

/** Check mark (checkbox tick). */
export const CheckIcon = ({ size = 24, color = '#000', strokeWidth = 2.6 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M5 12.5l4.6 4.6L19 7.5" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Shield with a fingerprint-style lock, used on the secret-phrase gate sheet. */
export const SecretShieldArt = ({ size = 150 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 160 160">
    <Defs>
      <SvgGradient id="ssA" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#6C63FF" />
        <Stop offset="1" stopColor="#4A90D9" />
      </SvgGradient>
      <SvgGradient id="ssB" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#7CF2C4" />
        <Stop offset="1" stopColor="#3FA9F5" />
      </SvgGradient>
    </Defs>
    <Path d="M80 14l50 20v38c0 32-21 55-50 68-29-13-50-36-50-68V34l50-20z" fill="url(#ssB)" />
    <Path d="M80 14l50 20v38c0 32-21 55-50 68V14z" fill="url(#ssA)" opacity={0.85} />
    <Rect x="56" y="62" width="58" height="34" rx="6" fill="#FFFFFF" opacity={0.95} />
    <Path d="M66 79h6M78 79h6M90 79h6" stroke="#6C63FF" strokeWidth={4} strokeLinecap="round" />
    <Rect x="64" y="38" width="52" height="30" rx="6" fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.9} />
    <Path d="M90 44c-5 0-9 4-9 9v6M90 48c-3 0-5 2-5 5v6M90 52v7M96 49c2 1 4 3 4 6v5" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" fill="none" />
  </Svg>
);

export const ShieldCheckIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6l7-3z" {...stroke(color, strokeWidth)} />
    <Path d="M8.8 12.2l2.4 2.4 4.2-4.6" {...stroke(color, strokeWidth)} />
  </Svg>
);

/* ---------------- brand mark ---------------- */
/** Veltravia "V" mark: two folded ribbons, purple→blue (header logo). */
export const VeltraviaMark = ({ size = 32 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Defs>
      <SvgGradient id="vmA" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#7B4DFF" />
        <Stop offset="1" stopColor="#4F46F0" />
      </SvgGradient>
      <SvgGradient id="vmB" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#5B8CFF" />
        <Stop offset="1" stopColor="#27B3FF" />
      </SvgGradient>
    </Defs>
    <Path d="M2 5h8.5l5.5 12.5L13 25 2 5z" fill="url(#vmA)" />
    <Path d="M30 5h-8.5L16 17.5 19 25 30 5z" fill="url(#vmB)" />
    <Path d="M10.5 5L16 17.5 21.5 5" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={0.8} />
  </Svg>
);

/* ---------------- coin logos ---------------- */
export const CoinEth = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Defs>
      <SvgGradient id="ethBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#7C94F5" />
        <Stop offset="1" stopColor="#4A63E0" />
      </SvgGradient>
    </Defs>
    <Circle cx="20" cy="20" r="20" fill="url(#ethBg)" />
    <Path d="M20 6l-8 13.4 8 4.7 8-4.7L20 6z" fill="#fff" fillOpacity={0.95} />
    <Path d="M12 21.4L20 34l8-12.6-8 4.7-8-4.7z" fill="#fff" fillOpacity={0.7} />
  </Svg>
);

export const CoinBnb = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Circle cx="20" cy="20" r="20" fill="#F3BA2F" />
    <G fill="#fff">
      <Path d="M20 8.5l3.2 3.2-3.2 3.2-3.2-3.2L20 8.5z" />
      <Path d="M11 17.5l3.2 3.2L11 23.9l-3.2-3.2L11 17.5z" />
      <Path d="M29 17.5l3.2 3.2-3.2 3.2-3.2-3.2L29 17.5z" />
      <Path d="M20 26.6l3.2 3.2L20 33l-3.2-3.2 3.2-3.2z" />
      <Path d="M20 15.8l4.9 4.9-4.9 4.9-4.9-4.9 4.9-4.9z" />
    </G>
  </Svg>
);

export const CoinUsdt = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Circle cx="20" cy="20" r="20" fill="#26A17B" />
    <Path d="M11 12.5h18v3.6h-7.2v3.2c4.5.2 7.8 1.1 7.8 2.3s-3.3 2.1-7.8 2.3V31h-3.6v-6.9c-4.5-.2-7.8-1.1-7.8-2.3s3.3-2.1 7.8-2.3v-3.2H11v-3.8z" fill="#fff" />
    <Path d="M20 20.3c-3.7 0-6.7.6-6.7 1.4S16.3 23 20 23s6.7-.5 6.7-1.3-3-1.4-6.7-1.4z" fill="#26A17B" />
  </Svg>
);

export const CoinPolygon = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Defs>
      <SvgGradient id="polyBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#9B5DF5" />
        <Stop offset="1" stopColor="#7A3FE0" />
      </SvgGradient>
    </Defs>
    <Circle cx="20" cy="20" r="20" fill="url(#polyBg)" />
    <Path
      d="M24.6 15.4a1.9 1.9 0 00-1.9 0l-2.9 1.7-2 1.1-2.9 1.7a1.9 1.9 0 01-1.9 0l-2.3-1.3a1.9 1.9 0 01-1-1.6v-2.6c0-.7.4-1.3 1-1.6l2.2-1.3a1.9 1.9 0 011.9 0l2.2 1.3c.6.4 1 1 1 1.6v1.7l2-1.2v-1.7c0-.7-.4-1.3-1-1.6l-4.2-2.5a1.9 1.9 0 00-1.9 0L9.6 12.4c-.6.3-1 1-1 1.6v5c0 .7.4 1.3 1 1.6l4.2 2.5c.6.3 1.3.3 1.9 0l2.9-1.7 2-1.2 2.9-1.7c.6-.3 1.3-.3 1.9 0l2.2 1.3c.6.4 1 1 1 1.6v2.6c0 .7-.4 1.3-1 1.6l-2.2 1.3a1.9 1.9 0 01-1.9 0l-2.2-1.3c-.6-.4-1-1-1-1.6v-1.7l-2 1.2v1.7c0 .7.4 1.3 1 1.6l4.2 2.5c.6.3 1.3.3 1.9 0l4.2-2.5c.6-.3 1-1 1-1.6v-5c0-.7-.4-1.3-1-1.6l-4.3-2.5z"
      fill="#fff"
    />
  </Svg>
);

export const CoinSolana = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Defs>
      <SvgGradient id="solG" x1="0" y1="1" x2="1" y2="0">
        <Stop offset="0" stopColor="#9945FF" />
        <Stop offset="1" stopColor="#14F195" />
      </SvgGradient>
    </Defs>
    <Circle cx="20" cy="20" r="20" fill="#0B0B12" />
    <G fill="url(#solG)">
      <Path d="M11.6 24.4a.9.9 0 01.6-.3h16.5c.4 0 .6.5.3.8l-3 3a.9.9 0 01-.6.3H8.9c-.4 0-.6-.5-.3-.8l3-3z" />
      <Path d="M11.6 11.9a.9.9 0 01.6-.3h16.5c.4 0 .6.5.3.8l-3 3a.9.9 0 01-.6.3H8.9c-.4 0-.6-.5-.3-.8l3-3z" />
      <Path d="M25.4 18.1a.9.9 0 00-.6-.3H8.3c-.4 0-.6.5-.3.8l3 3c.2.2.4.3.6.3h16.5c.4 0 .6-.5.3-.8l-3-3z" />
    </G>
  </Svg>
);

export const COIN_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  ETH: CoinEth,
  BNB: CoinBnb,
  USDT: CoinUsdt,
  MATIC: CoinPolygon,
  POL: CoinPolygon,
  SOL: CoinSolana,
};
