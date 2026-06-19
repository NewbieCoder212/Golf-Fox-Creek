import { Alert, Platform } from 'react-native';

/** Cross-platform confirm — Alert buttons are unreliable on web. */
export function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirm', onPress: () => resolve(true) },
    ]);
  });
}
