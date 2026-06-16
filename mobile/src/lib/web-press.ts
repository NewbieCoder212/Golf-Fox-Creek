import { Alert, Platform } from 'react-native';

/** Stop web from treating button presses as form submits / navigation. */
export function preventWebPressDefault(event: unknown) {
  if (Platform.OS !== 'web' || !event || typeof event !== 'object') return;
  const e = event as { preventDefault?: () => void; stopPropagation?: () => void };
  e.preventDefault?.();
  e.stopPropagation?.();
}

export function webPressHandler(handler: () => void) {
  return (event?: unknown) => {
    preventWebPressDefault(event);
    handler();
  };
}

/** Works on web where Alert.alert with buttons is unreliable. */
export function confirmDestructiveAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined' && 'confirm' in globalThis) {
    if (globalThis.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
