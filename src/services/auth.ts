import { User } from '../types';

const USER_STORAGE_KEY = 'sferium_user';

export function getStoredUser(): User {
  if (typeof window === 'undefined') {
    return { id: 'guest-1', name: 'Гость', role: 'guest' };
  }
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const newUser: User = {
    id: `user_${Math.random().toString(36).substring(2, 9)}`,
    name: `Участник ${Math.floor(100 + Math.random() * 900)}`,
    color: randomColor,
    role: 'member',
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
}

export function saveStoredUser(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}
