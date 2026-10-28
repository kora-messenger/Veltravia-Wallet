/**
 * Veltravia Wallet — swipe-left-to-delete row (Trust parity).
 *
 * Dragging the row left reveals a pale-red "Delete" action (red X + label) on
 * the right; tapping it fires onDelete. Dragging back (or tapping the row)
 * closes it. Pure PanResponder + Animated, so there is no extra native
 * dependency. A mostly-vertical drag is left to the parent ScrollView.
 */
import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, Animated, PanResponder, StyleSheet } from 'react-native';
import { CloseIcon } from './icons';

const ACTION_W = 76;
const RED = '#D63232';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  /** Pale red action background (theme aware). */
  actionBg?: string;
  accessibilityLabel?: string;
}

export default function SwipeDeleteRow({ children, onDelete, actionBg = '#FADADA', accessibilityLabel = 'Delete' }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const settle = (to: number) => {
    open.current = to !== 0;
    Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0 }).start();
  };

  const pan = useMemo(
    () => PanResponder.create({
      // only claim clearly horizontal drags
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        const base = open.current ? -ACTION_W : 0;
        x.setValue(Math.max(-ACTION_W, Math.min(0, base + g.dx)));
      },
      onPanResponderRelease: (_e, g) => {
        const base = open.current ? -ACTION_W : 0;
        const end = base + g.dx;
        settle(end < -ACTION_W / 2 ? -ACTION_W : 0);
      },
      onPanResponderTerminate: () => settle(open.current ? -ACTION_W : 0),
    }),
    [x],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.actionSlot} pointerEvents="box-none">
        <Pressable
          accessibilityLabel={accessibilityLabel}
          onPress={() => { settle(0); onDelete(); }}
          style={[styles.action, { backgroundColor: actionBg }]}
        >
          <CloseIcon size={20} color={RED} strokeWidth={2.4} />
          <Text style={styles.actionText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  actionSlot: { position: 'absolute', right: 12, top: 0, bottom: 0, width: ACTION_W, justifyContent: 'center' },
  action: { height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { color: RED, fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
});
