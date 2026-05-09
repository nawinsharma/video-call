import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

class RingtoneService {
  private sound: Audio.Sound | null = null;

  async play() {
    if (this.sound) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/sounds/ringtone.mp3'),
        {
          isLooping: true,
          shouldPlay: true,
          volume: 1,
        }
      );

      this.sound = sound;
    } catch (error) {
      console.warn('[Ringtone] Failed to play ringtone:', error);
    }
  }

  async stop() {
    if (!this.sound) return;

    try {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
    } catch (error) {
      console.warn('[Ringtone] Failed to stop ringtone:', error);
    } finally {
      this.sound = null;
    }
  }
}

export const ringtoneService = new RingtoneService();
