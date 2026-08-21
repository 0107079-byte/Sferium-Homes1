import React from 'react';
import { 
  Users, 
  Crown, 
  Wifi, 
  Sparkles, 
  Mic, 
  MicOff, 
  MessageSquare, 
  ShieldCheck,
  RefreshCw,
  Tv
} from 'lucide-react';
import { Member, SyncStatusInfo, RoomLayoutMode } from '../types';

interface RoomStatusBarProps {
  roomId: string;
  hostName: string;
  hostAvatar?: string;
  members: Record<string, Member>;
  syncStatus: SyncStatusInfo;
  layoutMode: RoomLayoutMode;
  onOpenAI?: () => void;
  onOpenHostPanel?: () => void;
  onForceSync?: () => void;
  onToggleLayout?: (mode: RoomLayoutMode) => void;
  isHost?: boolean;
}

export const RoomStatusBar: React.FC<RoomStatusBarProps> = ({
  roomId,
  hostName,
  hostAvatar = '👑',
  members,
  syncStatus,
  layoutMode,
  onOpenAI,
  onOpenHostPanel,
  onForceSync,
  onToggleLayout,
  isHost = false,
}) => {
  const memberList = Object.values(members);
  const speakingCount = memberList.filter((m) => m.isSpeaking).length;
  const mutedCount = memberList.filter((m) => m.isMutedByMod).length;

  const getSyncBadge = () => {
    if (syncStatus.isSyncing) {
      return {
        label: 'Синхронизируем...',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse',
        dot: 'bg-amber-400',
      };
    }
    if (syncStatus.driftSeconds < 0.2) {
      return {
        label: `Синхронно (${Math.round(syncStatus.driftSeconds * 1000)}ms)`,
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    }
    return {
      label: `Дрифт ${syncStatus.driftSeconds}s`,
      color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      dot: 'bg-indigo-400',
    };
  };

  const syncBadge = getSyncBadge();

  return (
    <header
      id="room-status-bar"
      className="w-full bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3 text-xs z-20 select-none transition-colors"
    >
      {/* Left: Room ID & Host */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-white/5 font-mono font-bold text-neutral-200">
          <span className="text-neutral-500 font-normal">#</span>
          <span>{roomId}</span>
        </div>

        <button
          id="status-bar-host-info"
          onClick={isHost ? onOpenHostPanel : undefined}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-white/5 transition-colors ${
            isHost ? 'hover:bg-neutral-700/80 cursor-pointer text-amber-300' : 'text-neutral-300'
          }`}
          title={isHost ? 'Открыть панель создателя' : `Создатель зала: ${hostName}`}
        >
          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span className="font-medium">{hostAvatar} {hostName}</span>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 px-2 py-1 bg-neutral-800/50 rounded-lg">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{memberList.length} уч.</span>
        </div>
      </div>

      {/* Center: Sync & Audio status */}
      <div className="flex items-center gap-2">
        {/* Sync status pill */}
        <button
          id="status-bar-sync-pill"
          onClick={onForceSync}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${syncBadge.color}`}
          title="Нажмите для мгновенной принудительной синхронизации"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${syncBadge.dot}`} />
          <span>{syncBadge.label}</span>
          <RefreshCw className={`w-3 h-3 ml-0.5 opacity-60 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
        </button>

        {/* Voice status */}
        <div className="hidden md:flex items-center gap-2 text-neutral-400 px-2 py-1 bg-neutral-800/40 rounded-lg">
          <div className="flex items-center gap-1">
            <Mic className={`w-3.5 h-3.5 ${speakingCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'}`} />
            <span>{speakingCount}</span>
          </div>
          {mutedCount > 0 && (
            <div className="flex items-center gap-1 text-neutral-500">
              <MicOff className="w-3 h-3 text-neutral-500" />
              <span>{mutedCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: AI & Layout Modes */}
      <div className="flex items-center gap-2">
        {/* AI Status Button */}
        <button
          id="btn-status-ai-assistant"
          onClick={onOpenAI}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 text-purple-200 hover:from-purple-900/60 hover:to-indigo-900/60 transition-all font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="hidden sm:inline">ИИ‑Ассистент</span>
          <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1 py-0.2 rounded font-mono">Gemini</span>
        </button>

        {/* Cinema / Streamer Mode Quick Switch */}
        {onToggleLayout && (
          <div className="hidden lg:flex items-center gap-1 bg-neutral-800 p-0.5 rounded-lg border border-white/5">
            <button
              onClick={() => onToggleLayout('standard')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                layoutMode === 'standard' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Стандарт
            </button>
            <button
              onClick={() => onToggleLayout('cinema')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                layoutMode === 'cinema' ? 'bg-indigo-600 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Кинотеатр
            </button>
            {isHost && (
              <button
                onClick={() => onToggleLayout('streamer')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  layoutMode === 'streamer' ? 'bg-rose-600 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Стример
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
