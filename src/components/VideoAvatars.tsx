import React from 'react';
import { motion } from 'motion/react';
import { Crown, Shield, Eye, Mic, MicOff } from 'lucide-react';
import { Member, VideoReaction } from '../types';
import { VoiceActivityIndicator } from './VoiceActivityIndicator';

interface VideoAvatarsProps {
  members: Record<string, Member>;
  currentUserId: string;
  hostId: string;
  reactions?: VideoReaction[];
  onMemberClick?: (member: Member) => void;
}

export const VideoAvatars: React.FC<VideoAvatarsProps> = ({
  members,
  currentUserId,
  hostId,
  reactions = [],
  onMemberClick,
}) => {
  const memberList = Object.values(members);

  // Map latest reaction for each user (last 5 seconds)
  const now = Date.now();
  const latestUserReactions = reactions.reduce((acc, r) => {
    if (now - r.timestamp < 4000) {
      acc[r.userId] = r.emoji;
    }
    return acc;
  }, {} as Record<string, string>);

  return (
    <div
      id="video-floating-avatars"
      className="flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg pointer-events-auto"
    >
      <div className="flex items-center gap-1.5 pl-1.5 pr-1 text-xs text-neutral-400 font-medium">
        <Eye className="w-3.5 h-3.5 text-indigo-400" />
        <span>{memberList.length}</span>
      </div>

      <div className="flex items-center -space-x-2 overflow-visible">
        {memberList.slice(0, 8).map((m) => {
          const isUserHost = m.userId === hostId || m.isHost;
          const isMod = m.role === 'moderator';
          const recentReaction = latestUserReactions[m.userId];
          const isMe = m.userId === currentUserId;

          return (
            <motion.div
              key={m.userId}
              whileHover={{ scale: 1.25, zIndex: 30 }}
              onClick={() => onMemberClick?.(m)}
              className="relative group cursor-pointer transition-transform"
              title={`${m.name} ${isUserHost ? '(Создатель)' : isMod ? '(Модератор)' : ''} ${isMe ? '(Вы)' : ''}`}
            >
              <VoiceActivityIndicator
                isSpeaking={Boolean(m.isSpeaking)}
                audioLevel={m.audioLevel || 0}
                isMuted={Boolean(m.isMutedByMod)}
                size="sm"
                avatar={m.avatar}
                userName={m.name}
              />

              {/* Host badge */}
              {isUserHost && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center border border-black shadow">
                  <Crown className="w-2 h-2 text-black fill-black" />
                </div>
              )}

              {/* Reaction badge over avatar */}
              {recentReaction && (
                <motion.div
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0 }}
                  className="absolute -bottom-2 -left-1 text-xs bg-neutral-900/90 rounded-full px-1 border border-white/20 shadow-md pointer-events-none"
                >
                  {recentReaction}
                </motion.div>
              )}

              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-40">
                <div className="bg-neutral-900 text-white text-[11px] font-medium px-2 py-0.5 rounded shadow-lg border border-white/10 whitespace-nowrap">
                  {m.name} {isMe && '• Вы'}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {memberList.length > 8 && (
        <span className="text-xs font-bold text-neutral-400 pl-1 pr-2">
          +{memberList.length - 8}
        </span>
      )}
    </div>
  );
};
