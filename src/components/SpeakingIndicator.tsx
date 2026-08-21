import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2 } from 'lucide-react';

export interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  volume?: number; // 0 - 100
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  color?: string; // default Discord emerald green #22c55e
  mode?: 'ring' | 'bars' | 'badge' | 'glow' | 'full';
  showBars?: boolean;
  showBadge?: boolean;
  pulseSpeed?: number;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({
  isSpeaking,
  volume = 0,
  size = 'md',
  color = '#22c55e',
  mode = 'ring',
  showBars = false,
  showBadge = false,
  label,
  className = '',
  children,
}) => {
  // Volume-dependent scaling (subtle expansion when shouting, softer when whispering)
  const volFactor = Math.max(0.2, Math.min(1.5, volume > 0 ? volume / 50 : 0.8));

  // Determine size in pixels for ring offsets if string
  const getRingOffset = () => {
    switch (size) {
      case 'xs': return 2;
      case 'sm': return 3;
      case 'md': return 4;
      case 'lg': return 6;
      case 'xl': return 8;
      default: return typeof size === 'number' ? Math.round(size * 0.08) : 4;
    }
  };

  const ringOffset = getRingOffset();

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* 1. Concentric Discord Pulse Rings */}
      <AnimatePresence>
        {isSpeaking && (mode === 'ring' || mode === 'full' || mode === 'glow') && (
          <>
            {/* Outer Expanding Wave */}
            <motion.div
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{
                scale: [1, 1.25 * volFactor, 1.4 * volFactor],
                opacity: [0.7, 0.25, 0],
              }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute rounded-full pointer-events-none z-0"
              style={{
                inset: `-${ringOffset * 2}px`,
                backgroundColor: `${color}25`,
                border: `1.5px solid ${color}80`,
              }}
            />

            {/* Inner Active Breathing Ring */}
            <motion.div
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{
                scale: [1, 1.12 * volFactor, 1],
                opacity: [0.95, 0.6, 0.95],
              }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute rounded-full pointer-events-none z-0"
              style={{
                inset: `-${ringOffset}px`,
                border: `2px solid ${color}`,
                boxShadow: `0 0 14px ${color}99, inset 0 0 8px ${color}40`,
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* 2. Wrapped Child (e.g. Avatar / Video Box) */}
      <div className="relative z-10">{children}</div>

      {/* 3. Voice Equalizer Bars Mode */}
      {(mode === 'bars' || showBars || mode === 'full') && isSpeaking && (
        <div className="absolute -bottom-2.5 z-20 flex items-center justify-center gap-0.5 bg-zinc-950/90 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-emerald-500/40 shadow-md">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{
                height: [3, Math.max(4, Math.min(14, (volume / 8) * (1 + (i % 2) * 0.4))), 3],
              }}
              transition={{
                duration: 0.35 + i * 0.08,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-1 rounded-full"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 4px ${color}`,
              }}
            />
          ))}
        </div>
      )}

      {/* 4. Discord-style Speaking Badge */}
      {(mode === 'badge' || showBadge) && isSpeaking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 4 }}
          className="absolute -top-2 -right-2 z-20 flex items-center gap-1 bg-emerald-500 text-zinc-950 px-1.5 py-0.5 rounded-full shadow-lg text-[9px] font-black uppercase tracking-wider border border-emerald-300"
          style={{ backgroundColor: color }}
        >
          <Volume2 className="w-2.5 h-2.5 text-zinc-950 animate-pulse" />
          {label && <span>{label}</span>}
        </motion.div>
      )}
    </div>
  );
};

export default SpeakingIndicator;
