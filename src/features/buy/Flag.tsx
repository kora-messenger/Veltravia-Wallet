/**
 * Round country flag (circle-flags, MIT). Renders from the bundled
 * FLAG_SVG table: no network, no emoji.
 *
 * Loading behaviour (Trust): the flag column starts as a pulsing grey disc
 * (skeleton) and the artwork fades in. `ready` lets lists release flags in
 * waves so the user sees them "load" country by country.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SkeletonBlock } from '../../components/Skeleton';
import { FLAG_SVG } from './flagData';

export function Flag({ code, size = 44, ready = true }: { code: string | null; size?: number; ready?: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const show = ready && !!code && !!FLAG_SVG[code];

  useEffect(() => {
    if (show) {
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [show, fade]);

  if (!code) return <View style={{ width: size, height: size }} />;

  return (
    <View style={{ width: size, height: size }}>
      {!show && <SkeletonBlock style={{ width: size, height: size, borderRadius: size / 2 }} />}
      {show && (
        <Animated.View style={{ opacity: fade }}>
          <SvgXml
            width={size}
            height={size}
            xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${FLAG_SVG[code]}</svg>`}
          />
        </Animated.View>
      )}
    </View>
  );
}
