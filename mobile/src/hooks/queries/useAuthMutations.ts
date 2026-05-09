import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/auth/authService';
import type { AuthResponse } from '../../types';

interface LoginVariables {
  identifier: string;
  password: string;
}

interface SendRegistrationOtpVariables {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

interface RegisterVariables {
  username: string;
  email: string;
  password: string;
  displayName: string;
  otp: string;
}

export function useLoginMutation() {
  return useMutation<AuthResponse, Error, LoginVariables>({
    mutationFn: ({ identifier, password }) => authService.login(identifier, password),
  });
}

export function useSendRegistrationOtpMutation() {
  return useMutation<void, Error, SendRegistrationOtpVariables>({
    mutationFn: (params) => authService.sendRegistrationOtp(params),
  });
}

export function useRegisterMutation() {
  return useMutation<AuthResponse, Error, RegisterVariables>({
    mutationFn: (params) => authService.register(params),
  });
}
