import { NativeModules, Platform } from 'react-native';

type VideoCallPipModule = {
  setCallActive: (active: boolean) => void;
  enterPictureInPicture: () => Promise<boolean>;
};

const nativePip = NativeModules.VideoCallPip as VideoCallPipModule | undefined;

export const pictureInPicture = {
  setCallActive(active: boolean) {
    if (Platform.OS !== 'android') return;
    nativePip?.setCallActive(active);
  },

  async enterPictureInPicture() {
    if (Platform.OS !== 'android') return false;
    return nativePip?.enterPictureInPicture() ?? false;
  },
};
