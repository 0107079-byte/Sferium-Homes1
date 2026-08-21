import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import UserAvatar from './UserAvatar';
import {
  Mic,
  MicOff,
  Crown,
  UserX,
  Volume2,
  VolumeX,
  Shield,
  UserCheck,
  Search,
  Users,
  MoreVertical,
  Radio,
  Edit3
} from 'lucide-react';
import { typingManager, TypingUser } from '../utils/typingIndicator';

export interface ParticipantListProps {
  members: Member[] | Record<string, Member>;
  currentUserId: string;
  isHost: boolean;
  onKickUser?: (userId: string, reason?: string) => void;
  onMuteUser?: (userId: string, isMuted: boolean) => void;
  onTransferHost?: (userId: string) => void;
  onToggleControl?: () => void;
  anyoneCanControl?: boolean;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  members,
  currentUserId,
  isHost,
  onKickUser,
  onMuteUser,
  onTransferHost,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [kickConfirmUserId, setKickConfirmUserId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    const unsub = typingManager.subscribe((users) => {
      setTypingUsers(users);
    });
    return unsub;
  }, []);

  const memberList: Member[] = Array.isArray(members)
    ? members
    : Object.values(members || {});

  const filteredMembers = memberList.filter((m) =>
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.userId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKick = (targetUserId: string) => {
    if (onKickUser) {
      onKickUser(targetUserId, 'Исключен создателем комнаты');
    }
    setKickConfirmUserId(null);
  };

  const handleMute = (targetUserId: string, currentMuted: boolean) => {
    if (onMuteUser) {
      onMuteUser(targetUserId, !currentMuted);
    }
  };

  const handleTransfer = (targetUserId: string) => {
    if (window.confirm(`Вы уверены, что хотите передать роль Создателя пользователю?`)) {
      if (onTransferHost) {
        onTransferHost(targetUserId);
      }
    }
  };

  return (
    <div id="participant-list-container" className="flex flex-col h-full bg-zinc-950/90 backdrop-blur-md rounded-2xl border border-zinc-800/80 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-850 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Участники комнаты
            </h3>
            <p className="text-[10px] text-zinc-400">
              {memberList.length} в сети
            </p>
          </div>
        </div>

        {isHost && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-300 flex items-center gap-1">
            <Crown className="w-3 h-3 text-amber-400" />
            Вы Хост
          </span>
        )}
      </div>

      {/* Typing Alert Banner if someone is typing */}
      {typingUsers.length > 0 && (
        <div className="px-3 py-1.5 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center space-x-2 text-[11px] text-indigo-300 animate-pulse">
          <Edit3 className="w-3.5 h-3.5" />
          <span>
            {typingUsers.map((u) => u.name).join(', ')} печатает...
          </span>
        </div>
      )}

      {/* Search Bar */}
      {memberList.length > 5 && (
        <div className="p-2 border-b border-zinc-850/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Поиск участников..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/90 text-xs text-zinc-200 placeholder-zinc-500 pl-8 pr-3 py-1.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            Участники не найдены
          </div>
        ) : (
          filteredMembers.map((member) => {
            const isMe = member.userId === currentUserId;
            const isUserHost = member.isHost || member.role === 'host';
            const isMuted = member.isMutedByMod;
            const isSpeaking = member.isSpeaking;
            const isUserTyping = typingUsers.some((u) => u.userId === member.userId);

            return (
              <div
                key={member.userId}
                id={`participant-${member.userId}`}
                className={`group relative flex items-center justify-between p-2 rounded-xl transition-all border ${
                  isMe
                    ? 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/50'
                    : isUserHost
                    ? 'bg-amber-950/10 border-amber-500/20 hover:border-amber-500/40'
                    : 'bg-zinc-900/50 border-zinc-850/60 hover:border-zinc-700/80 hover:bg-zinc-900/80'
                }`}
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <UserAvatar
                      avatar={member.avatar || '🍿'}
                      name={member.name}
                      color={member.color || '#6366f1'}
                      size="sm"
                      status="online"
                      showStatus
                    />
                    {isSpeaking && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold text-zinc-100 truncate">
                        {member.name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded font-medium">
                          Вы
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 mt-0.5">
                      {isUserHost ? (
                        <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" />
                          Хост
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-400 flex items-center gap-0.5">
                          Гость
                        </span>
                      )}

                      {isUserTyping && (
                        <span className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1 rounded flex items-center gap-0.5 animate-pulse">
                          <Edit3 className="w-2.5 h-2.5" />
                          печатает...
                        </span>
                      )}

                      {isMuted && (
                        <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1 rounded flex items-center gap-0.5">
                          <MicOff className="w-2.5 h-2.5" />
                          Мут
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  {/* Speaking indicator */}
                  {isSpeaking && (
                    <div className="p-1 text-emerald-400 bg-emerald-500/10 rounded-lg">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                  )}

                  {/* Host Management Controls */}
                  {isHost && !isMe && (
                    <div className="flex items-center space-x-1">
                      {/* Mute/Unmute Button */}
                      <button
                        type="button"
                        id={`btn-mute-${member.userId}`}
                        onClick={() => handleMute(member.userId, Boolean(isMuted))}
                        title={isMuted ? 'Включить микрофон' : 'Выключить микрофон (Mute)'}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isMuted
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                        }`}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      {/* Transfer Host Button */}
                      <button
                        type="button"
                        id={`btn-transfer-${member.userId}`}
                        onClick={() => handleTransfer(member.userId)}
                        title="Назначить создателем (Передать Хоста)"
                        className="p-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-400 hover:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </button>

                      {/* Kick User Button */}
                      {kickConfirmUserId === member.userId ? (
                        <div className="flex items-center space-x-1 bg-rose-950/80 p-0.5 rounded-lg border border-rose-600/40">
                          <button
                            type="button"
                            onClick={() => handleKick(member.userId)}
                            className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white rounded cursor-pointer"
                          >
                            Кикнуть
                          </button>
                          <button
                            type="button"
                            onClick={() => setKickConfirmUserId(null)}
                            className="px-1 py-0.5 text-[10px] text-zinc-400 hover:text-white cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          id={`btn-kick-${member.userId}`}
                          onClick={() => setKickConfirmUserId(member.userId)}
                          title="Исключить из комнаты (Kick)"
                          className="p-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ParticipantList;
