import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  Lock,
  Unlock,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap
} from 'lucide-react';
import { RoomState } from '../types';

export interface ControlsProps {
  roomState: RoomState | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  canControl: boolean;
  anyoneCanControl?: boolean;
  isHost: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onForceSync?: () => void;
  onToggleControlMode?: () => void;
  onToggleFullscreen?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const Controls: React.FC<ControlsProps> = React.memo(({
  roomState,
  currentTime,
  duration,
  isPlaying,
  canControl,
  anyoneCanControl = true,
  isHost,
  onPlay,
  onPause,
  onSeek,
  onForceSync,
  onToggleControlMode,
  onToggleFullscreen,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [hoverSeekPercent, setHoverSeekPercent] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const effectiveHostTime = isHost ? currentTime : (roomState?.hostTime ?? roomState?.currentTime ?? currentTime);
  const effectivePlaying = roomState?.hostPlaying !== undefined ? roomState.hostPlaying : (roomState?.playing ?? isPlaying);
  const maxDur = duration > 0 ? duration : Math.max(effectiveHostTime + 60, 600);
  const displayTime = isDraggingSeek ? dragTime : effectiveHostTime;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / maxDur) * 100));

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDragTime(val);
    if (!isDraggingSeek) setIsDraggingSeek(true);
  };

  const handleSeekCommit = () => {
    setIsDraggingSeek(false);
    onSeek(dragTime);
  };

  const handleSkip = (secondsDelta: number) => {
    const next = Math.max(0, Math.min(maxDur, currentTime + secondsDelta));
    onSeek(next);
  };

  const handleTriggerSync = () => {
    if (onForceSync) {
      setIsSyncing(true);
      onForceSync();
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full relative rounded-3xl p-[1px] bg-gradient-to-b from-indigo-500/30 via-purple-500/20 to-pink-500/30 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl"
    >
      <div className="w-full bg-zinc-950/90 rounded-[23px] p-4 sm:p-5 flex flex-col space-y-4">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center space-x-3">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.05 }}
              className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 shrink-0"
            >
              <Sliders className="w-4 h-4" />
            </motion.div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Пульт Синхронизации
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono mt-0.5">
                <span className="text-zinc-200 font-bold">
                  {formatTime(displayTime)}
                </span>
                <span className="text-zinc-500">/</span>
                <span className="text-zinc-400 font-medium">
                  {formatTime(maxDur)}
                </span>
                <span className="text-zinc-600">•</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    anyoneCanControl
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {anyoneCanControl ? '🔓 Свободный доступ' : '🔒 Только Хост'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Host Toggle Access Button */}
            {isHost && onToggleControlMode && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleControlMode}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
                  anyoneCanControl
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shadow-amber-950/20'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 shadow-emerald-950/20'
                }`}
                title={anyoneCanControl ? 'Ограничить управление (только хост)' : 'Разрешить всем управлять'}
              >
                {anyoneCanControl ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {anyoneCanControl ? 'Заблокировать' : 'Открыть всем'}
                </span>
              </motion.button>
            )}

            {/* Collapse / Expand Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer shadow-sm"
              title={isExpanded ? 'Свернуть пульт' : 'Развернуть пульт'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>

        {/* Expandable Control Area */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="space-y-4 pt-1 overflow-hidden"
            >
              {/* Seek Progress Scrubber with Gradient and Hover Tooltip */}
              <div
                className="relative flex flex-col space-y-1.5 group/scrub"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                  setHoverSeekPercent(pct);
                }}
                onMouseLeave={() => setHoverSeekPercent(null)}
              >
                <div className="relative flex items-center h-5 cursor-pointer">
                  {/* Background Track */}
                  <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800/60 shadow-inner">
                    {/* Hover ghost bar */}
                    {hoverSeekPercent !== null && (
                      <div
                        className="absolute inset-y-0 left-0 bg-white/15 rounded-full transition-all"
                        style={{ width: `${hoverSeekPercent}%` }}
                      />
                    )}
                    {/* Active Progress Bar */}
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 rounded-full transition-all shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Scrubber Knob */}
                  <div
                    className="absolute w-4 h-4 rounded-full bg-white shadow-lg border-2 border-indigo-500 pointer-events-none -translate-x-1/2 transition-transform group-hover/scrub:scale-125"
                    style={{ left: `${progressPercent}%` }}
                  />

                  {/* Hidden Input for Smooth Scrubbing */}
                  <input
                    type="range"
                    min="0"
                    max={maxDur}
                    step="0.5"
                    value={displayTime}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekCommit}
                    onTouchEnd={handleSeekCommit}
                    disabled={!canControl}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                    title="Перемотка видео"
                  />
                </div>

                {/* Timestamps Row */}
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 px-1">
                  <span className="text-zinc-300 font-semibold">{formatTime(displayTime)}</span>
                  <span className="text-zinc-500 font-medium">{formatTime(maxDur)}</span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Playback Controls Group */}
                <div className="flex items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleSkip(-10)}
                    disabled={!canControl}
                    className="px-3 py-2.5 bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-40 text-zinc-200 rounded-2xl border border-zinc-800 transition-all flex items-center space-x-1 cursor-pointer shadow-sm"
                    title="-10 сек"
                  >
                    <RotateCcw className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold font-mono">-10s</span>
                  </motion.button>

                  {/* Hero Play / Pause Button with Morphing Animation */}
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={isPlaying ? onPause : onPlay}
                    disabled={!canControl}
                    className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer shadow-xl ${
                      isPlaying
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 shadow-amber-950/50'
                        : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white shadow-purple-950/60'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Пауза</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Смотреть</span>
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleSkip(10)}
                    disabled={!canControl}
                    className="px-3 py-2.5 bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-40 text-zinc-200 rounded-2xl border border-zinc-800 transition-all flex items-center space-x-1 cursor-pointer shadow-sm"
                    title="+10 сек"
                  >
                    <RotateCw className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold font-mono">+10s</span>
                  </motion.button>
                </div>

                {/* Secondary Utility Controls */}
                <div className="flex items-center space-x-2">
                  {onForceSync && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={handleTriggerSync}
                      className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900/90 hover:to-purple-900/90 border border-indigo-500/40 text-indigo-200 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-indigo-950/40"
                      title="Принудительно подтянуть всех зрителей к вашей секунде"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-300 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Синхронизация</span>
                    </motion.button>
                  )}

                  {onToggleFullscreen && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={onToggleFullscreen}
                      className="p-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-2xl transition-all cursor-pointer shadow-sm"
                      title="Во весь экран"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
});

export default Controls;
