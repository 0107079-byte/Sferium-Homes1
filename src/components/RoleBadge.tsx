import React from 'react';
import { Role } from '../types';
import { Crown, Shield, User as UserIcon, Eye } from 'lucide-react';

interface RoleBadgeProps {
  role: Role;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  switch (role) {
    case 'host':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Crown className="w-3 h-3" />
          <span>Хост</span>
        </span>
      );
    case 'moderator':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Shield className="w-3 h-3" />
          <span>Модератор</span>
        </span>
      );
    case 'member':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <UserIcon className="w-3 h-3" />
          <span>Участник</span>
        </span>
      );
    case 'guest':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Eye className="w-3 h-3" />
          <span>Зритель</span>
        </span>
      );
  }
};
