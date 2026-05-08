import { apiClient } from '../http/apiClient';
import type { User } from '../../types';

class UserService {
  async listUsers(): Promise<User[]> {
    const { data } = await apiClient.get<User[]>('/users');
    return data;
  }
}

export const userService = new UserService();
