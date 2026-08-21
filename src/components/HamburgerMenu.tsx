import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Users,
  User,
  Settings,
  Crown,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Radio,
  Sparkles,
  ChevronRight,
  LogOut,
  Trash2,
  Share2,
  Shield,
  Edit3
} from 'lucide-react';
import { Member, AppUser, UserProfile as UserProfileType } from '../types';
import { userManager } from '../modules/user';
import UserProfile from './UserProfile';
import UserSettings from './UserSettings';
import ParticipantList from './ParticipantList';
import HostPanel from './HostPanel';
import AIPanel from './AIPanel';
import { Polls } from './Polls';
import { notificationManager, AppNotification, UnreadCounters } from '../utils/notifications';
import { soundManager } from '../utils/soundNotifications';
import { vibrationManager } from '../utils/vibration';
import { pushManager } from '../utils/pushNotifications';
import { Poll } from '../types';
import { 
  BarChart3, 
  Film, 
  Radio as StreamerRadio, 
  MessageSquare as ChatIcon 
} from 'lucide-react';

export type MenuSection = 
  | 'participants' 
  | 'chat'
  | 'profile' 
  | 'settings' 
  | 'host' 
  | 'notifications' 
  | 'ai' 
  | 'polls' 
  | 'cinema' 
  | 'streamer' 
  | null;

export interface HamburgerMenuProps {
  roomId?: string;
  isHost: boolean;
  members: Record<string, Member> | Member[];
  currentUserId: string;
  currentUser: AppUser;
  anyoneCanControl?: boolean;
  currentTime?: number;
  videoTitle?: string;
  videoUrl?: string;
  polls?: Poll[];
  onCreatePoll?: (question: string, options: string[], duration?: number) => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
  onClosePoll?: (pollId: string) => void;
  onToggleCinemaMode?: () => void;
  onToggleStreamerMode?: () => void;
  onToggleChat?: () => void;
  onCloseRoom?: () => void;
  onKickUser?: (userId: string, reason?: string) => void;
  onMuteUser?: (userId: string, isMuted: boolean) => void;
  onStartBroadcast?: (options: { mic?: boolean; videoUrl?: string; playing?: boolean }) => void;
  onTransferHost?: (userId: string) => void;
  onToggleControl?: () => void;
  onExitRoom?: () => void;
  onSaveProfile?: (profile: Partial<UserProfileType>) => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  onOpenAuthModal?: () => void;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  roomId,
  isHost,
  members,
  currentUserId,
  currentUser,
  anyoneCanControl,
  currentTime,
  videoTitle,
  videoUrl,
  polls = [],
  onCreatePoll,
  onVotePoll,
  onClosePoll,
  onToggleCinemaMode,
  onToggleStreamerMode,
  onToggleChat,
  onCloseRoom,
  onKickUser,
  onMuteUser,
  onStartBroadcast,
  onTransferHost,
  onToggleControl,
  onExitRoom,
  onSaveProfile,
  onLogout,
  onDeleteAccount,
  onOpenAuthModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<MenuSection>(null);
  const [counters, setCounters] = useState<UnreadCounters>(notificationManager.getCounters());
  const [notifications, setNotifications] = useState<AppNotification[]>(notificationManager.getNotifications());
  const [soundMuted, setSoundMuted] = useState(soundManager.getIsMuted());
  const [vibrateOn, setVibrateOn] = useState(vibrationManager.getIsEnabled());
  const [pushStatus, setPushStatus] = useState(pushManager.getPermissionStatus());

  useEffect(() => {
    const unsub = notificationManager.subscribe((notifs, counts) => {
      setNotifications(notifs);
      setCounters(counts);
    });
    return unsub;
  }, []);

  const totalUnread =
    counters.participants +
    counters.profile +
    counters.settings +
    (isHost ? counters.hostPanel : 0) +
    counters.chat;

  const handleSelectSection = (section: MenuSection) => {
    if (section === 'cinema') {
      setIsOpen(false);
      onToggleCinemaMode?.();
      return;
    }
    if (section === 'streamer') {
      setIsOpen(false);
      onToggleStreamerMode?.();
      return;
    }
    if (section === 'chat') {
      setIsOpen(false);
      onToggleChat?.();
      return;
    }

    setActiveSection(section);
    if (section === 'participants') notificationManager.resetCounter('participants');
    if (section === 'profile') notificationManager.resetCounter('profile');
    if (section === 'settings') notificationManager.resetCounter('settings');
    if (section === 'host') notificationManager.resetCounter('hostPanel');
    if (section === 'notifications') notificationManager.resetCounter('chat');
  };

  const handleToggleSound = () => {
    const nextMute = !soundMuted;
    soundManager.setMuted(nextMute);
    setSoundMuted(nextMute);
  };

  const handleToggleVibration = () => {
    const nextVibe = !vibrateOn;
    vibrationManager.setEnabled(nextVibe);
    setVibrateOn(nextVibe);
  };

  const handleEnablePush = async () => {
    const granted = await pushManager.requestPermission();
    setPushStatus(pushManager.getPermissionStatus());
    if (granted) {
      pushManager.sendNotification({
        title: 'Sferium Sync',
        body: 'Push-уведомления успешно активированы!',
      });
    }
  };

  const memberList: Member[] = Array.isArray(members)
    ? members
    : Object.values(members || {});

  return (
    <>
      {/* 1. Hamburger Icon Button (Top-Left, Accessible on all screens) */}
      <div className="fixed top-3 left-3 z-40 flex items-center gap-2">
        <button
          type="button"
          id="btn-hamburger-menu"
          onClick={() => {
            setIsOpen(true);
            if (!activeSection) {
              setActiveSection(null);
            }
          }}
          className="relative group flex items-center justify-center w-11 h-11 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 shadow-2xl backdrop-blur-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          title="Открыть главное меню навигации"
        >
          {/* Animated 3 Horizontal Bars */}
          <div className="flex flex-col items-center justify-center gap-1.5 w-5 h-5">
            <span className="w-5 h-0.5 bg-zinc-200 group-hover:bg-white rounded-full transition-all duration-300" />
            <span className="w-4 h-0.5 bg-indigo-400 group-hover:w-5 group-hover:bg-indigo-300 rounded-full transition-all duration-300" />
            <span className="w-5 h-0.5 bg-zinc-200 group-hover:bg-white rounded-full transition-all duration-300" />
          </div>

          {/* Badge for unread events */}
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-rose-500 text-white font-black text-[10px] ring-2 ring-zinc-950 animate-bounce">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* 2. Slide-out Drawer Overlay & Panel */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex overflow-hidden">
            {/* Backdrop Blur Dimmer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            />

            {/* Sidebar Navigation Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full sm:w-[420px] md:w-[480px] h-full bg-zinc-950 border-r border-zinc-800/80 shadow-2xl flex flex-col z-50 overflow-hidden select-none"
            >
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-zinc-850/80 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-md flex items-center justify-center">
                    <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-sm font-black text-white">
                      🍿
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                      <span>Sferium Homes</span>
                      {roomId && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                          #{roomId}
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                      {currentUser.name} ({isHost ? 'Хост' : 'Гость'})
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-1">
                  {/* Sound quick toggle */}
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      soundMuted
                        ? 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                    title={soundMuted ? 'Включить звук' : 'Выключить звук'}
                  >
                    {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {/* Close drawer button */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all cursor-pointer"
                    title="Закрыть меню"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Subheader / Active Section Bar */}
              {activeSection && (
                <div className="px-4 py-2 bg-indigo-950/30 border-b border-indigo-500/20 flex items-center justify-between text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveSection(null)}
                    className="text-indigo-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    ← Главное меню
                  </button>
                  <span className="text-zinc-400 font-mono text-[11px]">
                    {activeSection === 'participants' && 'Участники'}
                    {activeSection === 'profile' && 'Профиль'}
                    {activeSection === 'settings' && 'Настройки'}
                    {activeSection === 'host' && '👑 Хост-панель'}
                    {activeSection === 'notifications' && 'Уведомления'}
                    {activeSection === 'ai' && '✨ ИИ-Ассистент'}
                  </span>
                </div>
              )}

              {/* Content Area: Main Menu or Sub-view */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
                {!activeSection ? (
                  /* ================= MASTER MENU LIST ================= */
                  <div className="p-4 space-y-3">
                    {/* SECTION 1: PARTICIPANTS */}
                    {roomId && (
                      <button
                        type="button"
                        id="menu-item-participants"
                        onClick={() => handleSelectSection('participants')}
                        className="w-full group p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850/90 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white group-hover:text-indigo-200">
                                Участники комнаты
                              </span>
                              <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono text-zinc-300">
                                {memberList.length}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Список зрителей, статус микрофона и управление
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {counters.participants > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px] animate-pulse">
                              +{counters.participants}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    )}

                    {/* SECTION 1.5: CHAT */}
                    {roomId && (
                      <button
                        type="button"
                        id="menu-item-chat"
                        onClick={() => handleSelectSection('chat')}
                        className="w-full group p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850/90 border border-zinc-800 hover:border-sky-500/50 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                            <ChatIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white group-hover:text-sky-200">
                                Чат комнаты
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Общение, реакции, статус набора и модерация
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {counters.chat > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px] animate-pulse">
                              +{counters.chat}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    )}

                    {/* SECTION 2: USER PROFILE */}
                    <button
                      type="button"
                      id="menu-item-profile"
                      onClick={() => handleSelectSection('profile')}
                      className="w-full group p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850/90 border border-zinc-800 hover:border-purple-500/50 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white group-hover:text-purple-200">
                              Личный кабинет
                            </span>
                            {currentUser.isGuest ? (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                                Гость
                              </span>
                            ) : (
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono">
                                {currentUser.authProvider?.toUpperCase() || 'VK ID'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Профиль, аватар, привязка VK ID и статус
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {counters.profile > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                            +{counters.profile}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>

                    {/* SECTION 3: USER SETTINGS */}
                    <button
                      type="button"
                      id="menu-item-settings"
                      onClick={() => handleSelectSection('settings')}
                      className="w-full group p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850/90 border border-zinc-800 hover:border-cyan-500/50 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                          <Settings className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-200">
                              Настройки личного кабинета
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Микрофон, цвет, звуки и Web Push
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {counters.settings > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                            +{counters.settings}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>

                    {/* SECTION 4: HOST CONTROL PANEL (Exclusively visible & highlighted for Host) */}
                    {isHost && (
                      <button
                        type="button"
                        id="menu-item-host-panel"
                        onClick={() => handleSelectSection('host')}
                        className="w-full group p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900/80 to-amber-950/30 hover:from-amber-950/60 hover:to-amber-900/40 border border-amber-500/50 hover:border-amber-400 shadow-lg shadow-amber-950/30 transition-all duration-200 flex items-center justify-between text-left cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform">
                            <Crown className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1">
                                Панель управления создателя 👑
                              </span>
                            </div>
                            <p className="text-[11px] text-amber-200/70 mt-0.5">
                              Эфир без микр., мут гостей, кик и закрытие комнаты
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {counters.hostPanel > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-black text-[10px] animate-pulse">
                              +{counters.hostPanel}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    )}

                    {/* SECTION 5: AI-ASSISTANT */}
                    <button
                      type="button"
                      id="menu-item-ai"
                      onClick={() => handleSelectSection('ai')}
                      className="w-full group p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-purple-950/50 to-pink-950/40 hover:from-indigo-900/60 hover:to-purple-900/60 border border-indigo-500/40 hover:border-purple-400 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-md"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 p-0.5 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
                          <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center text-purple-300">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-white group-hover:text-purple-200 flex items-center gap-1">
                              ИИ-Ассистент
                            </span>
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                              Gemini
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Анализ сцены, перевод, модерация чата и гид
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>

                    {/* SECTION 5.5: POLLS & VOTING */}
                    {roomId && (
                      <button
                        type="button"
                        id="menu-item-polls"
                        onClick={() => handleSelectSection('polls')}
                        className="w-full group p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850/90 border border-zinc-800 hover:border-indigo-500/50 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white group-hover:text-indigo-200">
                                Голосования и Опросы
                              </span>
                              {polls.filter((p) => !p.isClosed).length > 0 && (
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                  {polls.filter((p) => !p.isClosed).length} акт.
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Совместный выбор фильмов, пауз и сцен
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    )}

                    {/* SECTION 5.6: CINEMA & STREAMER MODES */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        id="menu-item-cinema-mode"
                        onClick={() => handleSelectSection('cinema')}
                        className="p-3 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/40 text-left transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Film className="w-5 h-5 text-purple-400" />
                          <span className="text-[9px] bg-purple-950/60 text-purple-300 px-1.5 py-0.5 rounded font-mono">1-клик</span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">Кинотеатр</span>
                          <span className="text-[10px] text-zinc-400">На весь экран без панелей</span>
                        </div>
                      </button>

                      {isHost && (
                        <button
                          type="button"
                          id="menu-item-streamer-mode"
                          onClick={() => handleSelectSection('streamer')}
                          className="p-3 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 text-left transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <StreamerRadio className="w-5 h-5 text-amber-400" />
                            <span className="text-[9px] bg-amber-950/60 text-amber-300 px-1.5 py-0.5 rounded font-mono">Host</span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">Стример</span>
                            <span className="text-[10px] text-zinc-400">HUD чат и ИИ-копилот</span>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* SECTION 6: NOTIFICATION HISTORY */}
                    <button
                      type="button"
                      id="menu-item-notifications"
                      onClick={() => handleSelectSection('notifications')}
                      className="w-full group p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850/90 border border-zinc-800 hover:border-emerald-500/50 transition-all duration-200 flex items-center justify-between text-left cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white group-hover:text-emerald-200">
                              Центр уведомлений
                            </span>
                            <span className="text-[10px] bg-zinc-800 px-1.5 py-0.2 rounded font-mono text-zinc-300">
                              {notifications.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            История сообщений, входов, действий хоста
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {totalUnread > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                            {totalUnread}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>

                    {/* Quick Quick Settings Row */}
                    <div className="pt-2 border-t border-zinc-850/80">
                      <div className="p-3 bg-zinc-900/40 rounded-2xl border border-zinc-850 flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs text-zinc-300">
                          <Smartphone className="w-4 h-4 text-purple-400" />
                          <span>Вибрация</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={vibrateOn}
                          onChange={handleToggleVibration}
                          className="rounded accent-purple-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ================= SUB-PANEL VIEWS ================= */
                  <div className="flex-1 flex flex-col h-full overflow-hidden p-3">
                    {/* View: Participants */}
                    {activeSection === 'participants' && roomId && (
                      <ParticipantList
                        members={members}
                        currentUserId={currentUserId}
                        isHost={isHost}
                        onKickUser={onKickUser}
                        onMuteUser={onMuteUser}
                        onTransferHost={onTransferHost}
                      />
                    )}

                    {/* View: User Profile */}
                    {activeSection === 'profile' && (
                      <div className="space-y-4">
                        <UserProfile
                          user={currentUser}
                          onLogout={onLogout}
                          onDeleteAccount={onDeleteAccount}
                          onEditClick={() => handleSelectSection('settings')}
                        />
                        {currentUser.isGuest && onOpenAuthModal && (
                          <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl space-y-2">
                            <span className="text-xs font-bold text-white block">
                              Хотите сохранить профиль навсегда?
                            </span>
                            <p className="text-[11px] text-zinc-300">
                              Войдите через VK ID или соцсети в один клик.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                onOpenAuthModal();
                              }}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              Войти через VK ID
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* View: User Settings */}
                    {activeSection === 'settings' && (
                      <UserSettings
                        onSaved={() => {
                          if (onSaveProfile) {
                            onSaveProfile(userManager.getUser());
                          }
                        }}
                        onClose={() => setActiveSection(null)}
                      />
                    )}

                    {/* View: Host Panel */}
                    {activeSection === 'host' && isHost && roomId && (
                      <HostPanel
                        roomId={roomId}
                        isHost={isHost}
                        members={members}
                        currentUserId={currentUserId}
                        anyoneCanControl={anyoneCanControl}
                        onCloseRoom={() => {
                          setIsOpen(false);
                          if (onCloseRoom) onCloseRoom();
                        }}
                        onKickUser={(uid, r) => {
                          if (onKickUser) onKickUser(uid, r);
                        }}
                        onMuteUser={(uid, m) => {
                          if (onMuteUser) onMuteUser(uid, m);
                        }}
                        onStartBroadcast={(opts) => {
                          if (onStartBroadcast) onStartBroadcast(opts);
                        }}
                        onTransferHost={(uid) => {
                          if (onTransferHost) onTransferHost(uid);
                        }}
                        onToggleControl={onToggleControl}
                      />
                    )}

                    {/* View: Notifications Feed */}
                    {activeSection === 'notifications' && (
                      <div className="flex flex-col h-full bg-zinc-950 rounded-2xl border border-zinc-800 p-3 overflow-hidden">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-850">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <Bell className="w-4 h-4 text-emerald-400" />
                            Журнал событий
                          </h3>
                          {notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={() => notificationManager.clearAll()}
                              className="text-[10px] text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              Очистить
                            </button>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="text-center py-12 text-xs text-zinc-500">
                              Уведомлений пока нет
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className="p-2.5 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-zinc-200">
                                    {n.title}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {new Date(n.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                  {n.message}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* View: AI Assistant Panel */}
                    {activeSection === 'ai' && (
                      <div className="flex-1 flex flex-col h-full overflow-hidden rounded-2xl border border-zinc-800">
                        <AIPanel
                          roomId={roomId}
                          isHost={isHost}
                          members={members}
                          currentUserId={currentUserId}
                          currentTime={currentTime}
                          videoTitle={videoTitle}
                          videoUrl={videoUrl}
                          onMuteUser={onMuteUser}
                          onKickUser={onKickUser}
                          onTransferHost={onTransferHost}
                          onClose={() => setActiveSection(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 border-t border-zinc-850/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
                {roomId && onExitRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onExitRoom();
                    }}
                    className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300 border border-zinc-700/60 hover:border-rose-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Покинуть комнату</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HamburgerMenu;
