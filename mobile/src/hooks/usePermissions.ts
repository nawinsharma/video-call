import { useEffect, useState } from 'react';
import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';

interface Permissions {
  camera: boolean;
  microphone: boolean;
  allGranted: boolean;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions>({
    camera: false,
    microphone: false,
    allGranted: false,
  });

  const requestPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        const camera = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';
        const microphone = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
        const allGranted = camera && microphone;

        setPermissions({ camera, microphone, allGranted });

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'Camera and microphone access are needed for video calls.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }

        return allGranted;
      }

      // iOS permissions are requested at time of use via react-native-webrtc
      setPermissions({ camera: true, microphone: true, allGranted: true });
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    requestPermissions();
  }, []);

  return { permissions, requestPermissions };
}
