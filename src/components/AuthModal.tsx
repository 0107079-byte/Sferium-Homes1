import React, { useState } from 'react';
import { User } from '../types';
import { saveStoredUser } from '../services/auth';
import { Sparkles, User as UserIcon } from 'lucide-react';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: User = {
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      color: randomColor,
      role: 'member',
    };

    saveStoredUser(newUser);
    onLogin(newUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-4 shadow-lg shadow-purple-600/10">
          <Sparkles className="w-8 h-8 text-purple-400" />
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-2">Добро пожаловать в Homes Sync</h2>
        <p className="text-xs text-slate-400 mb-6 max-w-xs">
          Единый синхронный просмотр видео (YouTube, VK, Rutube), P2P голосовой чат и авто-дрифт коррекция.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative">
            <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите ваше имя или никнейм"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-purple-600/25 mt-1"
          >
            Войти в платформу
          </button>
        </form>
      </div>
    </div>
  );
};
