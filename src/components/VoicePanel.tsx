import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Headphones,
  Volume2,
  PhoneOff,
  Radio,
  Settings,
  Users,
  ChevronDown,
  ChevronUp,
  Signal,
  Activity,
  Sparkles,
} from 'lucide-react';
import { useVoiceChat } from '../modules/voice/useVoiceChat';
import UserAvatar from './UserAvatar';
import SpeakingIndicator from './SpeakingIndicator';

export interface VoicePanelProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  currentUserColor: string;
  roomId?: string;
  isMutedByMod?: boolean;
  canShareCamera?: boolean;
  canShareScreen?: boolean;
  onVoiceActiveChange?: (isSpeaking: boolean, volume: number) => void;
  sendWebSocketMessage?: (message: any) => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = React.memo(({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentUserColor,
  roomId = 'CINEMA',
  isMutedByMod = false,
  onVoiceActiveChange,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [expandedPeers, setExpandedPeers] = useState(true);

  const {
    isConnected,
    isConnecting,
    isMuted,
    isDeafened,
    isSpeaking,
    audioLevel,
    participants,
    error,
    selectedAudioDevice,
    availableDevices,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    setPeerVolume,
    switchAudioDevice,
  } = useVoiceChat({
    roomId,
    userId: currentUserId,
    name: currentUserName,
    avatar: currentUserAvatar,
    color: currentUserColor,
    isMutedByMod,
    onSpeakingChange: onVoiceActiveChange,
  });

  // Global hotkey (M for quick Mute toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'm' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        if (isConnected) {
          toggleMute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, toggleMute]);

  const handleConnect = async () => {
    await joinVoice();
  };

  const handleDisconnect = () => {
    leaveVoice();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full relative rounded-3xl p-[1px] bg-gradient-to-b from-emerald-500/30 via-teal-500/20 to-indigo-500/30 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl"
    >
      <div className="w-full bg-zinc-950/90 rounded-[23px] p-4 flex flex-col space-y-4">
        
        {/* Header with Live Status Indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center space-x-2.5">
            <motion.div
              animate={{
                scale: isConnected ? [1, 1.15, 1] : 1,
              }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className={`w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-zinc-600'
              }`}
            />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>WebRTC Mesh Голос</span>
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                {isConnected ? 'Прямое P2P соединение' : 'Не подключен'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {isConnected && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl text-xs transition-all cursor-pointer ${
                  showSettings
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Настройки микрофона"
              >
                <Settings className="w-3.5 h-3.5" />
              </motion.button>
            )}

            {isConnected ? (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Выйти</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>{isConnecting ? 'Подключение...' : 'Подключиться к голосовому чату'}</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Main Controls Panel (when connected) */}
        {isConnected && (
          <div className="flex flex-col space-y-3">
            {/* Action Bar: Mute and Deafen */}
            <div className="grid grid-cols-2 gap-2">
              {/* Mic Toggle Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={toggleMute}
                className={`py-2.5 px-3 rounded-2xl flex items-center justify-center space-x-2 text-xs font-bold transition-all cursor-pointer shadow-md ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : isSpeaking
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400 ring-2 ring-emerald-500/30 shadow-emerald-950/50'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                {isMuted ? (
                  <>
                    <MicOff className="w-4 h-4 text-rose-400" />
                    <span>Mute (Выкл)</span>
                  </>
                ) : (
                  <>
                    <Mic className={`w-4 h-4 ${isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-emerald-400'}`} />
                    <span>{isSpeaking ? 'В эфире' : 'Микрофон (Вкл)'}</span>
                  </>
                )}
              </motion.button>

              {/* Deafen Toggle Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={toggleDeafen}
                className={`py-2.5 px-3 rounded-2xl flex items-center justify-center space-x-2 text-xs font-bold transition-all cursor-pointer shadow-md ${
                  isDeafened
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <Headphones className={`w-4 h-4 ${isDeafened ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>{isDeafened ? 'Звук выкл' : 'Звук вкл'}</span>
              </motion.button>
            </div>

            {/* Speaking Level Bar & Hotkey Hint */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/60 text-[11px]">
              <div className="flex items-center gap-2 flex-1 mr-3">
                <Activity className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${isMuted ? 0 : audioLevel}%` }}
                    transition={{ duration: 0.08 }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  />
                </div>
              </div>
              <span className="text-zinc-500 font-mono text-[10px] shrink-0">
                [M] быстрый мут
              </span>
            </div>

            {/* Audio Settings Dropdown */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-zinc-900/90 rounded-2xl border border-zinc-800 flex flex-col space-y-2 overflow-hidden"
                >
                  <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Mic className="w-3 h-3 text-emerald-400" />
                    <span>Микрофон:</span>
                  </label>
                  <select
                    value={selectedAudioDevice || ''}
                    onChange={(e) => switchAudioDevice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">По умолчанию</option>
                    {availableDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Микрофон ${d.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice Channel Participants List */}
            <div className="flex flex-col space-y-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setExpandedPeers(!expandedPeers)}
                className="flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>В эфире ({participants.length + 1})</span>
                </div>
                {expandedPeers ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {expandedPeers && (
                <div className="flex flex-col space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {/* Current Local User */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                      isSpeaking
                        ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'bg-zinc-900/60 border-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <SpeakingIndicator
                        isSpeaking={isSpeaking}
                        volume={audioLevel}
                        size="sm"
                        mode="ring"
                      >
                        <UserAvatar
                          avatar={currentUserAvatar}
                          name={currentUserName}
                          color={currentUserColor}
                          size="sm"
                          status="online"
                          showStatus
                        />
                      </SpeakingIndicator>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-white">{currentUserName}</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1 rounded">
                            Вы
                          </span>
                          {isSpeaking && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-500/40 animate-pulse">
                              Говорит
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {isMuted ? 'Микрофон отключен' : isSpeaking ? `Голос (${audioLevel}%)` : 'В эфире'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-300' : 'text-emerald-400'}`} />
                      )}
                    </div>
                  </div>

                  {/* Remote Peers in WebRTC Mesh */}
                  {participants.map((peer) => (
                    <motion.div
                      key={peer.userId}
                      layout
                      className={`flex flex-col p-2.5 rounded-2xl border transition-all space-y-2 ${
                        peer.isSpeaking
                          ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-zinc-900/60 border-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <SpeakingIndicator
                            isSpeaking={peer.isSpeaking}
                            size="sm"
                            mode="ring"
                          >
                            <UserAvatar
                              avatar={peer.avatar || '🍿'}
                              name={peer.name}
                              color={peer.color || '#6366f1'}
                              size="sm"
                              status="online"
                              showStatus
                            />
                          </SpeakingIndicator>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-white">{peer.name}</span>
                              {peer.isSpeaking && (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-500/40 animate-pulse">
                                  Говорит
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                              <Signal className="w-3 h-3 text-emerald-400" />
                              <span>P2P WebRTC</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {peer.isMuted ? (
                            <MicOff className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Mic className={`w-3.5 h-3.5 ${peer.isSpeaking ? 'text-emerald-300' : 'text-emerald-400'}`} />
                          )}
                        </div>
                      </div>

                      {/* Peer Volume Slider */}
                      <div className="flex items-center space-x-2 bg-zinc-950/50 px-2 py-1 rounded-xl">
                        <Volume2 className="w-3 h-3 text-zinc-400 shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={peer.volume ?? 100}
                          onChange={(e) => setPeerVolume(peer.userId, parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                        <span className="text-[9px] font-mono text-zinc-400 w-6 text-right">
                          {peer.volume ?? 100}%
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
});

export default VoicePanel;
