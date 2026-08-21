import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  X, 
  Volume2, 
  VolumeX, 
  RefreshCw,
  Tv
} from 'lucide-react';
import { SyncStatusInfo } from '../types';

interface MiniPlayerProps {
  videoUrl: string;
  videoTitle?: string;
  currentTime: number;
  isPlaying: boolean;
  syncStatus: SyncStatusInfo;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onMaximize: () => void;
  onClose: () => void;
  canControl?: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  videoUrl,
  videoTitle = 'Текущее видео',
  currentTime,
  isPlaying,
  syncStatus,
  onPlayPause,
  onSeek,
  onMaximize,
  onClose,
  canControl = true,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <motion.div
      id="mini-player-container"
      drag
      dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
      initial={{ scale: 0.8, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 50 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 w-80 sm:w-96 bg-neutral-950/95 border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl transition-shadow hover:shadow-indigo-500/10 cursor-move"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/80 border-b border-white/5 select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-semibold text-neutral-200 truncate max-w-[180px]">
            {videoTitle}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-mini-maximize"
            onClick={onMaximize}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            title="Развернуть видео"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-mini-close"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-rose-900/40 text-neutral-400 hover:text-rose-400 transition-colors"
            title="Закрыть мини-плеер"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Preview Canvas / Mock Display */}
      <div className="relative aspect-video bg-neutral-900 flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-2 text-neutral-500">
          <Tv className="w-8 h-8 opacity-40 animate-pulse" />
          <span className="text-[11px] font-mono">{formatTime(currentTime)}</span>
        </div>

        {/* Sync Status Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] text-neutral-300 font-mono border border-white/10 flex items-center gap-1">
          <RefreshCw className={`w-2.5 h-2.5 ${syncStatus.isSyncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
          <span>{syncStatus.isSyncing ? 'Синхра...' : `${Math.round(syncStatus.driftSeconds * 1000)}ms`}</span>
        </div>

        {/* Hover Controls Overlay */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-between p-3 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex justify-end">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Center Play/Pause button */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              disabled={!canControl}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all disabled:opacity-40"
              title="-10 сек"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              id="btn-mini-playpause"
              onClick={onPlayPause}
              disabled={!canControl}
              className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-110 disabled:opacity-40"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>
          </div>

          {/* Bottom Time Scrubber */}
          <div className="flex items-center justify-between text-[11px] text-white/80 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span className="text-[10px] text-neutral-400">{canControl ? 'Управление активно' : 'Только просмотр'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
