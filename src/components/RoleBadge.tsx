import React from 'react';
import { Crown, Shield, User, Eye } from 'lucide-react';
import { UserRole } from '../types';

interface RoleBadgeProps {
  role?: UserRole;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  id?: string;
}

export const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    description: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    glowColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  host: {
    label: 'Хост',
    description: 'Полный доступ и управление залом',
    bgColor: 'bg-amber-500/15',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-amber-500/20',
    icon: Crown,
  },
  moderator: {
    label: 'Модератор',
    description: 'Управление видео, участниками и голосом',
    bgColor: 'bg-indigo-500/15',
    textColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    glowColor: 'shadow-indigo-500/20',
    icon: Shield,
  },
  member: {
    label: 'Участник',
    description: 'Стандартный просмотр, чат и медиа',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    glowColor: 'shadow-emerald-500/20',
    icon: User,
  },
  viewer: {
    label: 'Зритель',
    description: 'Только просмотр и чат (без управления)',
    bgColor: 'bg-slate-500/15',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-500/30',
    glowColor: 'shadow-slate-500/20',
    icon: Eye,
  },
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role = 'member',
  size = 'sm',
  showLabel = true,
  className = '',
  id,
}) => {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.member;
  const Icon = config.icon;

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
    lg: 'px-3 py-1.5 text-sm gap-2 font-medium',
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      id={id || `role-badge-${role}`}
      title={config.description}
      className={`inline-flex items-center rounded-md border backdrop-blur-sm transition-all select-none ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeStyles[size]} ${className}`}
    >
      <Icon className={`${iconSizes[size]} shrink-0`} />
      {showLabel && <span className="font-semibold tracking-wide">{config.label}</span>}
    </span>
  );
};
