import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ScreenShare,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Pin,
  Sparkles,
  Monitor,
  LayoutGrid,
  Tv,
  Users
} from 'lucide-react';
import { LiveKitParticipant } from '../types';
import UserAvatar from './UserAvatar';
import SpeakingIndicator from './SpeakingIndicator';

export interface VideoGridProps {
  children?: React.ReactNode; // The main video player (YouTube/VK/Rutube/Stream)
  participants?: LiveKitParticipant[];
  isLocalCameraEnabled?: boolean;
  localVideoRef?: React.RefObject<HTMLVideoElement>;
  currentUserName?: string;
  currentUserAvatar?: string;
  currentUserColor?: string;
  isLocalMuted?: boolean;
  isLocalSpeaking?: boolean;
  localVolume?: number;
  layoutMode?: 'cinematic' | 'grid' | 'sidebar';
  onLayoutChange?: (mode: 'cinematic' | 'grid' | 'sidebar') => void;
}

export const VideoGrid: React.FC<VideoGridProps> = React.memo(({
  children,
  participants = [],
  isLocalCameraEnabled = false,
  localVideoRef,
  currentUserName = 'Вы',
  currentUserAvatar = '🍿',
  currentUserColor = '#6366f1',
  isLocalMuted = false,
  isLocalSpeaking = false,
  localVolume = 0,
  layoutMode = 'cinematic',
  onLayoutChange,
}) => {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeVideoPeers = React.useMemo(() => participants.filter((p) => Boolean(p.stream)), [participants]);
  const totalVideoTiles = (isLocalCameraEnabled ? 1 : 0) + activeVideoPeers.length;

  return (
    <motion.div
      layout
      className="w-full flex flex-col space-y-3 relative group"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* Main Video Stage with Glassmorphism & Gradient Border */}
      <motion.div
        layout
        className="relative w-full rounded-3xl overflow-hidden bg-zinc-950/90 border border-zinc-800/80 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl group/stage"
      >
        {/* Subtle Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 z-20 opacity-80" />

        {/* The Primary Video Player */}
        <div className="w-full aspect-video min-h-[260px] sm:min-h-[380px] md:min-h-[440px] lg:min-h-[480px] relative bg-black flex items-center justify-center">
          {children}
        </div>

        {/* Floating Mini Webcams overlay in Cinematic Mode */}
        {totalVideoTiles > 0 && layoutMode === 'cinematic' && (
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2.5 max-w-[80%] overflow-x-auto p-1.5 scrollbar-none">
            <AnimatePresence mode="popLayout">
              {/* Local Camera Tile */}
              {isLocalCameraEnabled && (
                <motion.div
                  key="local-cam-tile"
                  initial={{ opacity: 0, scale: 0.8, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 15 }}
                  whileHover={{ scale: 1.05 }}
                  className={`relative w-36 sm:w-44 aspect-video rounded-2xl overflow-hidden bg-zinc-900/90 border shadow-2xl backdrop-blur-md transition-all ${
                    isLocalSpeaking
                      ? 'border-emerald-400 ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(34,197,94,0.45)]'
                      : 'border-zinc-700/80'
                  }`}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 text-white font-bold truncate">
                      <SpeakingIndicator isSpeaking={isLocalSpeaking} volume={localVolume} size="xs" mode="ring">
                        <UserAvatar
                          avatar={currentUserAvatar}
                          name={currentUserName}
                          color={currentUserColor}
                          size="xs"
                          status="online"
                        />
                      </SpeakingIndicator>
                      <span className="truncate">{currentUserName} (Вы)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isLocalSpeaking && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      )}
                      {isLocalMuted ? (
                        <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
                      ) : (
                        <Mic className={`w-3 h-3 ${isLocalSpeaking ? 'text-emerald-300' : 'text-emerald-400'} shrink-0`} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Remote Participant Video Tiles */}
              {activeVideoPeers.map((peer) => (
                <ParticipantFloatingTile key={peer.identity} participant={peer} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Grid Mode / Bento Layout for Video Hangouts */}
      {layoutMode === 'grid' && totalVideoTiles > 0 && (
        <motion.div
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1"
        >
          {isLocalCameraEnabled && (
            <motion.div
              layout
              whileHover={{ scale: 1.02 }}
              className={`relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border shadow-lg transition-all ${
                isLocalSpeaking
                  ? 'border-emerald-400 ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                  : 'border-zinc-800'
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover -scale-x-100"
              />
              <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-2 text-xs text-white font-semibold border border-white/10 shadow-lg">
                <SpeakingIndicator isSpeaking={isLocalSpeaking} volume={localVolume} size="xs" mode="ring">
                  <UserAvatar
                    avatar={currentUserAvatar}
                    name={currentUserName}
                    color={currentUserColor}
                    size="xs"
                    status="online"
                  />
                </SpeakingIndicator>
                <span>{currentUserName} (Вы)</span>
                {isLocalSpeaking && (
                  <span className="text-[10px] text-emerald-400 font-bold font-mono">Говорит</span>
                )}
              </div>
            </motion.div>
          )}

          {activeVideoPeers.map((peer) => (
            <ParticipantGridTile key={peer.identity} participant={peer} />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
});

// Subcomponent for Floating Video Tile
const ParticipantFloatingTile: React.FC<{ participant: LiveKitParticipant }> = ({ participant }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (participant.stream) {
      el.srcObject = participant.stream;
    }

    return () => {
      if (el) {
        el.srcObject = null;
      }
    };
  }, [participant.stream]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 15 }}
      whileHover={{ scale: 1.05 }}
      className={`relative w-36 sm:w-44 aspect-video rounded-2xl overflow-hidden bg-zinc-900/90 border shadow-2xl backdrop-blur-md transition-all ${
        participant.isSpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(34,197,94,0.45)]'
          : 'border-zinc-700/80'
      }`}
    >
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 text-white font-bold truncate">
          <SpeakingIndicator isSpeaking={participant.isSpeaking} size="xs" mode="ring">
            <UserAvatar
              avatar={participant.avatar || '🍿'}
              name={participant.name}
              color={participant.color || '#6366f1'}
              size="xs"
              status="online"
            />
          </SpeakingIndicator>
          <span className="truncate">{participant.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {participant.isSpeaking && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
          {participant.isMuted ? (
            <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
          ) : (
            <Mic className={`w-3 h-3 ${participant.isSpeaking ? 'text-emerald-300' : 'text-emerald-400'} shrink-0`} />
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Subcomponent for Grid Video Tile
const ParticipantGridTile: React.FC<{ participant: LiveKitParticipant }> = ({ participant }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (participant.stream) {
      el.srcObject = participant.stream;
    }

    return () => {
      if (el) {
        el.srcObject = null;
      }
    };
  }, [participant.stream]);

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02 }}
      className={`relative aspect-video rounded-2xl overflow-hidden bg-zinc-900 border shadow-lg transition-all ${
        participant.isSpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-500/80 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
          : 'border-zinc-800'
      }`}
    >
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-2 text-xs text-white font-semibold border border-white/10 shadow-lg">
        <SpeakingIndicator isSpeaking={participant.isSpeaking} size="xs" mode="ring">
          <UserAvatar
            avatar={participant.avatar || '🍿'}
            name={participant.name}
            color={participant.color || '#6366f1'}
            size="xs"
            status="online"
          />
        </SpeakingIndicator>
        <span className="truncate max-w-[120px]">{participant.name}</span>
        {participant.isSpeaking && (
          <span className="text-[10px] text-emerald-400 font-bold font-mono">Говорит</span>
        )}
      </div>
    </motion.div>
  );
};

export default VideoGrid;

