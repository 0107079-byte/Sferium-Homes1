import React from 'react';
import { User, Role } from '../types';
import { RoleBadge } from './RoleBadge';
import { Mic, MicOff, Video, VideoOff, MoreVertical } from 'lucide-react';

interface ParticipantListProps {
  users: User[];
  currentUserId: string;
  isHost: boolean;
  onUpdateRole?: (targetUserId: string, newRole: Role) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  users,
  currentUserId,
  isHost,
  onUpdateRole,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Участники ({users.length})
        </h3>
      </div>

      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
        {users.map((user) => {
          const isMe = user.id === currentUserId;
          return (
            <div
              key={user.id}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner"
                  style={{ backgroundColor: user.color || '#8b5cf6' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-200">
                      {user.name} {isMe && '(Вы)'}
                    </span>
                    <RoleBadge role={user.role} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {user.isSpeaking && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Говорит" />
                )}
                {user.isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-slate-400" />
                )}
                {user.isVideoOn ? (
                  <Video className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <VideoOff className="w-3.5 h-3.5 text-slate-600" />
                )}

                {isHost && !isMe && onUpdateRole && (
                  <select
                    value={user.role}
                    onChange={(e) => onUpdateRole(user.id, e.target.value as Role)}
                    className="bg-slate-800 border border-slate-700 text-[10px] text-slate-300 rounded px-1.5 py-0.5"
                  >
                    <option value="host">Хост</option>
                    <option value="moderator">Модератор</option>
                    <option value="member">Участник</option>
                    <option value="guest">Зритель</option>
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
