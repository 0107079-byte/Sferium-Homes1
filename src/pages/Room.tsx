import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Copy,
  Check,
  Send,
  Sparkles,
  MessageSquare,
  Shield,
  Film,
  Tv,
  Radio,
  Share2,
  Settings,
  AlertTriangle,
  LogOut,
  Ban,
  Crown,
  Eye,
  Sliders,
  Maximize2,
  Lock,
  ArrowLeft,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from 'lucide-react';
import { RoomState, ChatMessage, Member, UserRole, RolePermissions, VideoProvider } from '../types';
import { syncSocket, SocketMessage } from '../ws/socket';
import { extractVideoId, VideoPlatform } from '../utils/extractVideoId';
import { normalizeUrl } from '../utils/normalizeUrl';
import { YouTubePlayer, YouTubePlayerRef } from '../components/YouTubePlayer';
import { VkPlayer, VkPlayerRef } from '../components/VkPlayer';
import { RutubePlayer, RutubePlayerRef } from '../components/RutubePlayer';
import { UniversalPlayer, UniversalPlayerRef } from '../components/UniversalPlayer';
import { Controls } from '../components/Controls';
import { LinkInput } from '../components/LinkInput';
import { VoicePanel } from '../components/VoicePanel';
import { VideoGrid } from '../components/VideoGrid';
import { RoleBadge } from '../components/RoleBadge';
import { UserRoleMenu } from '../components/UserRoleMenu';
import { RoleManager } from '../components/RoleManager';
import { initVideoSync } from '../sync/syncVideoClient';
import { useVideoSync } from '../hooks/useVideoSync';
import { livekitSync } from '../livekit/livekitSync';
import { p2pSync } from '../p2p/p2pSync';
import HamburgerMenu from '../components/HamburgerMenu';
import appLogo from '../assets/images/app_logo_1786022618121.jpg';

interface RoomProps {
  roomId: string;
  initialUser?: {
    userId: string;
    name: string;
    avatar: string;
    color: string;
  };
  onLeaveRoom?: () => void;
}

export const Room: React.FC<RoomProps> = ({
  roomId,
  initialUser,
  onLeaveRoom,
}) => {
  // User state
  const [currentUser] = useState(() => {
    if (initialUser) return initialUser;
    const stored = localStorage.getItem('sferium_user_profile');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    const defaultUser = {
      userId: `user_${Math.random().toString(36).substring(2, 9)}`,
      name: 'Гость ' + Math.floor(100 + Math.random() * 900),
      avatar: ['🍿', '🎬', '🦊', '🐱', '🚀', '⭐', '🔥'][Math.floor(Math.random() * 7)],
      color: ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4'][Math.floor(Math.random() * 6)],
    };
    localStorage.setItem('sferium_user_profile', JSON.stringify(defaultUser));
    return defaultUser;
  });

  // Room & Player state
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [localTime, setLocalTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'voice' | 'members'>('chat');

  // Role Management UI state
  const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
  const [selectedUserForMenu, setSelectedUserForMenu] = useState<Member | null>(null);
  const [kickedModal, setKickedModal] = useState<{ isOpen: boolean; reason: string; isBan: boolean } | null>(null);
  const [roomErrorModal, setRoomErrorModal] = useState<{ isOpen: boolean; message: string; notFound: boolean } | null>(null);
  const [modNotice, setModNotice] = useState<string | null>(null);

  // Auto-test Suite state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isTestingInProgress, setIsTestingInProgress] = useState(false);
  const [testSuiteResults, setTestSuiteResults] = useState<{
    total: number;
    passed: number;
    failed: number;
    results: Array<{ name: string; passed: boolean; message?: string; durationMs: number }>;
  } | null>(null);

  const handleRunAutoTests = async () => {
    setIsTestModalOpen(true);
    setIsTestingInProgress(true);
    try {
      const suiteModule = await import('../tests/autoTestSuite');
      const results = await suiteModule.runAllTests();
      setTestSuiteResults(results);
    } catch (e: any) {
      console.error('Failed to run auto test suite:', e);
    } finally {
      setIsTestingInProgress(false);
    }
  };

  // Player refs
  const ytRef = useRef<YouTubePlayerRef>(null);
  const vkRef = useRef<VkPlayerRef>(null);
  const rutubeRef = useRef<RutubePlayerRef>(null);
  const universalRef = useRef<UniversalPlayerRef>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const videoUrl = roomState?.videoUrl || 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
  const isPlaying = Boolean(roomState?.playing || roomState?.isPlaying);
  const isHost = Boolean(roomState?.hostId === currentUser.userId);

  // Current user's member object & role calculation
  const myMember = roomState?.members?.[currentUser.userId];
  const userRole: UserRole = isHost ? 'host' : myMember?.role || roomState?.defaultRole || 'member';

  // Permission checks
  const canControl = useMemo(() => {
    if (isHost) return true;
    if (userRole === 'moderator') return true;
    if (myMember?.customPermissions?.manageVideo !== undefined) {
      return Boolean(myMember.customPermissions.manageVideo);
    }
    if (userRole === 'viewer') return false;
    return roomState?.anyoneCanControl !== false;
  }, [isHost, userRole, myMember, roomState?.anyoneCanControl]);

  const canShareCamera = useMemo(() => {
    if (isHost) return true;
    if (myMember?.customPermissions?.canShareCamera !== undefined) {
      return Boolean(myMember.customPermissions.canShareCamera);
    }
    if (userRole === 'viewer') return false;
    return true;
  }, [isHost, userRole, myMember]);

  const canShareScreen = useMemo(() => {
    if (isHost) return true;
    if (myMember?.customPermissions?.canShareScreen !== undefined) {
      return Boolean(myMember.customPermissions.canShareScreen);
    }
    if (userRole === 'viewer') return false;
    return true;
  }, [isHost, userRole, myMember]);

  const isMutedByMod = Boolean(myMember?.isMutedByMod);

  // Extract platform
  const parsedVideo = extractVideoId(videoUrl);
  const currentPlatform: VideoPlatform = parsedVideo?.platform || 'youtube';

  // Hook up synchronized playback engine
  const {
    effectiveTime,
    effectivePlaying,
    drift,
    isSynced,
    syncStatus,
    autoSyncStats,
    sendSyncPulse,
    sendSeekCommand,
    sendPlayCommand,
    sendPauseCommand,
    sendStateCommand,
    sendForceSync,
  } = useVideoSync({
    roomId,
    isHost,
    canControl,
    provider: currentPlatform as VideoProvider,
    currentTime: localTime,
    playing: isPlaying,
    onSyncSeek: (t) => {
      setLocalTime(t);
    },
  });

  // Connect WebSocket & handle room events
  useEffect(() => {
    syncSocket.connect({
      roomId,
      userId: currentUser.userId,
      name: currentUser.name,
      avatar: currentUser.avatar,
      color: currentUser.color,
    });

    const unsubSyncState = syncSocket.on('SYNC_STATE', (data: any) => {
      const pos = data.position !== undefined ? data.position : data.time;
      const isPlay = data.playing !== undefined ? data.playing : data.isPlaying;
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          hostTime: pos,
          hostPlaying: isPlay,
          currentTime: pos !== undefined ? pos : prev.currentTime,
          playing: isPlay !== undefined ? isPlay : prev.playing,
        };
      });
      if (typeof pos === 'number') {
        setLocalTime(pos);
      }
    });

    const unsubRoomState = syncSocket.on('room_state', (data: SocketMessage) => {
      if (data.state) {
        setRoomState(data.state);
        if (typeof data.state.currentTime === 'number') {
          setLocalTime(data.state.currentTime);
        }
      }
    });

    const unsubChat = syncSocket.on('chat_broadcast', (data: SocketMessage) => {
      if (data.message) {
        setRoomState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            chatHistory: [...(prev.chatHistory || []), data.message],
          };
        });
      }
    });

    const unsubKick = syncSocket.on('kicked', (data: { reason?: string }) => {
      setKickedModal({
        isOpen: true,
        reason: data.reason || 'Вы были исключены модератором комнаты.',
        isBan: false,
      });
    });

    const unsubBan = syncSocket.on('banned', (data: { reason?: string }) => {
      setKickedModal({
        isOpen: true,
        reason: data.reason || 'Вы были заблокированы в этой комнате.',
        isBan: true,
      });
    });

    const unsubForceMute = syncSocket.on('voice:force_mute', (data: { isMuted: boolean }) => {
      if (data.isMuted) {
        setModNotice('Модератор отключил ваш микрофон.');
        setTimeout(() => setModNotice(null), 4000);
      }
    });

    const unsubError = syncSocket.on('error', (data: any) => {
      if (data.code === 'ROOM_NOT_FOUND' || data.error === 'ROOM_NOT_FOUND') {
        setRoomErrorModal({
          isOpen: true,
          message: data.message || `Комната #${roomId} не найдена в базе данных.`,
          notFound: true,
        });
      }
    });

    return () => {
      unsubSyncState();
      unsubRoomState();
      unsubChat();
      unsubKick();
      unsubBan();
      unsubForceMute();
      unsubError();
      syncSocket.disconnect();
    };
  }, [roomId, currentUser]);

  // Auto-connect to LiveKit room
  useEffect(() => {
    livekitSync.connect({
      roomId,
      userId: currentUser.userId,
      participantName: currentUser.name,
    }).catch(() => {});

    return () => {
      p2pSync.disconnect();
    };
  }, [roomId, currentUser.userId, currentUser.name]);

  // Playback handlers (Single authoritative dispatch via useVideoSync / syncSocket)
  const handlePlay = useCallback(() => {
    if (!canControl) return;
    sendPlayCommand(localTime);
  }, [canControl, localTime, sendPlayCommand]);

  const handlePause = useCallback(() => {
    if (!canControl) return;
    sendPauseCommand(localTime);
  }, [canControl, localTime, sendPauseCommand]);

  const handleSeek = useCallback((time: number) => {
    if (!canControl) return;
    setLocalTime(time);
    sendSeekCommand(time);
  }, [canControl, sendSeekCommand]);

  const handleForceSync = useCallback(() => {
    sendForceSync();
    syncSocket.send({
      type: 'force_sync',
      currentTime: localTime,
    });
  }, [localTime, sendForceSync]);

  const handleToggleControlMode = useCallback(() => {
    if (!isHost && userRole !== 'moderator') return;
    syncSocket.send({ type: 'toggle_control_mode' });
  }, [isHost, userRole]);

  const handleVideoSubmit = useCallback((url: string) => {
    if (!canControl) return;
    const normalized = normalizeUrl(url);
    const parsed = extractVideoId(normalized);
    syncSocket.sendVideoUrl(normalized, parsed?.platform, parsed?.id);
  }, [canControl]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    syncSocket.sendChatMessage(chatInput.trim());
    setChatInput('');
  };

  const handleCopyInvite = () => {
    const cleanId = roomId.toUpperCase();
    const url = `${window.location.origin}/room/${cleanId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Role Handlers
  const handleUpdateRole = (targetUserId: string, role: UserRole, customPermissions?: Partial<RolePermissions>) => {
    syncSocket.sendRoleGrant(targetUserId, role, customPermissions);
  };

  const handleKickMember = (targetUserId: string, reason?: string) => {
    syncSocket.sendKickMember(targetUserId, reason);
  };

  const handleBanMember = (targetUserId: string, reason?: string) => {
    syncSocket.sendBanMember(targetUserId, reason);
  };

  const handleTransferHost = (targetUserId: string) => {
    syncSocket.sendTransferHost(targetUserId);
  };

  const handleToggleModMute = (targetUserId: string, isMuted: boolean) => {
    syncSocket.sendVoiceModMute(targetUserId, isMuted);
  };

  const handleUpdateRoomSettings = (settings: {
    anyoneCanControl?: boolean;
    defaultRole?: UserRole;
    rolePermissionsOverride?: Partial<Record<UserRole, Partial<RolePermissions>>>;
  }) => {
    syncSocket.sendRoomSettingsUpdate(settings);
  };

  const handleUnbanUser = (userId: string) => {
    if (!roomState) return;
    const banned = (roomState.bannedUserIds || []).filter((id) => id !== userId);
    syncSocket.send({
      type: 'room:settings_update',
      bannedUserIds: banned,
    });
  };

  const membersList: Member[] = useMemo(() => {
    if (!roomState?.members) return [];
    return Object.values(roomState.members).sort((a, b) => {
      if (a.userId === roomState.hostId) return -1;
      if (b.userId === roomState.hostId) return 1;
      if (a.role === 'moderator' && b.role !== 'moderator') return -1;
      if (b.role === 'moderator' && a.role !== 'moderator') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [roomState?.members, roomState?.hostId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#07050d] text-zinc-100 flex flex-col font-sans selection:bg-purple-500/30 overflow-x-hidden relative"
    >
      {/* Dynamic Background Neon Radial Aura */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-[700px] h-[300px] bg-pink-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Global Hamburger Navigation Drawer */}
      <HamburgerMenu
        roomId={roomId}
        isHost={isHost}
        members={roomState?.members || {}}
        currentUserId={currentUser.userId}
        currentUser={{
          userId: currentUser.userId,
          name: currentUser.name,
          avatar: currentUser.avatar,
          color: currentUser.color,
          status: 'online',
          isGuest: true,
          micSettings: {
            inputVolume: 100,
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
          cameraSettings: {
            quality: '720p',
            mirror: true,
            frameRate: 30,
          },
        }}
        anyoneCanControl={roomState?.anyoneCanControl !== false}
        currentTime={localTime}
        videoTitle={roomState?.name || 'Sferium Room'}
        videoUrl={videoUrl}
        onCloseRoom={() => {
          syncSocket.closeRoom();
          if (onLeaveRoom) onLeaveRoom();
        }}
        onKickUser={handleKickMember}
        onMuteUser={handleToggleModMute}
        onStartBroadcast={(opts) => syncSocket.startBroadcast(opts)}
        onTransferHost={handleTransferHost}
        onToggleControl={handleToggleControlMode}
        onExitRoom={onLeaveRoom}
      />

      {/* Moderation Notice Toast */}
      <AnimatePresence>
        {modNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border border-rose-500/60 text-rose-200 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold backdrop-blur-xl"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
            <span>{modNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kicked / Banned Modal */}
      <AnimatePresence>
        {kickedModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl relative z-10"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-lg">
                <Ban className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {kickedModal.isBan ? 'Вы заблокированы' : 'Вы были исключены'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">{kickedModal.reason}</p>
              </div>
              <button
                onClick={() => {
                  if (onLeaveRoom) {
                    onLeaveRoom();
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg"
              >
                Вернуться в лобби
              </button>
            </motion.div>
          </div>
        )}

        {/* Room Not Found / Join Error Modal */}
        {roomErrorModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl relative z-10"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">Комната не найдена (404)</h3>
                <p className="text-xs text-zinc-400">{roomErrorModal.message}</p>
              </div>
              <button
                onClick={() => {
                  if (onLeaveRoom) {
                    onLeaveRoom();
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg"
              >
                Вернуться в лобби
              </button>
            </motion.div>
          </div>
        )}

        {/* Auto-Test Suite Modal Overlay */}
        {isTestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTestModalOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-indigo-500/30 rounded-3xl p-6 max-w-xl w-full text-left space-y-4 shadow-2xl relative z-10 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Auto Test Runner</h3>
                    <p className="text-xs text-zinc-400">Автономное mock-тестирование синхронизации Watch Party</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTestModalOpen(false)}
                  className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 custom-scrollbar">
                {isTestingInProgress ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-sm font-semibold text-zinc-300">Выполняются автотесты...</p>
                    <p className="text-xs text-zinc-500">Тестирование YouTube, VK, HTML5, LiveKit, PeerJS, Guarding...</p>
                  </div>
                ) : testSuiteResults ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-zinc-300">Всего тестов: {testSuiteResults.total}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {testSuiteResults.passed} PASS
                        </span>
                        {testSuiteResults.failed > 0 && (
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> {testSuiteResults.failed} FAIL
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {testSuiteResults.results.map((r, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border flex flex-col gap-1 text-xs ${
                            r.passed
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold flex items-center gap-2">
                              {r.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                              {r.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {r.durationMs.toFixed(1)} ms
                            </span>
                          </div>
                          {!r.passed && r.message && (
                            <p className="text-[11px] text-rose-400/90 pl-6">{r.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 text-center py-6">Нажмите «Запустить тесты» для старта проверки.</p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
                <button
                  disabled={isTestingInProgress}
                  onClick={handleRunAutoTests}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{isTestingInProgress ? 'Тестирование...' : 'Запустить снова'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Glassmorphic Navigation Bar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-850 px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {onLeaveRoom && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onLeaveRoom}
                className="p-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-2xl transition-colors cursor-pointer shadow-sm"
                title="Назад в лобби"
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
            )}

            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-fuchsia-500 p-0.5 shadow-lg shadow-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
              <img src={appLogo} alt="Sferium" className="w-full h-full object-cover rounded-[14px]" referrerPolicy="no-referrer" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-black text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  <span>{roomState?.name || 'Кинозал Sferium'}</span>
                </h1>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  #{roomId}
                </span>
                <RoleBadge role={userRole} size="xs" />
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                YouTube • VK Video • Rutube • Синхронный просмотр
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              style={{
                marginLeft: 'auto',
                background: '#ff4d4d',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(255, 77, 77, 0.4)'
              }}
              onClick={() => {
                handleRunAutoTests();
                import('../tests/autoTestSuite').then(m => m.runAllTests());
              }}
            >
              Run Auto Tests
            </button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsRoleManagerOpen(true)}
              className="px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-850 border border-indigo-500/30 text-indigo-300 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-md"
              title="Управление ролями"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Роли и Права</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleCopyInvite}
              className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-lg shadow-purple-950/40"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Скопировано!' : 'Пригласить'}</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Room Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        
        {/* Left Column: Video Stage, Sync Controls, Link Input */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Real-time Video Sync Engine Info Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border border-zinc-800/70 rounded-2xl text-xs backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSynced ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isSynced ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
              </span>
              <span className="font-semibold text-zinc-200">
                {isSynced ? 'Sync Active' : 'Синхронизация...'}
              </span>
              <span className="text-[10px] text-zinc-500 border-l border-zinc-800 pl-2">
                Дрейф: {drift.toFixed(2)}s
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-500/30 text-purple-300">
                {currentPlatform}
              </span>
            </div>

            <button
              onClick={handleForceSync}
              title="Принудительная точная синхронизация"
              className="text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-zinc-800 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Синхронизировать</span>
            </button>
          </div>

          <VideoGrid layoutMode="cinematic">
            {currentPlatform === 'youtube' && (
              <YouTubePlayer
                ref={ytRef}
                videoId={parsedVideo?.id || 'jfKfPfyJRdk'}
                isPlaying={isPlaying}
                targetTime={roomState?.currentTime}
                onTimeUpdate={(t: number, d: number) => {
                  setLocalTime(t);
                  if (d > 0) setDuration(d);
                }}
              />
            )}

            {currentPlatform === 'vk' && (
              <VkPlayer
                ref={vkRef}
                videoUrl={videoUrl}
                videoId={parsedVideo?.id}
                isPlaying={isPlaying}
                targetTime={roomState?.currentTime}
                onTimeUpdate={(t: number, d: number) => {
                  setLocalTime(t);
                  if (d > 0) setDuration(d);
                }}
              />
            )}

            {currentPlatform === 'rutube' && (
              <RutubePlayer
                ref={rutubeRef}
                videoUrl={videoUrl}
                videoId={parsedVideo?.id}
                isPlaying={isPlaying}
                targetTime={roomState?.currentTime}
                onTimeUpdate={(t: number, d: number) => {
                  setLocalTime(t);
                  if (d > 0) setDuration(d);
                }}
              />
            )}

            {(currentPlatform === 'direct' || currentPlatform === 'unknown') && (
              <UniversalPlayer
                ref={universalRef}
                videoUrl={videoUrl}
                provider={currentPlatform === 'direct' ? 'direct' : 'unknown'}
                playing={isPlaying}
                currentTime={roomState?.currentTime ?? localTime}
                isHost={isHost}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onTimeUpdate={(t: number) => {
                  setLocalTime(t);
                }}
                onDurationChange={(d: number) => {
                  if (d > 0) setDuration(d);
                }}
              />
            )}
          </VideoGrid>

          {/* Sync Controls Panel */}
          <Controls
            roomState={roomState}
            currentTime={localTime}
            duration={duration}
            isPlaying={isPlaying}
            canControl={canControl}
            anyoneCanControl={roomState?.anyoneCanControl !== false}
            isHost={isHost}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onForceSync={handleForceSync}
            onToggleControlMode={handleToggleControlMode}
          />

          {/* Video URL Link Input */}
          <LinkInput
            currentUrl={videoUrl}
            onUrlSubmit={handleVideoSubmit}
            disabled={!canControl}
          />
        </div>

        {/* Right Column: Chat, Voice studio & Members */}
        <motion.div
          layout
          className="lg:col-span-4 flex flex-col bg-zinc-950/90 border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-950/30 h-[580px] lg:h-[780px] backdrop-blur-xl"
        >
          {/* Animated Tab Bar */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/60 p-2 gap-1.5 relative">
            {[
              { id: 'chat', label: 'Чат', icon: MessageSquare },
              { id: 'voice', label: 'Голос', icon: Radio },
              { id: 'members', label: `Люди (${membersList.length})`, icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 px-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer relative z-10 ${
                    isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeRoomTab"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-md"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-20" />
                  <span className="relative z-20">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panes */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'voice' ? (
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
                <VoicePanel
                  currentUserId={currentUser.userId}
                  currentUserName={currentUser.name}
                  currentUserAvatar={currentUser.avatar}
                  currentUserColor={currentUser.color}
                  roomId={roomId}
                  isMutedByMod={isMutedByMod}
                  canShareCamera={canShareCamera}
                  canShareScreen={canShareScreen}
                />
              </div>
            ) : activeTab === 'chat' ? (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                {/* Messages List with Staggered Fade */}
                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
                  {roomState?.chatHistory?.map((msg) => {
                    const senderMember = msg.userId ? roomState?.members?.[msg.userId] : undefined;
                    const senderRole: UserRole = msg.userId === roomState?.hostId ? 'host' : senderMember?.role || 'member';

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs"
                      >
                        {msg.type === 'system' ? (
                          <div className="p-2.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-center text-[11px] my-1 shadow-inner">
                            {msg.text}
                          </div>
                        ) : (
                          <div className="flex items-start space-x-2.5">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              onClick={() => senderMember && setSelectedUserForMenu(senderMember)}
                              className="w-8 h-8 rounded-2xl flex items-center justify-center text-sm shrink-0 font-bold border shadow-md cursor-pointer"
                              style={{ backgroundColor: `${msg.color || '#a855f7'}25`, borderColor: `${msg.color || '#a855f7'}50` }}
                              title="Меню участника"
                            >
                              {msg.avatar || '🍿'}
                            </motion.button>
                            <div className="flex-1 bg-zinc-900/90 rounded-2xl p-3 border border-zinc-800/80 shadow-md">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => senderMember && setSelectedUserForMenu(senderMember)}
                                    className="font-black text-xs hover:underline cursor-pointer"
                                    style={{ color: msg.color || '#a855f7' }}
                                  >
                                    {msg.name || 'Гость'}
                                  </button>
                                  <RoleBadge role={senderRole} size="xs" />
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-zinc-100 font-medium break-words leading-relaxed">{msg.text}</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Написать в чат кинозала..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 shadow-inner font-medium"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-2xl transition-all cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </motion.button>
                </form>
              </div>
            ) : (
              /* Members Tab */
              <div className="flex-1 p-3.5 overflow-y-auto space-y-2 custom-scrollbar">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Участники ({membersList.length})
                  </span>
                  <button
                    onClick={() => setIsRoleManagerOpen(true)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Управление</span>
                  </button>
                </div>

                {membersList.map((member) => {
                  const isMe = member.userId === currentUser.userId;
                  const role: UserRole = member.userId === roomState?.hostId ? 'host' : member.role || roomState?.defaultRole || 'member';

                  return (
                    <motion.div
                      key={member.userId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedUserForMenu(member)}
                      className="p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 flex items-center justify-between cursor-pointer transition-all shadow-sm"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center text-base font-bold border shrink-0 shadow-md"
                          style={{ backgroundColor: `${member.color || '#a855f7'}25`, borderColor: `${member.color || '#a855f7'}50` }}
                        >
                          {member.avatar || '🍿'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-black text-white truncate">{member.name}</span>
                            {isMe && <span className="text-[10px] text-zinc-500 font-bold">(Вы)</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                            <span>{member.userId.substring(0, 8)}</span>
                            {member.isMutedByMod && (
                              <span className="text-rose-400 font-sans font-bold">• Заглушен</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <RoleBadge role={role} size="xs" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Role Manager Modal */}
      {roomState && (
        <RoleManager
          room={roomState}
          currentUserId={currentUser.userId}
          isOpen={isRoleManagerOpen}
          onClose={() => setIsRoleManagerOpen(false)}
          onUpdateRole={handleUpdateRole}
          onKickMember={handleKickMember}
          onBanMember={handleBanMember}
          onTransferHost={handleTransferHost}
          onToggleModMute={handleToggleModMute}
          onUpdateRoomSettings={handleUpdateRoomSettings}
          onUnbanUser={handleUnbanUser}
        />
      )}

      {/* Context Member Action Menu */}
      {selectedUserForMenu && roomState && (
        <UserRoleMenu
          targetMember={selectedUserForMenu}
          currentUserId={currentUser.userId}
          room={roomState}
          onClose={() => setSelectedUserForMenu(null)}
          onUpdateRole={handleUpdateRole}
          onKickMember={handleKickMember}
          onBanMember={handleBanMember}
          onTransferHost={handleTransferHost}
          onToggleModMute={handleToggleModMute}
        />
      )}
    </motion.div>
  );
};

export default Room;
