import React from 'react';
import { Shield, Lock, Unlock as LockOpen } from 'lucide-react';

interface RoomDashboardProps {
  anyoneCanControl: boolean;
  isHost: boolean;
  toggleControl: () => void;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  anyoneCanControl,
  isHost,
  toggleControl
}) => {
  return (
    <div className="flex items-center justify-between bg-zinc-900/80 border border-zinc-850 p-3 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-semibold text-zinc-300">
          {anyoneCanControl ? 'Доступ свободен для всех' : 'Управляет только Хост'}
        </span>
      </div>
      {isHost && (
        <button
          type="button"
          onClick={toggleControl}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
            anyoneCanControl
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
          }`}
        >
          {anyoneCanControl ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Заблокировать</span>
            </>
          ) : (
            <>
              <LockOpen className="w-3.5 h-3.5" />
              <span>Разблокировать</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default RoomDashboard;
