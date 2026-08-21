import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserStatus } from '../types';

export interface UserAvatarProps {
  avatar?: string;
  name?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  status?: UserStatus;
  isSpeaking?: boolean;
  volume?: number;
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
  withGlow?: boolean;
}

const SIZE_MAP: Record<string, { container: string; text: string; statusSize: string; statusOffset: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-xs', statusSize: 'w-2 h-2', statusOffset: '-bottom-0.5 -right-0.5' },
  sm: { container: 'w-8 h-8', text: 'text-sm', statusSize: 'w-2.5 h-2.5', statusOffset: '-bottom-0.5 -right-0.5' },
  md: { container: 'w-10 h-10', text: 'text-base', statusSize: 'w-3 h-3', statusOffset: 'bottom-0 right-0' },
  lg: { container: 'w-14 h-14', text: 'text-2xl', statusSize: 'w-3.5 h-3.5', statusOffset: 'bottom-0.5 right-0.5' },
  xl: { container: 'w-20 h-20', text: 'text-4xl', statusSize: 'w-4.5 h-4.5', statusOffset: 'bottom-1 right-1' },
  '2xl': { container: 'w-28 h-28', text: 'text-5xl', statusSize: 'w-6 h-6', statusOffset: 'bottom-1.5 right-1.5' },
};

const STATUS_COLORS: Record<UserStatus, { bg: string; ring: string; label: string }> = {
  online: { bg: 'bg-emerald-500', ring: 'ring-emerald-400', label: 'В сети' },
  idle: { bg: 'bg-amber-500', ring: 'ring-amber-400', label: 'Не активен' },
  dnd: { bg: 'bg-rose-500', ring: 'ring-rose-400', label: 'Не беспокоить' },
  offline: { bg: 'bg-zinc-500', ring: 'ring-zinc-400', label: 'Не в сети' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar = '🍿',
  name = 'Пользователь',
  color = '#6366f1',
  size = 'md',
  status,
  isSpeaking = false,
  volume = 0,
  showStatus = false,
  className = '',
  onClick,
  withGlow = false,
}) => {
  const [imageError, setImageError] = useState(false);

  // Check if avatar is image URL or base64
  const isImageUrl = (
    avatar.startsWith('http://') ||
    avatar.startsWith('https://') ||
    avatar.startsWith('data:image') ||
    avatar.startsWith('/') ||
    avatar.startsWith('blob:')
  ) && !imageError;

  const sizeConfig = typeof size === 'string' ? (SIZE_MAP[size] || SIZE_MAP.md) : {
    container: `w-[${size}px] h-[${size}px]`,
    text: `text-[${Math.round(size * 0.45)}px]`,
    statusSize: `w-[${Math.max(8, Math.round(size * 0.25))}px] h-[${Math.max(8, Math.round(size * 0.25))}px]`,
    statusOffset: 'bottom-0 right-0',
  };

  const statusConfig = status ? STATUS_COLORS[status] : STATUS_COLORS.online;

  // Extract initials if neither image nor emoji renders cleanly
  const initials = name
    ? name.trim().split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const isCustomHex = color && color.startsWith('#');
  const volScale = Math.max(1.12, Math.min(1.35, 1.12 + (volume / 100) * 0.25));

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Speaking Pulse Outer Ring */}
      {isSpeaking && (
        <>
          <motion.div
            animate={{ scale: [1, volScale, 1], opacity: [0.85, 0.3, 0.85] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-[-5px] rounded-full border-2 border-emerald-400/80 pointer-events-none z-0"
          />
          <motion.div
            animate={{ scale: [1, volScale * 1.15, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-[-8px] rounded-full bg-emerald-500/20 pointer-events-none z-0"
          />
        </>
      )}

      {/* Avatar Container */}
      <div
        className={`relative overflow-hidden rounded-full flex items-center justify-center transition-transform ${
          sizeConfig.container
        } ${
          isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950' : ''
        } ${
          withGlow ? 'shadow-lg' : ''
        } bg-zinc-900 border border-zinc-800/80`}
        style={{
          boxShadow: withGlow && isCustomHex ? `0 0 16px ${color}55` : undefined,
          borderColor: isCustomHex ? `${color}66` : undefined,
        }}
      >
        {isImageUrl ? (
          <img
            src={avatar}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center font-bold ${sizeConfig.text}`}
            style={{
              backgroundColor: isCustomHex ? `${color}18` : undefined,
              color: isCustomHex ? color : '#ffffff',
            }}
          >
            {avatar && avatar.length <= 4 ? (
              <span className="leading-none drop-shadow-sm">{avatar}</span>
            ) : (
              <span className="font-mono tracking-tight font-black">{initials}</span>
            )}
          </div>
        )}
      </div>

      {/* Status Badge */}
      {(showStatus || status) && status && (
        <span
          title={statusConfig.label}
          className={`absolute ${sizeConfig.statusOffset} ${sizeConfig.statusSize} rounded-full ring-2 ring-zinc-950 z-10 ${statusConfig.bg}`}
        >
          {status === 'dnd' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-1.5 h-0.5 bg-white rounded-full" />
            </span>
          )}
          {status === 'idle' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-1 h-1 bg-zinc-950 rounded-full" />
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
