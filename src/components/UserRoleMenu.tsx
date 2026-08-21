import React, { useState } from 'react';
import {
  Crown,
  Shield,
  User as UserIcon,
  Eye,
  Mic,
  MicOff,
  Video,
  Monitor,
  UserX,
  Ban,
  X,
  Check,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { Member, RoomState, UserRole, RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { RoleBadge, ROLE_CONFIG } from './RoleBadge';

interface UserRoleMenuProps {
  targetMember: Member;
  currentUserId: string;
  room: RoomState;
  onClose: () => void;
  onUpdateRole: (targetUserId: string, role: UserRole, customPermissions?: Partial<RolePermissions>) => void;
  onKickMember: (targetUserId: string, reason?: string) => void;
  onBanMember: (targetUserId: string, reason?: string) => void;
  onTransferHost: (targetUserId: string) => void;
  onToggleModMute: (targetUserId: string, isMuted: boolean) => void;
  id?: string;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  host: 4,
  moderator: 3,
  member: 2,
  viewer: 1,
};

export const UserRoleMenu: React.FC<UserRoleMenuProps> = ({
  targetMember,
  currentUserId,
  room,
  onClose,
  onUpdateRole,
  onKickMember,
  onBanMember,
  onTransferHost,
  onToggleModMute,
  id,
}) => {
  const [kickReason, setKickReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles');

  const currentMember = room.members[currentUserId];
  const isMe = currentUserId === targetMember.userId;
  const isCurrentHost = room.hostId === currentUserId;

  const currentRole: UserRole = currentMember?.role || (isCurrentHost ? 'host' : 'member');
  const targetRole: UserRole = targetMember.role || (room.hostId === targetMember.userId ? 'host' : 'member');

  // Hierarchy check: can current user manage this target?
  const canManageTarget =
    !isMe &&
    (isCurrentHost ||
      (currentRole === 'moderator' && ROLE_HIERARCHY[currentRole] > ROLE_HIERARCHY[targetRole]));

  const canManageRoles = isCurrentHost || (currentRole === 'moderator' && targetRole !== 'host');
  const canTransferHost = isCurrentHost && !isMe;

  const availableRoles: { role: UserRole; title: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { role: 'moderator', title: 'Модератор', desc: 'Управление видео, участниками и голосом', icon: Shield },
    { role: 'member', title: 'Участник', desc: 'Стандартный просмотр, чат и камера', icon: UserIcon },
    { role: 'viewer', title: 'Зритель', desc: 'Только пассивный просмотр и чат', icon: Eye },
  ];

  const handleRoleSelect = (newRole: UserRole) => {
    if (newRole === targetRole) return;
    onUpdateRole(targetMember.userId, newRole);
    onClose();
  };

  const handleCustomPermissionToggle = (permKey: keyof RolePermissions) => {
    const currentCustom = targetMember.customPermissions || {};
    const defaultVal = DEFAULT_ROLE_PERMISSIONS[targetRole][permKey];
    const currentVal = currentCustom[permKey] !== undefined ? currentCustom[permKey] : defaultVal;
    const updatedCustom = {
      ...currentCustom,
      [permKey]: !currentVal,
    };
    onUpdateRole(targetMember.userId, targetRole, updatedCustom);
  };

  const isPermEnabled = (permKey: keyof RolePermissions) => {
    if (targetMember.customPermissions?.[permKey] !== undefined) {
      return targetMember.customPermissions[permKey];
    }
    return DEFAULT_ROLE_PERMISSIONS[targetRole][permKey];
  };

  return (
    <div
      id={id || 'user-role-menu-modal'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-neutral-200 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with user profile info */}
        <div className="relative p-5 bg-gradient-to-b from-neutral-800/80 to-neutral-900 border-b border-neutral-800">
          <button
            id="close-user-menu-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold bg-neutral-800 border border-neutral-700 shadow-inner"
                style={{ color: targetMember.color || '#a855f7' }}
              >
                {targetMember.avatar || '👤'}
              </div>
              {targetRole === 'host' && (
                <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-neutral-950 p-1 rounded-full shadow-lg">
                  <Crown className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white truncate">{targetMember.name}</h3>
                {isMe && (
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700">
                    Это вы
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">ID: {targetMember.userId}</p>
              <div className="mt-2">
                <RoleBadge role={targetRole} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        {canManageTarget && (
          <div className="flex border-b border-neutral-800 bg-neutral-950/40 p-1">
            <button
              id="tab-roles-btn"
              onClick={() => setActiveTab('roles')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'roles'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Назначение роли
            </button>
            <button
              id="tab-permissions-btn"
              onClick={() => setActiveTab('permissions')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'permissions'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Права и доступ
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* If target cannot be managed */}
          {!canManageTarget && !isMe && (
            <div className="p-3 bg-neutral-800/40 rounded-xl border border-neutral-800 text-xs text-neutral-400 text-center">
              У вас недостаточно прав для управления этим участником.
            </div>
          )}

          {/* Quick Voice moderation */}
          {canManageTarget && (
            <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
              <div className="flex items-center gap-2.5">
                {targetMember.isMutedByMod ? (
                  <MicOff className="w-4 h-4 text-rose-400" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
                <div>
                  <div className="text-xs font-medium text-white">Модерация микрофона</div>
                  <div className="text-[11px] text-neutral-400">
                    {targetMember.isMutedByMod ? 'Микрофон заглушен модератором' : 'Голос активен'}
                  </div>
                </div>
              </div>
              <button
                id="toggle-mod-mute-btn"
                onClick={() => onToggleModMute(targetMember.userId, !targetMember.isMutedByMod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  targetMember.isMutedByMod
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                }`}
              >
                {targetMember.isMutedByMod ? 'Разглушить' : 'Заглушить в комнате'}
              </button>
            </div>
          )}

          {/* Roles Tab */}
          {canManageTarget && activeTab === 'roles' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">
                Выберите роль для участника
              </div>
              <div className="space-y-1.5">
                {availableRoles.map((r) => {
                  const isSelected = targetRole === r.role;
                  const Icon = r.icon;
                  const cfg = ROLE_CONFIG[r.role];
                  return (
                    <button
                      key={r.role}
                      id={`select-role-${r.role}-btn`}
                      disabled={!canManageRoles}
                      onClick={() => handleRoleSelect(r.role)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? `${cfg.bgColor} ${cfg.borderColor} ring-1 ring-neutral-600`
                          : 'bg-neutral-800/30 border-neutral-800/80 hover:bg-neutral-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cfg.bgColor} ${cfg.textColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{r.title}</span>
                            {isSelected && (
                              <span className="text-[10px] bg-neutral-700 text-neutral-300 px-1.5 py-0.2 rounded font-medium">
                                Текущая
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">{r.desc}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {canManageTarget && activeTab === 'permissions' && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">
                Индивидуальные ограничения
              </div>
              <div className="space-y-1.5">
                {/* Video control */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-medium text-white">Управление плеером</div>
                      <div className="text-[11px] text-neutral-400">Пауза, перемотка и смена ссылок</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="perm-toggle-video"
                    checked={isPermEnabled('manageVideo')}
                    onChange={() => handleCustomPermissionToggle('manageVideo')}
                    className="w-4 h-4 rounded text-indigo-500 bg-neutral-700 border-neutral-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Camera access */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <Video className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-medium text-white">Доступ к веб-камере</div>
                      <div className="text-[11px] text-neutral-400">Трансляция видео в голосовой сетке</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="perm-toggle-camera"
                    checked={isPermEnabled('canShareCamera')}
                    onChange={() => handleCustomPermissionToggle('canShareCamera')}
                    className="w-4 h-4 rounded text-emerald-500 bg-neutral-700 border-neutral-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Screen Share */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-xs font-medium text-white">Демонстрация экрана</div>
                      <div className="text-[11px] text-neutral-400">Шеринг рабочего стола через WebRTC</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="perm-toggle-screen"
                    checked={isPermEnabled('canShareScreen')}
                    onChange={() => handleCustomPermissionToggle('canShareScreen')}
                    className="w-4 h-4 rounded text-purple-500 bg-neutral-700 border-neutral-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Chat permission */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-medium text-white">Сообщения в чате</div>
                      <div className="text-[11px] text-neutral-400">Отправка текста и эмодзи-реакций</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="perm-toggle-chat"
                    checked={isPermEnabled('canChat')}
                    onChange={() => handleCustomPermissionToggle('canChat')}
                    className="w-4 h-4 rounded text-amber-500 bg-neutral-700 border-neutral-600 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Host Ownership Transfer */}
          {canTransferHost && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              {!showTransferConfirm ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-300">Передать права Хоста</span>
                  </div>
                  <button
                    id="start-transfer-host-btn"
                    onClick={() => setShowTransferConfirm(true)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-medium border border-amber-500/30 transition-colors"
                  >
                    Передать
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-amber-200">
                    Вы уверены? Вы отдадите полный контроль над залом #{room.roomId} пользователю {targetMember.name} и станете Модератором.
                  </p>
                  <div className="flex gap-2">
                    <button
                      id="confirm-transfer-host-btn"
                      onClick={() => {
                        onTransferHost(targetMember.userId);
                        onClose();
                      }}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold rounded-lg text-xs transition-colors"
                    >
                      Да, передать права
                    </button>
                    <button
                      onClick={() => setShowTransferConfirm(false)}
                      className="px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-lg text-xs"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Danger Zone: Kick & Ban */}
          {canManageTarget && (
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider px-1">
                Модерация и санкции
              </div>

              {/* Kick */}
              {!showKickConfirm ? (
                <button
                  id="start-kick-btn"
                  onClick={() => setShowKickConfirm(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/40 hover:bg-rose-500/10 border border-neutral-800 hover:border-rose-500/30 text-rose-400 text-xs font-semibold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <UserX className="w-4 h-4" />
                    Исключить (Kick)
                  </span>
                  <span className="text-neutral-500 font-normal">Отключить от сессии</span>
                </button>
              ) : (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                  <div className="text-xs text-rose-300 font-medium">
                    Исключить {targetMember.name} из зала?
                  </div>
                  <input
                    type="text"
                    id="kick-reason-input"
                    value={kickReason}
                    onChange={(e) => setKickReason(e.target.value)}
                    placeholder="Причина (необязательно)"
                    className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      id="confirm-kick-btn"
                      onClick={() => {
                        onKickMember(targetMember.userId, kickReason);
                        onClose();
                      }}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      Исключить
                    </button>
                    <button
                      onClick={() => setShowKickConfirm(false)}
                      className="px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-lg text-xs"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* Ban */}
              {!showBanConfirm ? (
                <button
                  id="start-ban-btn"
                  onClick={() => setShowBanConfirm(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/40 hover:bg-rose-500/20 border border-neutral-800 hover:border-rose-500/40 text-rose-400 text-xs font-semibold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    Заблокировать (Ban)
                  </span>
                  <span className="text-neutral-500 font-normal">Запретить повторный вход</span>
                </button>
              ) : (
                <div className="p-3 bg-rose-600/15 border border-rose-500/40 rounded-xl space-y-2">
                  <div className="text-xs text-rose-300 font-medium">
                    Забанить {targetMember.name} навсегда?
                  </div>
                  <input
                    type="text"
                    id="ban-reason-input"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Причина блокировки"
                    className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      id="confirm-ban-btn"
                      onClick={() => {
                        onBanMember(targetMember.userId, banReason);
                        onClose();
                      }}
                      className="flex-1 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      Заблокировать
                    </button>
                    <button
                      onClick={() => setShowBanConfirm(false)}
                      className="px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-lg text-xs"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
