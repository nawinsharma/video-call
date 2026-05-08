import { apiClient, toErrorMessage } from '../http/apiClient';
import type { ICEServer } from '../../types';

interface IceServersResponse {
  iceServers: ICEServer[];
}

class CallsService {
  async getIceServers(): Promise<ICEServer[]> {
    try {
      const { data } = await apiClient.get<IceServersResponse>('/calls/ice-servers');
      return data.iceServers;
    } catch (error: unknown) {
      throw new Error(toErrorMessage(error, 'Failed to fetch ICE servers'));
    }
  }
}

export const callsService = new CallsService();
