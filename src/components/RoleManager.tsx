import React, { useState } from 'react';
import {
  Shield,
  Crown,
  User as UserIcon,
  Eye,
  Settings,
  Users,
  Ban,
  X,
  Check,
  Lock,
  Unlock,
  Radio,
  Sliders,
  Sparkles,
  Video,
  Monitor,
  Mic,
  RotateCcw,
} from 'lucide-react';
import { RoomState, UserRole, RolePermissions, DEFAULT_ROLE_PERMISSIONS, Member } from '../types';
import { RoleBadge, ROLE_CONFIG } from './RoleBadge';
import { UserRoleMenu } from './UserRoleMenu';

interface RoleManagerProps {
  room: RoomState;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdateRole: (targetUserId: string, role: UserRole, customPermissions?: Partial<RolePermissions>) => void;
  onKickMember: (targetUserId: string, reason?: string) => void;
  onBanMember: (targetUserId: string, reason?: string) => void;
  onTransferHost: (targetUserId: string) => void;
  onToggleModMute: (targetUserId: string, isMuted: boolean) => void;
  onUpdateRoomSettings: (settings: {
    anyoneCanControl?: boolean;
    defaultRole?: UserRole;
    rolePermissionsOverride?: Partial<Record<UserRole, Partial<RolePermissions>>>;
  }) => void;
  onUnbanUser?: (userId: string) => void;
  id?: string;
}

export const RoleManager: React.FC<RoleManagerProps> = ({
  room,
  currentUserId,
  isOpen,
  onClose,
  onUpdateRole,
  onKickMember,
  onBanMember,
  onTransferHost,
  onToggleModMute,
  onUpdateRoomSettings,
  onUnbanUser,
  id,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'bans' | 'settings'>('members');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<UserRole>('member');
  const [selectedMemberForMenu, setSelectedMemberForMenu] = useState<Member | null>(null);

  if (!isOpen) return null;

  const currentMember = room.members[currentUserId];
  const isHost = room.hostId === currentUserId;
  const currentRole: UserRole = currentMember?.role || (isHost ? 'host' : 'member');
  const canManage = isHost || currentRole === 'moderator';

  const membersList = Object.values(room.members || {});
  const bannedList = room.bannedUserIds || [];

  // Group members by role
  const roleOrder: UserRole[] = ['host', 'moderator', 'member', 'viewer'];
  const groupedMembers: Record<UserRole, Member[]> = {
    host: [],
    moderator: [],
    member: [],
    viewer: [],
  };

  membersList.forEach((m) => {
    const role: UserRole = m.userId === room.hostId ? 'host' : m.role || room.defaultRole || 'member';
    if (groupedMembers[role]) {
      groupedMembers[role].push(m);
    } else {
      groupedMembers.member.push(m);
    }
  });

  const getEffectiveRolePerm = (role: UserRole, permKey: keyof RolePermissions): boolean => {
    if (room.rolePermissionsOverride?.[role]?.[permKey] !== undefined) {
      return Boolean(room.rolePermissionsOverride[role]![permKey]);
    }
    return DEFAULT_ROLE_PERMISSIONS[role][permKey];
  };

  const handleRoleMatrixToggle = (role: UserRole, permKey: keyof RolePermissions) => {
    if (!canManage) return;
    if (role === 'host') return; // Host permissions cannot be downgraded

    const currentVal = getEffectiveRolePerm(role, permKey);
    const overrides = room.rolePermissionsOverride || {};
    const roleOverride = overrides[role] || {};

    const updatedOverrides = {
      ...overrides,
      [role]: {
        ...roleOverride,
        [permKey]: !currentVal,
      },
    };

    onUpdateRoomSettings({
      rolePermissionsOverride: updatedOverrides,
    });
  };

  const handleResetRoleOverrides = (role: UserRole) => {
    if (!canManage) return;
    const overrides = { ...(room.rolePermissionsOverride || {}) };
    delete overrides[role];
    onUpdateRoomSettings({ rolePermissionsOverride: overrides });
  };

  return (
    <>
      <div
        id={id || 'role-manager-modal'}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] text-neutral-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Navigation Sidebar */}
          <div className="w-full md:w-60 bg-neutral-950/60 border-b md:border-b-0 md:border-r border-neutral-800 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 px-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-white">Роли и Доступ</h2>
                  <p className="text-[11px] text-neutral-400 font-mono">Зал #{room.roomId}</p>
                </div>
              </div>

              {/* Navigation buttons */}
              <nav className="space-y-1">
                <button
                  id="tab-members-btn"
                  onClick={() => setActiveTab('members')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'members'
                      ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Участники
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-300 font-mono">
                    {membersList.length}
                  </span>
                </button>

                <button
                  id="tab-role-matrix-btn"
                  onClick={() => setActiveTab('roles')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'roles'
                      ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    Матрица прав
                  </span>
                </button>

                <button
                  id="tab-room-settings-btn"
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'settings'
                      ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-amber-400" />
                    Настройки зала
                  </span>
                </button>

                <button
                  id="tab-bans-btn"
                  onClick={() => setActiveTab('bans')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'bans'
                      ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Ban className="w-4 h-4 text-rose-400" />
                    Бан-лист
                  </span>
                  {bannedList.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-400 font-mono font-bold">
                      {bannedList.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Current user badge info */}
            <div className="pt-4 border-t border-neutral-800 mt-4 md:mt-0">
              <div className="text-[11px] text-neutral-400 mb-1">Ваш статус:</div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  {currentMember?.name || 'Вы'}
                </span>
                <RoleBadge role={currentRole} size="xs" />
              </div>
            </div>
          </div>

          {/* Right Main Content Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-neutral-900">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-900/50">
              <div>
                <h3 className="text-base font-bold text-white">
                  {activeTab === 'members' && 'Управление участниками и ролями'}
                  {activeTab === 'roles' && 'Настройка разрешений для ролей'}
                  {activeTab === 'settings' && 'Глобальные параметры доступа зала'}
                  {activeTab === 'bans' && 'Заблокированные пользователи'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {activeTab === 'members' && 'Назначайте роли, ограничивайте доступ или исключайте участников.'}
                  {activeTab === 'roles' && 'Гибкая настройка прав в стиле Discord для каждого уровня доступа.'}
                  {activeTab === 'settings' && 'Режим управления воспроизведением и роль по умолчанию для новых гостей.'}
                  {activeTab === 'bans' && 'Список пользователей, которым запрещен вход в эту комнату.'}
                </p>
              </div>

              <button
                id="close-role-manager-btn"
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-5">
              {/* TAB 1: MEMBERS */}
              {activeTab === 'members' && (
                <div className="space-y-4">
                  {roleOrder.map((roleKey) => {
                    const list = groupedMembers[roleKey];
                    if (list.length === 0) return null;
                    const roleCfg = ROLE_CONFIG[roleKey];

                    return (
                      <div key={roleKey} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <span className={`text-xs font-bold uppercase tracking-wider ${roleCfg.textColor}`}>
                            {roleCfg.label} — {list.length}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {list.map((m) => {
                            const isMe = m.userId === currentUserId;
                            return (
                              <div
                                key={m.userId}
                                id={`member-row-${m.userId}`}
                                className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 hover:bg-neutral-800/80 border border-neutral-800 transition-all"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-neutral-800 border border-neutral-700 shrink-0"
                                    style={{ color: m.color || '#a855f7' }}
                                  >
                                    {m.avatar || '🍿'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-white truncate">
                                        {m.name}
                                      </span>
                                      {isMe && (
                                        <span className="text-[10px] text-neutral-400 font-mono bg-neutral-800 px-1 py-0.5 rounded">
                                          (Вы)
                                        </span>
                                      )}
                                      {m.isMutedByMod && (
                                        <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                          Мут
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-neutral-500 font-mono">
                                      {m.userId}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <RoleBadge role={roleKey} size="xs" />
                                  <button
                                    id={`manage-user-btn-${m.userId}`}
                                    onClick={() => setSelectedMemberForMenu(m)}
                                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
                                  >
                                    Опции
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: ROLE MATRIX */}
              {activeTab === 'roles' && (
                <div className="space-y-4">
                  {/* Role picker buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['moderator', 'member', 'viewer'] as UserRole[]).map((r) => {
                      const cfg = ROLE_CONFIG[r];
                      const isSelected = selectedRoleForMatrix === r;
                      return (
                        <button
                          key={r}
                          id={`matrix-role-btn-${r}`}
                          onClick={() => setSelectedRoleForMatrix(r)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? `${cfg.bgColor} ${cfg.borderColor} ring-1 ring-neutral-500`
                              : 'bg-neutral-800/30 border-neutral-800 hover:bg-neutral-800/60'
                          }`}
                        >
                          <RoleBadge role={r} size="xs" />
                          <p className="text-[11px] text-neutral-400 mt-2 line-clamp-1">{cfg.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Permissions matrix toggles for selected role */}
                  <div className="p-4 bg-neutral-800/30 border border-neutral-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider">
                          Права для: {ROLE_CONFIG[selectedRoleForMatrix].label}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Применяются ко всем участникам с данной ролью
                        </div>
                      </div>

                      {canManage && (
                        <button
                          id="reset-role-overrides-btn"
                          onClick={() => handleResetRoleOverrides(selectedRoleForMatrix)}
                          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800 border border-neutral-700 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Сбросить по умолчанию
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Video control */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800/60">
                        <div className="flex items-center gap-2.5">
                          <Sliders className="w-4 h-4 text-indigo-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Управление плеером</div>
                            <div className="text-[11px] text-neutral-400">Play, Pause, Перемотка, выбор ссылок</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          id="matrix-perm-manageVideo"
                          disabled={!canManage}
                          checked={getEffectiveRolePerm(selectedRoleForMatrix, 'manageVideo')}
                          onChange={() => handleRoleMatrixToggle(selectedRoleForMatrix, 'manageVideo')}
                          className="w-4 h-4 rounded text-indigo-500 bg-neutral-700 border-neutral-600 cursor-pointer"
                        />
                      </div>

                      {/* Voice & Mute */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800/60">
                        <div className="flex items-center gap-2.5">
                          <Mic className="w-4 h-4 text-emerald-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Модерация голосового чата</div>
                            <div className="text-[11px] text-neutral-400">Возможность мутить других участников</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          id="matrix-perm-manageVoice"
                          disabled={!canManage}
                          checked={getEffectiveRolePerm(selectedRoleForMatrix, 'manageVoice')}
                          onChange={() => handleRoleMatrixToggle(selectedRoleForMatrix, 'manageVoice')}
                          className="w-4 h-4 rounded text-emerald-500 bg-neutral-700 border-neutral-600 cursor-pointer"
                        />
                      </div>

                      {/* Manage Members (Kick/Ban) */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800/60">
                        <div className="flex items-center gap-2.5">
                          <Shield className="w-4 h-4 text-rose-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Кик и Бан участников</div>
                            <div className="text-[11px] text-neutral-400">Исключение нарушителей из зала</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          id="matrix-perm-manageMembers"
                          disabled={!canManage}
                          checked={getEffectiveRolePerm(selectedRoleForMatrix, 'manageMembers')}
                          onChange={() => handleRoleMatrixToggle(selectedRoleForMatrix, 'manageMembers')}
                          className="w-4 h-4 rounded text-rose-500 bg-neutral-700 border-neutral-600 cursor-pointer"
                        />
                      </div>

                      {/* Camera access */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800/60">
                        <div className="flex items-center gap-2.5">
                          <Video className="w-4 h-4 text-emerald-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Трансляция веб-камеры</div>
                            <div className="text-[11px] text-neutral-400">Включение видео в WebRTC</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          id="matrix-perm-canShareCamera"
                          disabled={!canManage}
                          checked={getEffectiveRolePerm(selectedRoleForMatrix, 'canShareCamera')}
                          onChange={() => handleRoleMatrixToggle(selectedRoleForMatrix, 'canShareCamera')}
                          className="w-4 h-4 rounded text-emerald-500 bg-neutral-700 border-neutral-600 cursor-pointer"
                        />
                      </div>

                      {/* Screen share */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800/60">
                        <div className="flex items-center gap-2.5">
                          <Monitor className="w-4 h-4 text-purple-400" />
                          <div>
                            <div className="text-xs font-semibold text-white">Демонстрация экрана</div>
                            <div className="text-[11px] text-neutral-400">Шеринг рабочего стола/вкладок</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          id="matrix-perm-canShareScreen"
                          disabled={!canManage}
                          checked={getEffectiveRolePerm(selectedRoleForMatrix, 'canShareScreen')}
                          onChange={() => handleRoleMatrixToggle(selectedRoleForMatrix, 'canShareScreen')}
                          className="w-4 h-4 rounded text-purple-500 bg-neutral-700 border-neutral-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ROOM SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  {/* Anyone can control toggle */}
                  <div className="p-4 bg-neutral-800/30 border border-neutral-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {room.anyoneCanControl !== false ? (
                          <Unlock className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-sm font-bold text-white">
                          Свободное управление плеером
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 max-w-md">
                        Если включено, участники с ролью «Участник» могут ставить на паузу, перематывать и менять видео.
                      </p>
                    </div>

                    <button
                      id="toggle-anyone-control-btn"
                      disabled={!canManage}
                      onClick={() =>
                        onUpdateRoomSettings({
                          anyoneCanControl: room.anyoneCanControl === false ? true : false,
                        })
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        room.anyoneCanControl !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      }`}
                    >
                      {room.anyoneCanControl !== false ? 'Включено (Все)' : 'Только Модераторы'}
                    </button>
                  </div>

                  {/* Default Role Selection */}
                  <div className="p-4 bg-neutral-800/30 border border-neutral-800 rounded-xl space-y-3">
                    <div>
                      <div className="text-sm font-bold text-white">
                        Роль по умолчанию для новых участников
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Какую роль автоматически получает пользователь, заходящий по ссылке зала.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        id="set-default-member-btn"
                        disabled={!canManage}
                        onClick={() => onUpdateRoomSettings({ defaultRole: 'member' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          (room.defaultRole || 'member') === 'member'
                            ? 'bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500'
                            : 'bg-neutral-800/40 border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          <UserIcon className="w-4 h-4 text-emerald-400" />
                          Участник (Member)
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Может общаться в чате, включать камеру и микрофон.
                        </p>
                      </button>

                      <button
                        id="set-default-viewer-btn"
                        disabled={!canManage}
                        onClick={() => onUpdateRoomSettings({ defaultRole: 'viewer' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          room.defaultRole === 'viewer'
                            ? 'bg-slate-500/20 border-slate-400 ring-1 ring-slate-400'
                            : 'bg-neutral-800/40 border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs text-white">
                          <Eye className="w-4 h-4 text-slate-400" />
                          Зритель (Viewer)
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Только пассивный просмотр трансляции и текстовый чат.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BANS */}
              {activeTab === 'bans' && (
                <div className="space-y-3">
                  {bannedList.length === 0 ? (
                    <div className="p-8 text-center bg-neutral-800/20 border border-neutral-800 rounded-xl">
                      <Shield className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                      <p className="text-xs text-neutral-400">В этом зале пока нет заблокированных пользователей.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bannedList.map((bannedId) => (
                        <div
                          key={bannedId}
                          id={`banned-row-${bannedId}`}
                          className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/20"
                        >
                          <div className="flex items-center gap-2.5">
                            <Ban className="w-4 h-4 text-rose-400" />
                            <span className="text-xs font-mono text-neutral-300">{bannedId}</span>
                          </div>

                          {canManage && onUnbanUser && (
                            <button
                              id={`unban-btn-${bannedId}`}
                              onClick={() => onUnbanUser(bannedId)}
                              className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-emerald-400 border border-neutral-700 rounded-lg transition-colors"
                            >
                              Разблокировать
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Context Role Menu */}
      {selectedMemberForMenu && (
        <UserRoleMenu
          targetMember={selectedMemberForMenu}
          currentUserId={currentUserId}
          room={room}
          onClose={() => setSelectedMemberForMenu(null)}
          onUpdateRole={onUpdateRole}
          onKickMember={onKickMember}
          onBanMember={onBanMember}
          onTransferHost={onTransferHost}
          onToggleModMute={onToggleModMute}
        />
      )}
    </>
  );
};
