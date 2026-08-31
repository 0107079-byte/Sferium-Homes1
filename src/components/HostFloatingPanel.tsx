import React from 'react';
import { Crown, Lock, Unlock, Users, Shield } from 'lucide-react';
import { Room } from '../types';

interface HostFloatingPanelProps {
  room: Room;
  isHost: boolean;
  canControl: boolean;
  onToggleControl: () => void;
}

export const HostFloatingPanel: React.FC<HostFloatingPanelProps> = ({
  room,
  isHost,
  canControl,
  onToggleControl,
}) => {
  if (!isHost) return null;

  return (
    <div className="bg-gradient-to-r from-purple-950/80 to-slate-900 border border-purple-800/40 rounded-xl p-3 shadow-lg flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
          <Crown className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            Панель Хоста Комнаты
          </h4>
          <span className="text-[10px] text-slate-400">
            {canControl ? 'Свободное управление для участников' : 'Управление заблокировано (только Хост)'}
          </span>
        </div>
      </div>

      <button
        onClick={onToggleControl}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
          canControl
            ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30'
            : 'bg-purple-600 text-white hover:bg-purple-500 shadow-md'
        }`}
      >
        {canControl ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        <span>{canControl ? 'Заблокировать' : 'Разблокировать'}</span>
      </button>
    </div>
  );
};
