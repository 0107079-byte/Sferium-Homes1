import React from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';

interface VoiceActivityIndicatorProps {
  isSpeaking: boolean;
  audioLevel?: number; // 0 - 100
  isMuted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLevelBar?: boolean;
  userName?: string;
  avatar?: string;
}

export const VoiceActivityIndicator: React.FC<VoiceActivityIndicatorProps> = ({
  isSpeaking,
  audioLevel = 0,
  isMuted = false,
  size = 'md',
  showLevelBar = false,
  userName,
  avatar,
}) => {
  const isLoud = audioLevel > 80;

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  const getRingColor = () => {
    if (isMuted) return 'border-neutral-600/60 ring-0';
    if (isLoud) return 'border-red-500 ring-2 ring-red-500/50 animate-pulse';
    if (isSpeaking) return 'border-emerald-400 ring-2 ring-emerald-400/40 animate-pulse';
    return 'border-white/10 ring-0';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Avatar Container with VAD border */}
      <div
        className={`relative flex items-center justify-center rounded-full border-2 transition-all duration-200 bg-neutral-800 select-none overflow-hidden ${
          sizeClasses[size]
        } ${getRingColor()}`}
      >
        {avatar ? (
          <span className="text-center">{avatar}</span>
        ) : (
          <span className="font-semibold text-neutral-300">
            {userName ? userName.slice(0, 2).toUpperCase() : '👤'}
          </span>
        )}

        {/* Muted overlay badge */}
        {isMuted && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <MicOff className="w-3.5 h-3.5 text-neutral-400" />
          </div>
        )}
      </div>

      {/* Voice Activity Status Dot */}
      <div
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-neutral-900 flex items-center justify-center transition-colors ${
          isMuted
            ? 'bg-neutral-600'
            : isLoud
            ? 'bg-red-500 ring-2 ring-red-500/50'
            : isSpeaking
            ? 'bg-emerald-400 ring-2 ring-emerald-400/50'
            : 'bg-neutral-500/50'
        }`}
        title={
          isMuted
            ? 'Микрофон выключен'
            : isLoud
            ? 'Слишком громко!'
            : isSpeaking
            ? 'Говорит'
            : 'Молчит'
        }
      />

      {/* Optional Audio level meter */}
      {showLevelBar && !isMuted && (
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ${
              isLoud ? 'bg-red-500' : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, audioLevel))}%` }}
          />
        </div>
      )}
    </div>
  );
};
