import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, CheckCircle2, X, AlertCircle, User, LogOut } from 'lucide-react';
import { AuthButtons } from './AuthButtons';
import { userManager } from '../modules/user';
import { AppUser } from '../types';
import appLogo from '../assets/images/app_logo_1786022618121.jpg';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuth?: (provider: string, token: string) => void;
  onAuthChange?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuth,
  onAuthChange,
}) => {
  const [user, setUser] = useState<AppUser>(userManager.getUser());

  useEffect(() => {
    if (isOpen) {
      setUser(userManager.getUser());
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = userManager.subscribe((u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-fuchsia-500 p-0.5 shadow-md flex items-center justify-center overflow-hidden shrink-0">
              <img src={appLogo} alt="Sferium Logo" className="w-full h-full object-cover rounded-[14px]" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                Авторизация Sferium
              </h3>
              <p className="text-xs text-white font-bold opacity-90">
                Вход через VK ID, OK.ru и Mail.ru
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Info */}
        <div className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`w-3 h-3 rounded-full ${user.isGuest ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <div>
              <div className="text-xs font-bold text-white">
                {user.isGuest ? 'Вы вошли как гость' : `Авторизован через ${user.authProvider?.toUpperCase()}`}
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                {user.name} ({user.userId.slice(0, 16)}...)
              </div>
            </div>
          </div>

          {!user.isGuest && (
            <button
              type="button"
              onClick={() => {
                userManager.logout();
                if (onAuthChange) onAuthChange();
              }}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Выйти</span>
            </button>
          )}
        </div>

        {/* Info card */}
        <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl flex items-start space-x-3 text-xs text-indigo-200">
          <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <span>
            Регистрация необязательна. Все функции кинозала и голосового чата доступны гостям. Авторизуйтесь, если хотите привязать свой профиль и аватар.
          </span>
        </div>

        {/* VK ID OneTap & Alternative Logins */}
        <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-zinc-200">
                Быстрый вход OneTap
              </span>
            </div>
          </div>

          <AuthButtons
            onSuccess={() => {
              const u = userManager.getUser();
              setUser(u);
              if (onAuth && u.accessToken) {
                onAuth(u.authProvider || 'vk', u.accessToken);
              }
              if (onAuthChange) onAuthChange();
            }}
            onContinueAsGuest={onClose}
            showGuestButton={true}
          />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg cursor-pointer"
        >
          Закрыть
        </button>

      </div>
    </div>
  );
};

export default AuthModal;
