import React from 'react';
import { SyncController } from '../plugins/videoSync';
import { Play, Pause, RotateCcw, FastForward, Rewind, Activity } from 'lucide-react';
import { SyncStateMessage } from '../types';

interface RemoteControlPanelProps {
  syncController: SyncController | null;
  syncState: SyncStateMessage | null;
  lastDriftInfo: { drift: number; type: string };
  isHost: boolean;
}

export const RemoteControlPanel: React.FC<RemoteControlPanelProps> = ({
  syncController,
  syncState,
  lastDriftInfo,
  isHost,
}) => {
  const isPlaying = syncState?.playing ?? false;
  const currentPos = syncState?.position ?? 0;
  const revision = syncState?.revision ?? 0;

  const handlePlay = () => syncController?.handleUserCommand('play');
  const handlePause = () => syncController?.handleUserCommand('pause');
  const handleJump = (delta: number) => {
    const target = Math.max(0, currentPos + delta);
    syncController?.handleUserCommand('seek', target);
  };
  const handleRate = (rate: number) => {
    syncController?.handleUserCommand('rate', undefined, rate);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-slate-200">Пульт управления (SYNC_COMMAND)</h4>
        </div>
        <span className="text-xs font-mono bg-purple-950/60 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40">
          rev #{revision}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => handleJump(-10)}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center justify-center gap-1 transition"
        >
          <Rewind className="w-3.5 h-3.5" /> -10с
        </button>

        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="col-span-2 p-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition shadow-sm"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
          {isPlaying ? 'Пауза комнаты' : 'Запуск комнаты'}
        </button>

        <button
          onClick={() => handleJump(10)}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center justify-center gap-1 transition"
        >
          +10с <FastForward className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
        <div>
          <span>Дрифт коррекция: </span>
          <span className={`font-mono font-medium ${lastDriftInfo.drift > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {(lastDriftInfo.drift || 0).toFixed(2)}s ({lastDriftInfo.type})
          </span>
        </div>
        <button
          onClick={() => syncController?.requestInitialSync()}
          className="text-purple-400 hover:text-purple-300 underline text-xs"
        >
          SYNC_REQUEST
        </button>
      </div>
    </div>
  );
};
