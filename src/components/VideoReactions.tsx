import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Flame, Sparkles, Smile, MessageSquare, Zap } from 'lucide-react';
import { VideoReaction } from '../types';
import { soundManager } from '../utils/soundNotifications';

interface VideoReactionsProps {
  reactions: VideoReaction[];
  onSendReaction: (emoji: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

const PRESET_REACTIONS = [
  { emoji: '❤️', label: 'Любовь', icon: Heart, color: 'hover:bg-rose-500/20 text-rose-400' },
  { emoji: '🔥', label: 'Огонь', icon: Flame, color: 'hover:bg-amber-500/20 text-amber-400' },
  { emoji: '😂', label: 'Смех', icon: Smile, color: 'hover:bg-yellow-500/20 text-yellow-400' },
  { emoji: '😮', label: 'Шок', icon: Sparkles, color: 'hover:bg-blue-500/20 text-blue-400' },
  { emoji: '😡', label: 'Злость', icon: Zap, color: 'hover:bg-red-500/20 text-red-400' },
  { emoji: '🎉', label: 'Праздник', icon: Sparkles, color: 'hover:bg-purple-500/20 text-purple-400' },
];

export const VideoReactions: React.FC<VideoReactionsProps> = ({
  reactions,
  onSendReaction,
  disabled = false,
  compact = false,
}) => {
  const [activeCooldown, setActiveCooldown] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const handleSend = (emoji: string) => {
    if (disabled || activeCooldown) return;
    onSendReaction(emoji);
    setLastSent(emoji);
    setActiveCooldown(true);
    soundManager.playAiSuccess();

    setTimeout(() => {
      setActiveCooldown(false);
    }, 400);
  };

  return (
    <>
      {/* Floating Particles Canvas Overlay */}
      <div 
        id="video-reactions-canvas"
        className="absolute inset-0 pointer-events-none overflow-hidden z-30"
      >
        <AnimatePresence>
          {reactions.map((react) => (
            <motion.div
              key={react.id}
              initial={{
                opacity: 0,
                scale: 0.4,
                x: `${react.xPercent}%`,
                y: `${react.yPercent + 15}%`,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1.3, 1.1, 0.9],
                x: `${react.xPercent + (Math.sin(react.timestamp) * 8)}%`,
                y: `${Math.max(5, react.yPercent - 35)}%`,
              }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{
                duration: 2.2,
                ease: 'easeOut',
              }}
              className="absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 shadow-2xl"
              style={{
                left: 0,
                top: 0,
              }}
            >
              <span className="text-2xl filter drop-shadow-md select-none">
                {react.emoji}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-white/90 max-w-[80px] truncate">
                  {react.userName}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Interactive Quick Reaction Bar */}
      <div
        id="video-reaction-bar"
        className={`flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl transition-all ${
          compact ? 'scale-90 origin-bottom-left' : ''
        }`}
      >
        {PRESET_REACTIONS.map((item) => (
          <button
            key={item.emoji}
            id={`btn-react-${item.emoji}`}
            onClick={() => handleSend(item.emoji)}
            disabled={disabled}
            title={item.label}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 transform hover:scale-125 active:scale-95 ${
              item.color
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="text-xl filter drop-shadow select-none group-hover:animate-bounce">
              {item.emoji}
            </span>
          </button>
        ))}
      </div>
    </>
  );
};
