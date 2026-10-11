/**
 * Veltravia Wallet — animated 3D primary button.
 *
 * Built from the reference video Ijezie's client loves ("Join Now" slab):
 *   - glossy gradient face with a soft top highlight line
 *   - a thick, darker slab underneath that reads as the button's side edge
 *   - a soft drop shadow beneath the slab
 *   - PRESS: the face sinks down into the slab, the shadow tightens, and a
 *     slim arrow glides in from the left while the label shifts right
 *   - RELEASE: the face springs back up (small overshoot), arrow settles
 *   - LOADING: label swaps for a spinner, face stays pressed-in
 *
 * Pure `Animated` (native driver) — no extra native dependency.
 * Every primary CTA in the app renders through this component.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Vibration,
  StyleProp,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

const DEPTH_FULL = 6; // slab thickness for full-size buttons (dp)

/** Darken a #RRGGBB color for the slab edge. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const Arrow = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  height = 52,
  arrow = true,
  fontSize = 16,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Face height in dp (slab adds DEPTH below). */
  height?: number;
  /** Slide the arrow in on press (the reference effect). */
  arrow?: boolean;
  /** Label size; use ~13 for compact inline buttons. */
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const DEPTH = height < 40 ? 4 : DEPTH_FULL;
  const [from, to] = theme.buttonGradient as unknown as [string, string];

  // 0 = resting, 1 = fully pressed
  const press = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (v: number) => {
      Animated.spring(press, {
        toValue: v,
        speed: v === 1 ? 40 : 18,
        bounciness: v === 1 ? 0 : 9,
        useNativeDriver: true,
      }).start();
    },
    [press],
  );

  // While loading the face stays sunk in.
  useEffect(() => {
    animateTo(loading ? 1 : 0);
  }, [loading, animateTo]);

  const faceY = press.interpolate({ inputRange: [0, 1], outputRange: [0, DEPTH - 1] });
  const shadowScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });
  const shadowOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.16] });
  const arrowX = press.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] });
  const arrowOpacity = press.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const labelX = press.interpolate({ inputRange: [0, 1], outputRange: [0, arrow ? 14 : 0] });

  const total = height + DEPTH;

  return (
    <Pressable
      onPressIn={() => {
        if (disabled || loading) return;
        Vibration.vibrate(8);
        animateTo(1);
      }}
      onPressOut={() => {
        if (loading) return;
        animateTo(0);
      }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ height: total, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {/* drop shadow under the slab */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadow,
          { bottom: -2, backgroundColor: shade(from, 0.55), opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] },
        ]}
      />

      {/* slab = the visible side edge */}
      <View
        pointerEvents="none"
        style={[styles.slab, { top: DEPTH, height, borderRadius: height / 2.6, backgroundColor: shade(to, 0.42) }]}
      />

      {/* sliding face */}
      <Animated.View
        style={[styles.face, { height, borderRadius: height / 2.6, transform: [{ translateY: faceY }] }]}
      >
        <LinearGradient
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          colors={[from, to]}
          style={StyleSheet.absoluteFill}
        />
        {/* glossy top highlight */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.0)']}
          style={[styles.gloss, { height: height * 0.52, borderTopLeftRadius: height / 2.6, borderTopRightRadius: height / 2.6 }]}
        />
        {/* crisp inner top edge line */}
        <View pointerEvents="none" style={[styles.edgeLine, { borderTopLeftRadius: height / 2.6, borderTopRightRadius: height / 2.6 }]} />

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {arrow && (
                <Animated.View style={{ opacity: arrowOpacity, transform: [{ translateX: arrowX }], marginRight: 8 }}>
                  <Arrow color="#FFFFFF" />
                </Animated.View>
              )}
              <Animated.Text style={[styles.label, { fontSize, lineHeight: fontSize + 6, transform: [{ translateX: labelX }] }]} numberOfLines={1}>
                {label}
              </Animated.Text>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', left: 14, right: 14, height: 10, borderRadius: 10 },
  slab: { position: 'absolute', left: 0, right: 0 },
  face: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0 },
  edgeLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontFamily: 'Inter-600', fontWeight: '600' },
});
