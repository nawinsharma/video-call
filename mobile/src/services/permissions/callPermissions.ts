import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export async function ensureCallPermissions(isVideoCall: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const requestedPermissions = [
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ...(isVideoCall ? [PermissionsAndroid.PERMISSIONS.CAMERA] : []),
  ];

  const grants = await PermissionsAndroid.requestMultiple(requestedPermissions);
  const microphoneGranted = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
  const cameraGranted =
    !isVideoCall || grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;

  if (microphoneGranted && cameraGranted) {
    return true;
  }

  Alert.alert(
    'Permissions Required',
    isVideoCall
      ? 'Camera and microphone access are needed for video calls.'
      : 'Microphone access is needed for audio calls.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settings', onPress: () => Linking.openSettings() },
    ]
  );

  return false;
}
