import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/users/userService';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

export function useUsersQuery() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => userService.listUsers(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
