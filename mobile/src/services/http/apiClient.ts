import axios, { AxiosError } from 'axios';
import { API_URL } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import type { ApiErrorResponse } from '../../types';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function toErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
}
