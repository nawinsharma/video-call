import { apiClient } from '../http/apiClient';
import type { User } from '../../types';

class UserService {
  async listUsers(): Promise<User[]> {
    const { data } = await apiClient.get<User[]>('/users');
    return data;
  }

  async searchUsers(query: string): Promise<User[]> {
    const { data } = await apiClient.get<User[]>('/users/search', {
      params: { q: query },
    });
    return data;
  }

  async addContact(userId: string): Promise<User> {
    const { data } = await apiClient.post<User>('/users/contacts', { userId });
    return data;
  }
}

export const userService = new UserService();
