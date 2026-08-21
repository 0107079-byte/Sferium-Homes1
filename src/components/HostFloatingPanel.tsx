import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Crown, 
  Play, 
  Pause, 
  RefreshCw, 
  MicOff, 
  UserMinus, 
  Sparkles, 
  Lock, 
  Unlock, 
  LogOut, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert,
  BarChart3
} from 'lucide-react';
import { Member } from '../types';

interface HostFloatingPanelProps {
  isHost: boolean;
  isPlaying: boolean;
  anyoneCanControl?: boolean;
  members: Record<string, Member>;
  onPlayPause: () => void;
  onForceSync: () => void;
  onMuteAll: () => void;
  onToggleControl: () => void;
  onOpenPollCreator: () => void;
  onOpenHostPanel: () => void;
  onOpenAIHelp: () => void;
}

export const HostFloatingPanel: React.FC<HostFloatingPanelProps> = ({
  isHost,
  isPlaying,
  anyoneCanControl = false,
  members,
  onPlayPause,
  onForceSync,
  onMuteAll,
  onToggleControl,
  onOpenPollCreator,
  onOpenHostPanel,
  onOpenAIHelp,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isHost) return null;

  return (
    <motion.div
      id="host-floating-panel"
      drag
      dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-6 z-40 bg-neutral-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden cursor-move select-none"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-gradient-to-r from-amber-950/40 to-neutral-900 border-b border-amber-500/20">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Пульт Хоста</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      {!isCollapsed && (
        <div className="p-2 flex items-center gap-1.5">
          {/* Play/Pause */}
          <button
            id="btn-host-float-play"
            onClick={onPlayPause}
            className={`p-2 rounded-xl border transition-all ${
              isPlaying
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
            }`}
            title={isPlaying ? 'Пауза для всех' : 'Воспроизведение для всех'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>

          {/* Hard Sync */}
          <button
            id="btn-host-float-sync"
            onClick={onForceSync}
            className="p-2 rounded-xl bg-neutral-800 border border-white/10 hover:bg-neutral-700 text-neutral-200 transition-all"
            title="Принудительно уравнять всех участников"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Mute All */}
          <button
            id="btn-host-float-muteall"
            onClick={onMuteAll}
            className="p-2 rounded-xl bg-neutral-800 border border-white/10 hover:bg-rose-900/40 text-neutral-200 hover:text-rose-400 transition-all"
            title="Заглушить всех участников (Mute All)"
          >
            <MicOff className="w-4 h-4" />
          </button>

          {/* Toggle Control Lock */}
          <button
            id="btn-host-float-lock"
            onClick={onToggleControl}
            className={`p-2 rounded-xl border transition-all ${
              anyoneCanControl
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-neutral-800 border-white/10 text-neutral-400 hover:text-white'
            }`}
            title={anyoneCanControl ? 'Управление открыто всем' : 'Управление только у хоста'}
          >
            {anyoneCanControl ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          {/* Poll Creator */}
          <button
            id="btn-host-float-poll"
            onClick={onOpenPollCreator}
            className="p-2 rounded-xl bg-neutral-800 border border-white/10 hover:bg-purple-900/40 text-neutral-200 hover:text-purple-300 transition-all"
            title="Запустить голосование / опрос"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          {/* AI Host Tips */}
          <button
            id="btn-host-float-ai"
            onClick={onOpenAIHelp}
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-500/30 text-purple-200 hover:from-purple-600/50 hover:to-indigo-600/50 transition-all"
            title="ИИ-Советник Хоста"
          >
            <Sparkles className="w-4 h-4 text-purple-300" />
          </button>

          {/* Full Host Panel */}
          <button
            id="btn-host-float-full"
            onClick={onOpenHostPanel}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition-all"
          >
            Панель
          </button>
        </div>
      )}
    </motion.div>
  );
};
