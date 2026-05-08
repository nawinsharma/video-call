import { apiClient, toErrorMessage } from '../http/apiClient';
import type { AuthResponse } from '../../types';

class AuthService {
  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', { username, password });
      return data;
    } catch (error: unknown) {
      throw new Error(toErrorMessage(error, 'Login failed'));
    }
  }

  async register(username: string, password: string, displayName: string): Promise<AuthResponse> {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', {
        username,
        password,
        displayName,
      });
      return data;
    } catch (error: unknown) {
      throw new Error(toErrorMessage(error, 'Registration failed'));
    }
  }

  async updatePushToken(token: string): Promise<void> {
    await apiClient.put('/users/push-token', { token });
  }
}

export const authService = new AuthService();
