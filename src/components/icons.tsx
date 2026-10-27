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
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  G,
} from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24' });
const sharp = (color: string, w: number) => ({
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'butt' as const,
  strokeLinejoin: 'miter' as const,
  fill: 'none' as const,
});
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
export const ArrowDownSmall = ({ size = 12, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Path d="M3 4.5l3 3 3-3" {...stroke(color, 1.8)} />
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
  /* Trust-style trend line: one uniform wavy stroke rising to a sharp
     arrow point at the top right, rounded terminals. Untapped the bar
     renders it in muted grey-blue; tapped it goes violet on the pill. */
  <Svg {...base(size)}>
    <Path d="M4 17l5-5 4 4 7-8" {...stroke(color, 2)} />
    <Path d="M15 8h5v5" {...stroke(color, 2)} />
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

/** Horizontal bar (Withdraw on the Perps balance pill). */
export const MinusIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M5 12h14" {...stroke(color, strokeWidth)} />
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
export const CloudIcon = ({ size = 24, color = '#000', strokeWidth = 1.7 }: IconProps) => (
  <Svg {...base(size)}>
    <Path
      d="M7.2 18.2h9.6a3.9 3.9 0 0 0 .5-7.77A5.4 5.4 0 0 0 6.9 9.7a4.25 4.25 0 0 0 .3 8.5z"
      {...stroke(color, strokeWidth)}
    />
  </Svg>
);

export const PencilIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" {...stroke(color, strokeWidth)} />
    <Path d="M14.5 6.5l3 3" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Cloud with an up arrow: the backup row icon. */
/** Drive-style triangle mark (monochrome) for the backup row. */
export const DriveTriangleIcon = ({ size = 24, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M8.6 3.5h6.8l6.1 10.5h-6.8L8.6 3.5z" fill={color} />
    <Path d="M8 4.6L1.7 15.4l3.4 5.9L11.4 10.5 8 4.6z" fill={color} />
    <Path d="M6.4 21.3h12.8l3.3-5.9H9.7l-3.3 5.9z" fill={color} />
  </Svg>
);

/** Filter: three descending lines (Activity header). */
export const FilterLinesIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 7h16M7 12h10M10 17h4" {...stroke(color, strokeWidth)} />
  </Svg>
);

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

export const ShieldCheckIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6l7-3z" {...stroke(color, strokeWidth)} />
    <Path d="M8.8 12.2l2.4 2.4 4.2-4.6" {...stroke(color, strokeWidth)} />
  </Svg>
);

/* ---------------- settings rows (Trust style: dark line icons) ------- */

/** Address Book: contact card with a person. */
export const AddressBookIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4.5 6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6z" {...stroke(color, strokeWidth)} />
    <Path d="M12 9.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM8.4 16.6c.8-1.9 6.4-1.9 7.2 0" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Perps: candlestick chart. */
export const PerpsIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6.5 6v1.6M6.5 17.4v-1.6M17.5 5v1.6M17.5 16.4v-2.2" {...stroke(color, strokeWidth)} strokeLinecap="round" />
    <Path d="M5 7.6h3v8.2H5zM16 6.6h3v7.6h-3z" {...stroke(color, strokeWidth)} strokeLinejoin="round" />
  </Svg>
);

/** Infinity lemniscate: Perps tab (perpetuals never expire). */
export const InfinityIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path
      d="M7.4 9C4.9 9 3 10.8 3 12s1.9 3 4.4 3c4.4 0 4.8-6 9.2-6 2.5 0 4.4 1.8 4.4 3s-1.9 3-4.4 3c-4.4 0-4.8-6-9.2-6z"
      {...stroke(color, strokeWidth)}
    />
  </Svg>
);

/** Generic brand tile for any asset/network without a dedicated logo. */
export const BrandTile = ({
  size = 40, color = '#6C63FF', mark = '', round = true, lightMark = true,
}: { size?: number; color?: string; mark?: string; round?: boolean; lightMark?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    {round ? <Circle cx="20" cy="20" r="20" fill={color} /> : <Rect width="40" height="40" rx="9" fill={color} />}
    {mark ? (
      <SvgText x="20" y="26.5" fontSize="18" fontWeight="700" fill={lightMark ? '#FFFFFF' : '#14151F'} textAnchor="middle">
        {mark}
      </SvgText>
    ) : (
      <Rect x="11" y="11" width="18" height="18" rx="2" fill="#FFFFFF" />
    )}
  </Svg>
);

/** Empty-search illustration: document with a magnifier (Trust's "No results found"). */
export const NoResultsIllustration = ({ size = 120 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    <Rect x="46" y="14" width="56" height="76" rx="8" fill="#ECEDF2" />
    <Path d="M60 36h30M60 48h30M60 60h20" stroke="#D5D7E0" strokeWidth="4" strokeLinecap="round" />
    <Circle cx="48" cy="62" r="24" fill="#F7F7FA" stroke="#9A9DB0" strokeWidth="6" />
    <Path d="M66 80l20 20" stroke="#9A9DB0" strokeWidth="7" strokeLinecap="round" />
  </Svg>
);

/* ---------------- social brand glyphs (filled) ---------------- */

const fill = (color: string) => ({ fill: color, fillRule: 'evenodd' as const });

/** X (Twitter). */
export const XIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M18.9 1.15h3.68l-8.04 9.19 9.46 12.51h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zM17.61 20.64h2.04L6.49 3.24H4.3l13.31 17.4z" {...fill(color)} />
  </Svg>
);

/** Telegram. */
export const TelegramIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.56-1.1.56-.72 0-.6-.27-.84-.95L6.3 13.7.85 12c-1.18-.35-1.19-1.16.26-1.7l21.26-8.2c.97-.43 1.9.24 1.53 1.7z" {...fill(color)} />
  </Svg>
);

/** YouTube. */
export const YouTubeIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" {...fill(color)} />
  </Svg>
);

/** TikTok. */
export const TikTokIcon = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.78-1.35 3.94-1.31 1.94-3.58 3.07-5.91 3.03-1.9-.07-3.73-.93-5.03-2.35-2.07-2.25-2.44-5.75-.95-8.4 1.42-2.58 4.45-3.93 7.36-3.4.02 1.48-.01 2.96 0 4.44-1.35-.22-2.76.18-3.75 1.14-.95.87-1.35 2.2-1.1 3.42.28 1.55 1.68 2.75 3.27 2.86 1.05.06 2.1-.4 2.83-1.19.6-.65.9-1.54.9-2.44.02-4.17.01-8.33.01-12.5z" {...fill(color)} />
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


export const CoinBtc = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Circle cx="20" cy="20" r="20" fill="#F7931A" />
    {/* B glyph: stem + two bowls, with the two short bars top and bottom */}
    <Path
      d="M15.5 11.5h6.2c2.5 0 4.2 1.300 4.200 3.500 0 1.500-.8 2.600-2.100 3.100 1.700.4 2.800 1.700 2.800 3.500 0 2.600-1.900 4.200-5 4.200h-6.100v-14.300z"
      fill="none"
      stroke="#fff"
      strokeWidth={2.4}
      strokeLinejoin="round"
    />
    <Path d="M15.500 18.100h6.100M18 9v2.500M21.500 9v2.500M18 25.800v2.500M21.500 25.800v2.500" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

/** Network badges used by Select network (simple brand-style marks). */
export const NetArbitrum = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Rect width="40" height="40" rx="8" fill="#2D374B" />
    <Path d="M20 7l10 5.8v11.6L20 30.2 10 24.4V12.8L20 7z" fill="none" stroke="#28A0F0" strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M15 26l6-12h2l-6 12zM20 26l5-10 1.4 2.4-3.6 7.6z" fill="#FFFFFF" />
  </Svg>
);
export const NetBase = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Rect width="40" height="40" rx="8" fill="#0000FF" />
    <Rect x="11" y="11" width="18" height="18" rx="2" fill="#FFFFFF" />
  </Svg>
);
export const NetOptimism = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Rect width="40" height="40" rx="8" fill="#FF0420" />
    <Circle cx="20" cy="20" r="9" fill="#FFFFFF" />
    <Circle cx="20" cy="20" r="4" fill="#FF0420" />
  </Svg>
);

export const NetAvalanche = ({ size = 40 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40">
    <Rect width="40" height="40" rx="8" fill="#E84142" />
    <Path d="M14 28h-4.2c-.8 0-1.2-.9-.8-1.6l9.2-16c.4-.7 1.3-.7 1.7 0l2.2 3.8c.2.4.2.8 0 1.2L15.2 27.4c-.3.4-.7.6-1.2.6z" fill="#FFFFFF" />
    <Path d="M30.3 28h-9.1c-.9 0-1.3-1-.8-1.6l2.2-3.7c.4-.7 1.3-.7 1.7 0l2.2 3.7.3.5c.3.4.2.6-.5 1.1z" fill="#FFFFFF" />
  </Svg>
);

export const COIN_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  BTC: CoinBtc,
  ETH: CoinEth,
  BNB: CoinBnb,
  USDT: CoinUsdt,
  MATIC: CoinPolygon,
  POL: CoinPolygon,
  SOL: CoinSolana,
};

/* ---------------- activity filters sheet ---------------- */
export const SearchIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="11" cy="11" r="7" {...stroke(color, strokeWidth)} />
    <Path d="M16.5 16.5L21 21" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const GlobeIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="9" {...stroke(color, strokeWidth)} />
    <Path d="M3 12h18" {...stroke(color, strokeWidth)} />
    <Path d="M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9z" {...stroke(color, strokeWidth)} />
  </Svg>
);

/* ---------------- Passcode keypad ---------------- */
export const FingerprintIcon = ({ size = 24, color = '#000', strokeWidth = 1.6 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 4a7 7 0 0 0-7 7v2" {...stroke(color, strokeWidth)} />
    <Path d="M12 4a7 7 0 0 1 7 7v3.5" {...stroke(color, strokeWidth)} />
    <Path d="M8.5 20c.8-1.6 1.2-3.4 1.2-5.2V11a2.3 2.3 0 0 1 4.6 0v3.8c0 1.4.3 2.7.9 3.9" {...stroke(color, strokeWidth)} />
    <Path d="M5 16.5c-.2 1-.6 2-1.1 2.9M19 17.5c.2.6.4 1.1.7 1.6M12 11v4.2c0 1.8-.4 3.6-1.2 5.1" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const BackspaceIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7z" {...stroke(color, strokeWidth)} />
    <Path d="M12.5 9.5l5 5m0-5l-5 5" {...stroke(color, strokeWidth)} />
  </Svg>
);

/* ---------------- recovery methods + onboarding art ---------------- */

/** Swift wallet — lightning bolt (not Trust's artwork, our own stroke). */
export const BoltIcon = ({ size = 24, color = '#000', strokeWidth = 1.9 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M13 2.5 5.5 13h5l-1.5 8.5L17 11h-5l1-8.5z" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Private key — classic key outline. */
export const KeyIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx={7.5} cy={15.5} r={4} {...stroke(color, strokeWidth)} />
    <Path d="M10.4 12.6 20 3m-4 1 2.5 2.5M13.5 6.5 16 9" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Keystore — file with folded corner + bracket. */
export const KeystoreFileIcon = ({ size = 24, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6 3h8l4 4v14H6z" {...stroke(color, strokeWidth)} />
    <Path d="M14 3v4h4" {...stroke(color, strokeWidth)} />
    <Path d="M10.5 12v5m-2-2.5h4" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Chevron up (Show less). */
export const ChevronUpIcon = ({ size = 16, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6 15l6-6 6 6" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Chevron down (Show more). */
export const ChevronDownIcon = ({ size = 16, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6 9l6 6 6-6" {...stroke(color, strokeWidth)} />
  </Svg>
);


/** Trash can (delete). */
export const TrashIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0110.7 4h2.6a1.2 1.2 0 011.2 1.2V7" {...stroke(color, strokeWidth)} />
    <Path d="M6.2 7l.8 11.2A2 2 0 009 20h6a2 2 0 002-1.8L17.8 7M10 11v5M14 11v5" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Copy (two overlapping rounded squares). */
export const CopyIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Rect x="8.5" y="8.5" width="11.5" height="11.5" rx="3" {...stroke(color, strokeWidth)} />
    <Path d="M15.5 8.5V7a3 3 0 00-3-3H7a3 3 0 00-3 3v5.5a3 3 0 003 3h1.5" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Share (tray with arrow leaving upward). */
export const ShareIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 15V3.5M7.8 7.6L12 3.4l4.2 4.2" {...stroke(color, strokeWidth)} />
    <Path d="M8 11H7a3 3 0 00-3 3v4a3 3 0 003 3h10a3 3 0 003-3v-4a3 3 0 00-3-3h-1" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Fingerprint illustration art for the Biometric Login popup. */
export const FingerprintArt = ({ size = 108 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <Defs>
      <SvgGradient id="vFp" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#6C63FF" />
        <Stop offset="1" stopColor="#4A90D9" />
      </SvgGradient>
    </Defs>
    <Circle cx={60} cy={60} r={50} fill="url(#vFp)" opacity={0.10} />
    <Path d="M60 32c-15.5 0-28 12.5-28 28v14" stroke="url(#vFp)" strokeWidth={4.5} strokeLinecap="round" />
    <Path d="M60 42c-10 0-18 8-18 18v22" stroke="url(#vFp)" strokeWidth={4.5} strokeLinecap="round" />
    <Path d="M60 52c-4.5 0-8 3.5-8 8v26" stroke="url(#vFp)" strokeWidth={4.5} strokeLinecap="round" />
    <Path d="M78 46c3 4 4.5 8.5 4.5 13.5V88" stroke="url(#vFp)" strokeWidth={4.5} strokeLinecap="round" />
    <Path d="M88 40c4.5 6 7 13 7 20.5V90" stroke="url(#vFp)" strokeWidth={4.5} strokeLinecap="round" opacity={0.55} />
    <Path d="M68 60v28" stroke="url(#vFp)" strokeWidth={4.5} strokeLinecap="round" opacity={0.55} />
  </Svg>
);

/* ---------------- home redesign icons ---------------- */
export const ClockIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="9" {...stroke(color, strokeWidth)} />
    <Path d="M12 7v5l3.2 2" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const BarsIcon = ({ size = 24, color = '#000', strokeWidth = 2.4 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M6 19v-6M12 19V6M18 19v-9" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const ArrowDownTx = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 5v14M6 13l6 6 6-6" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const ArrowUpRightTx = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M7 17L17 7M8 7h9v9" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const SwapArrowsTx = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const ShieldLockIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3z" {...stroke(color, strokeWidth)} />
    <Path d="M9 12l2.2 2.2L15.5 10" {...stroke(color, strokeWidth)} />
  </Svg>
);

export const TrendIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 17l5-5 4 4 7-8" {...stroke(color, strokeWidth)} />
    <Path d="M15 8h5v5" {...stroke(color, strokeWidth)} />
  </Svg>
);


/** Padlock (secure connection in the browser header). */
export const LockSmallIcon = ({ size = 16, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Rect x="5" y="10.5" width="14" height="10" rx="2.6" {...stroke(color, strokeWidth)} />
    <Path d="M8 10.5V8a4 4 0 018 0v2.5" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Heart; `filled` for a favorited page. */
export const HeartIcon = ({ size = 24, color = '#000', strokeWidth = 2, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg {...base(size)}>
    <Path
      d="M12 20.2S4 15.1 4 9.6A4.1 4.1 0 018 5.5c1.6 0 3 .9 4 2.3 1-1.4 2.4-2.3 4-2.3a4.1 4.1 0 014 4.1c0 5.5-8 10.6-8 10.6z"
      {...stroke(color, strokeWidth)}
      fill={filled ? color : 'none'}
    />
  </Svg>
);

/** Reload (circular arrow). */
export const ReloadIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M19.5 12a7.5 7.5 0 11-2.4-5.5" {...stroke(color, strokeWidth)} />
    <Path d="M19.8 4.6v4.2h-4.2" {...stroke(color, strokeWidth)} />
  </Svg>
);

/**
 * Chevrons (Trust style): thin 1.8 stroke, round caps, open iOS proportions.
 * Used for the browser back/forward pill and settings row affordances.
 */
export const ChevronLeftIcon = ({ size = 22, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M14.5 5.5l-6.5 6.5 6.5 6.5" {...stroke(color, strokeWidth)} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const ChevronRightIcon = ({ size = 22, color = '#000', strokeWidth = 1.8 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M9.5 5.5l6.5 6.5-6.5 6.5" {...stroke(color, strokeWidth)} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Photo gallery (scanner header). */
export const GalleryIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Rect x="3.5" y="5.5" width="17" height="13" rx="3" {...stroke(color, strokeWidth)} />
    <Path d="M5.5 15.5l3.6-3.6a1.6 1.6 0 012.3 0l3.8 3.8" {...stroke(color, strokeWidth)} />
    <Path d="M14 11.2l1.6-1.6a1.6 1.6 0 012.3 0l2.1 2.1" {...stroke(color, strokeWidth)} />
    <Circle cx="8.7" cy="9.3" r="1.3" fill={color} />
  </Svg>
);

/** Flashlight (scanner header, torch toggle). */
export const FlashIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M9 3.5h6" {...stroke(color, strokeWidth)} />
    <Path d="M8 3.5h8l-.8 3.2a2.5 2.5 0 00-.2 1v1.6a2.5 2.5 0 00.6 1.6l.9 1.1a2.5 2.5 0 01.6 1.6v5.8a1.5 1.5 0 01-1.5 1.5H9.4a1.5 1.5 0 01-1.5-1.5v-5.8a2.5 2.5 0 01.6-1.6l.9-1.1a2.5 2.5 0 00.6-1.6V7.7a2.5 2.5 0 00-.2-1L8 3.5z" {...stroke(color, strokeWidth)} />
    <Path d="M10.5 13.5h3" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** "Open in browser": box with arrow leaving it (web-mode browser menu). */
export const OpenInBrowserIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M12 3.5v9m0 0l3-3m-3 3l-3-3" {...stroke(color, strokeWidth)} />
    <Path d="M6.5 6.5h-1a2 2 0 00-2 2v9a2 2 0 002 2h13a2 2 0 002-2v-9a2 2 0 00-2-2h-1" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** Arrow pointing down-right (Short button). */
export const ArrowDownRightIcon = ({ size = 24, color = '#000', strokeWidth = 2.2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M7 7l10 10M17 8v9H8" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** History (counter-clockwise clock) for the Perps header. */
export const HistoryIcon = ({ size = 24, color = '#000', strokeWidth = 2 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.6 8.6 0 005.9 6M3.5 4.5V7.5H6.5" {...stroke(color, strokeWidth)} />
    <Path d="M12 7.8V12l3 1.8" {...stroke(color, strokeWidth)} />
  </Svg>
);

/** External link: arrow leaving a box, top right (Contact support row). */
export const ExternalLinkIcon = ({ size = 24, color = '#000', strokeWidth = 1.9 }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M14 4h6v6M20 4l-9 9" {...stroke(color, strokeWidth)} />
    <Path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" {...stroke(color, strokeWidth)} />
  </Svg>
);
