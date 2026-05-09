import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

type CallSoundType = 'incoming' | 'outgoing';

const CALL_SOUNDS = {
  incoming: require('../../../assets/sounds/incoming.mp3'),
  outgoing: require('../../../assets/sounds/outgoing.mp3'),
} as const;

class RingtoneService {
  private sound: Audio.Sound | null = null;
  private currentType: CallSoundType | null = null;
  private operationId = 0;

  async play(type: CallSoundType) {
    if (this.sound && this.currentType === type) return;

    const operationId = ++this.operationId;
    const previousSound = this.sound;
    this.sound = null;
    this.currentType = null;

    if (previousSound) {
      await this.unload(previousSound);
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: type === 'outgoing',
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        CALL_SOUNDS[type],
        {
          isLooping: true,
          shouldPlay: true,
          volume: 1,
        }
      );

      if (operationId !== this.operationId) {
        await this.unload(sound);
        return;
      }

      this.sound = sound;
      this.currentType = type;
    } catch (error) {
      console.warn('[Ringtone] Failed to play ringtone:', error);
      this.currentType = null;
    }
  }

  playIncoming() {
    return this.play('incoming');
  }

  playOutgoing() {
    return this.play('outgoing');
  }

  async stop() {
    this.operationId++;

    const sound = this.sound;
    this.sound = null;
    this.currentType = null;

    if (!sound) return;
    await this.unload(sound);
  }

  private async unload(sound: Audio.Sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (error) {
      console.warn('[Ringtone] Failed to stop ringtone:', error);
    }
  }
}

export const ringtoneService = new RingtoneService();
