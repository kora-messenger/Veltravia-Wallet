/**
 * AppModal — drop-in replacement for react-native's <Modal> for every sheet.
 *
 * Identical API, with one guarantee: while the app is locked it renders
 * NOTHING. A native Modal sits above the whole React tree, so without this a
 * bottom sheet (Receive QR, filters, menus...) would stay visible over the
 * passcode / fingerprint screen. When the user unlocks, the sheet's own
 * `visible` state is untouched, so it reappears exactly as they left it.
 */
import React from 'react';
import { Modal, type ModalProps } from 'react-native';
import { useAppLocked } from '../core/security/appLockState';

export default function AppModal(props: ModalProps) {
  const locked = useAppLocked();
  if (locked) return null;
  return <Modal {...props} />;
}
