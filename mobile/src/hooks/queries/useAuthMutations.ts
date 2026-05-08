import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/auth/authService';
import type { AuthResponse } from '../../types';

interface LoginVariables {
  username: string;
  password: string;
}

interface RegisterVariables extends LoginVariables {
  displayName: string;
}

export function useLoginMutation() {
  return useMutation<AuthResponse, Error, LoginVariables>({
    mutationFn: ({ username, password }) => authService.login(username, password),
  });
}

export function useRegisterMutation() {
  return useMutation<AuthResponse, Error, RegisterVariables>({
    mutationFn: ({ username, password, displayName }) =>
      authService.register(username, password, displayName),
  });
}
