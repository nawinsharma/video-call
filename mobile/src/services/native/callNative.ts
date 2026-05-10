import { NativeModules, Platform } from 'react-native';
import type { AudioOutput } from '../../stores/callStore';

type VideoCallNativeModule = {
  getAvailableAudioOutputs?: () => Promise<AudioOutput[]>;
};

const nativeCall = NativeModules.VideoCallPip as VideoCallNativeModule | undefined;

export async function getAvailableAudioOutputs(): Promise<AudioOutput[]> {
  if (Platform.OS !== 'android') return ['earpiece', 'speaker'];

  try {
    const outputs = await nativeCall?.getAvailableAudioOutputs?.();
    if (!outputs?.length) return ['earpiece', 'speaker'];

    const supported = new Set<AudioOutput>(['earpiece', 'speaker', 'bluetooth']);
    const unique = outputs.filter((output): output is AudioOutput => supported.has(output));
    return unique.length > 0 ? [...new Set(unique)] : ['earpiece', 'speaker'];
  } catch (error) {
    console.warn('[Native] Failed to read audio outputs:', error);
    return ['earpiece', 'speaker'];
  }
}
