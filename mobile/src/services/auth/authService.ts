import { apiClient, toErrorMessage } from '../http/apiClient';
import type { AuthResponse } from '../../types';

class AuthService {
  async login(identifier: string, password: string): Promise<AuthResponse> {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', { identifier, password });
      return data;
    } catch (error: unknown) {
      throw new Error(toErrorMessage(error, 'Login failed'));
    }
  }

  async sendRegistrationOtp(params: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<void> {
    try {
      await apiClient.post('/auth/register/send-otp', params);
    } catch (error: unknown) {
      throw new Error(toErrorMessage(error, 'Could not send verification code'));
    }
  }

  async register(params: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    otp: string;
  }): Promise<AuthResponse> {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', {
        username: params.username,
        email: params.email,
        otp: params.otp,
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
