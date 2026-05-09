import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '../../services/users/userService';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

export function useUsersQuery() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery<User[]>({
    queryKey: ['contacts'],
    queryFn: () => userService.listUsers(),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useUserSearchQuery(query: string) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const normalizedQuery = query.trim();

  return useQuery<User[]>({
    queryKey: ['users', 'search', normalizedQuery],
    queryFn: () => userService.searchUsers(normalizedQuery),
    enabled: isAuthenticated && normalizedQuery.length >= 2,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useAddContactMutation() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, string>({
    mutationFn: (userId) => userService.addContact(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['users', 'search'] });
    },
  });
}
