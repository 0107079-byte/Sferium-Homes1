import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Maximize2, Minimize2, Eye, Sparkles, MessageSquare } from 'lucide-react';
import { Member, VideoReaction, SyncStatusInfo } from '../types';
import { VideoReactions } from './VideoReactions';
import { VideoAvatars } from './VideoAvatars';

interface CinemaModeProps {
  videoElement: React.ReactNode;
  members: Record<string, Member>;
  currentUserId: string;
  hostId: string;
  reactions: VideoReaction[];
  syncStatus: SyncStatusInfo;
  onSendReaction: (emoji: string) => void;
  onExitCinema: () => void;
  onToggleChat?: () => void;
}

export const CinemaMode: React.FC<CinemaModeProps> = ({
  videoElement,
  members,
  currentUserId,
  hostId,
  reactions,
  syncStatus,
  onSendReaction,
  onExitCinema,
  onToggleChat,
}) => {
  // Listen for Escape key to exit cinema mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExitCinema();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExitCinema]);

  return (
    <div
      id="cinema-mode-overlay"
      className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center overflow-hidden select-none"
    >
      {/* Top Floating Controls */}
      <div className="absolute top-4 inset-x-6 flex items-center justify-between z-40 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-xs text-white">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-bold">Режим Кинотеатра</span>
            <span className="text-[11px] text-neutral-400 font-mono">ESC для выхода</span>
          </div>

          <VideoAvatars
            members={members}
            currentUserId={currentUserId}
            hostId={hostId}
            reactions={reactions}
          />
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="p-2 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-all"
              title="Открыть чат"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          <button
            id="btn-exit-cinema"
            onClick={onExitCinema}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/80 backdrop-blur-md border border-white/10 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-all"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Main Video Arena */}
      <div className="relative w-full h-full max-w-7xl max-h-[92vh] flex items-center justify-center p-2 sm:p-6">
        <div className="relative w-full h-full aspect-video max-h-full rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-neutral-950 flex items-center justify-center">
          {videoElement}

          {/* Floating Reactions Overlay */}
          <VideoReactions
            reactions={reactions}
            onSendReaction={onSendReaction}
          />
        </div>
      </div>

      {/* Bottom Floating Reaction Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
        <VideoReactions
          reactions={[]}
          onSendReaction={onSendReaction}
        />
      </div>
    </div>
  );
};
