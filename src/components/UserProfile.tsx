import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  ShieldCheck,
  Mail,
  Copy,
  Check,
  LogOut,
  Trash2,
  ExternalLink,
  Sparkles,
  Radio,
  Edit3,
} from 'lucide-react';
import { AppUser } from '../types';
import UserAvatar from './UserAvatar';

interface UserProfileProps {
  user: AppUser;
  onEditClick?: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  onContinueAsGuest?: () => void;
  showActions?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onEditClick,
  onLogout,
  onDeleteAccount,
  onContinueAsGuest,
  showActions = true,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(user.userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getProviderBadge = () => {
    switch (user.authProvider) {
      case 'vk':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            VK ID
          </span>
        );
      case 'ok':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            OK.ru
          </span>
        );
      case 'mail':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <ShieldCheck className="w-3 h-3 text-cyan-400" />
            Mail.ru
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-700/40 text-amber-300 border border-amber-500/30">
            <User className="w-3 h-3 text-amber-400" />
            Гостевой аккаунт
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col space-y-4">
      {/* Profile Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <UserAvatar
              avatar={user.avatar}
              name={user.name}
              color={user.color}
              size="lg"
              status={user.status}
              showStatus
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">{user.name}</h2>
              {getProviderBadge()}
            </div>

            {user.customStatus ? (
              <p className="text-xs text-zinc-300 italic mt-0.5 font-medium">
                "{user.customStatus}"
              </p>
            ) : (
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {user.isGuest ? 'Пользуется приложением без регистрации' : 'Авторизованный пользователь'}
              </p>
            )}

            {user.email && (
              <div className="flex items-center space-x-1.5 text-xs text-zinc-400 mt-1">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>{user.email}</span>
              </div>
            )}
          </div>
        </div>

        {onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-xl border border-zinc-700/60 transition-colors cursor-pointer"
            title="Редактировать профиль"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* User ID Pill */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-950/70 border border-zinc-800 rounded-2xl text-xs">
        <div className="flex items-center space-x-2 text-zinc-400 font-mono">
          <span className="text-[11px] text-zinc-500 font-sans">ID:</span>
          <span className="truncate max-w-[200px] text-zinc-300">{user.userId}</span>
        </div>
        <button
          type="button"
          onClick={handleCopyUserId}
          className="text-zinc-400 hover:text-indigo-300 flex items-center space-x-1 transition-colors cursor-pointer text-[11px]"
        >
          {copiedId ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>

      {/* Bio section if present */}
      {user.bio && (
        <div className="p-3 bg-zinc-950/40 border border-zinc-800/60 rounded-2xl text-xs text-zinc-300 leading-relaxed">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">О себе</span>
          {user.bio}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col space-y-2">
          {!user.isGuest ? (
            <div className="grid grid-cols-2 gap-2">
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="py-2.5 px-3 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Выйти из аккаунта</span>
                </button>
              )}

              {onDeleteAccount && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Вы уверены, что хотите удалить аккаунт и сбросить профиль?')) {
                      onDeleteAccount();
                    }
                  }}
                  className="py-2.5 px-3 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Удалить профиль</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-2xl text-xs text-amber-200 flex items-start space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Вы пользуетесь гостевым аккаунтом. При желании вы можете привязать VK ID, OK.ru или Mail.ru, чтобы сохранить настройки и аватар.
                </span>
              </div>

              {onDeleteAccount && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Сбросить гостевой профиль и создать новый случайный ID?')) {
                      onDeleteAccount();
                    }
                  }}
                  className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-rose-300 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-zinc-500" />
                  <span>Сбросить гостевой профиль</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
