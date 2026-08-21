import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Radio,
  Tv,
  Users,
  Compass,
  ArrowRight,
  Shield,
  KeyRound,
  X,
  Check,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  Volume2,
  Film,
  Lock,
  Play
} from 'lucide-react';
import { RoomSummary, CreateRoomPayload } from '../types';
import RoomList from './RoomList';
import CreateRoomModal from './CreateRoomModal';
import { verifyRoomPasswordApi } from '../services/rooms';
import UserAvatar from './UserAvatar';
import appLogo from '../assets/images/app_logo_1786022618121.jpg';

interface LobbyProps {
  rooms: RoomSummary[];
  recentRooms: string[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  currentUserColor: string;
  isGuest?: boolean;
  authProvider?: string;
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (payload: CreateRoomPayload) => Promise<void> | void;
  onDeleteRoom: (roomId: string) => void;
  onClearRecentRooms: () => void;
  onChangeProfile: (name: string, avatar: string, color: string) => void;
  onOpenProfileModal?: () => void;
  isLoading?: boolean;
  onRefreshRooms?: () => void;
}

const AVATAR_PRESETS = ['🍿', '🐱', '🦊', '🐼', '🚀', '🎧', '⚡', '🎮', '🦄', '🔥', '👑', '😎'];

export const Lobby: React.FC<LobbyProps> = ({
  rooms,
  recentRooms,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentUserColor,
  isGuest = true,
  authProvider = 'guest',
  onJoinRoom,
  onCreateRoom,
  onDeleteRoom,
  onClearRecentRooms,
  onChangeProfile,
  onOpenProfileModal,
  isLoading = false,
  onRefreshRooms,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [quickRoomCode, setQuickRoomCode] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(currentUserName);
  const [editAvatar, setEditAvatar] = useState(currentUserAvatar);

  // Password verification modal state
  const [passwordModalRoomId, setPasswordModalRoomId] = useState<string | null>(null);
  const [passwordAttempt, setPasswordAttempt] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Calculate live global stats
  const totalViewers = rooms.reduce((acc, r) => acc + (r.membersCount || 0), 0);
  const liveRoomsCount = rooms.filter((r) => r.playing).length;

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickRoomCode.trim();
    if (!clean) return;

    // Handle invite link or slug
    let targetId = clean;
    if (clean.includes('/room/')) {
      const parts = clean.split('/room/');
      targetId = parts[1]?.split('?')[0] || clean;
    } else if (clean.includes('roomId=')) {
      const url = new URL(clean, window.location.origin);
      targetId = url.searchParams.get('roomId') || clean;
    }

    targetId = targetId.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (targetId) {
      const targetRoom = rooms.find((r) => r.roomId === targetId);
      if (targetRoom?.hasPassword) {
        setPasswordModalRoomId(targetId);
      } else {
        onJoinRoom(targetId);
      }
    }
  };

  const handleRoomCardClick = (roomId: string, requiresPassword?: boolean) => {
    if (requiresPassword) {
      setPasswordModalRoomId(roomId);
      setPasswordAttempt('');
      setPasswordError('');
    } else {
      onJoinRoom(roomId);
    }
  };

  const handleVerifyAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalRoomId) return;

    setIsVerifyingPassword(true);
    setPasswordError('');

    try {
      const isCorrect = await verifyRoomPasswordApi(passwordModalRoomId, passwordAttempt);
      if (isCorrect) {
        const roomId = passwordModalRoomId;
        setPasswordModalRoomId(null);
        setPasswordAttempt('');
        onJoinRoom(roomId);
      } else {
        setPasswordError('Неверный пароль для входа в этот зал');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Ошибка проверки пароля');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      onChangeProfile(editName.trim(), editAvatar, currentUserColor);
      setIsProfileModalOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#07050d] text-zinc-100 flex flex-col selection:bg-indigo-500/30 relative overflow-x-hidden"
    >
      {/* Dynamic Background Neon Aura */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-[700px] h-[300px] bg-pink-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Top Navbar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl pl-16 pr-4 lg:pl-18 lg:pr-8 py-3.5"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-fuchsia-500 p-0.5 shadow-lg shadow-purple-500/25 flex items-center justify-center overflow-hidden shrink-0"
            >
              <img src={appLogo} alt="Sferium Logo" className="w-full h-full object-cover rounded-[14px]" referrerPolicy="no-referrer" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wider text-white uppercase font-mono">
                  Sferium Homes
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full tracking-wider shadow-sm">
                  Watch Together
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Синхронный просмотр • WebRTC Mesh • Discord Роли
              </p>
            </div>
          </div>

          {/* Right Header: Profile, Refresh, Create Button */}
          <div className="flex items-center gap-2.5">
            <button
              style={{
                background: '#ff4d4d',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(255, 77, 77, 0.4)'
              }}
              onClick={() => import('../tests/autoTestSuite').then(m => m.runAllTests())}
            >
              Run Auto Tests
            </button>
            {onRefreshRooms && (
              <motion.button
                whileHover={{ scale: 1.05, rotate: 45 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onRefreshRooms}
                title="Обновить список комнат"
                className="p-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            )}

            {/* Profile Picker Pill */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => {
                if (onOpenProfileModal) {
                  onOpenProfileModal();
                } else {
                  setEditName(currentUserName);
                  setEditAvatar(currentUserAvatar);
                  setIsProfileModalOpen(true);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-2xl text-xs transition-all cursor-pointer shadow-sm group"
            >
              <UserAvatar
                avatar={currentUserAvatar}
                name={currentUserName}
                color={currentUserColor}
                size="xs"
                status="online"
                showStatus
              />
              <span className="font-bold text-zinc-200 hidden sm:inline">{currentUserName}</span>
              {isGuest ? (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-md font-mono hidden md:inline">
                  Гость
                </span>
              ) : (
                <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded-md font-mono hidden md:inline uppercase">
                  {authProvider}
                </span>
              )}
            </motion.button>

            {/* Create Room CTA */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-purple-950/60 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Создать зал</span>
            </motion.button>
          </div>

        </div>
      </motion.header>

      {/* Hero Banner Section */}
      <section className="relative px-4 lg:px-8 pt-8 pb-10 overflow-hidden border-b border-zinc-900/80">
        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Title & Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3 max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Rave & Discord Watch Together Experience</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Смотрите видео вместе с друзьями в идеальной синхронизации
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                YouTube, VK Видео, Rutube и прямые стримы с ультра-низкой задержкой, P2P WebRTC голосовыми комнатами и гибкими правами доступа.
              </p>
            </motion.div>

            {/* Quick Join Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-zinc-950/80 border border-zinc-800/90 rounded-3xl p-5 shadow-2xl backdrop-blur-xl w-full lg:w-96 shrink-0 space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-400" />
                Быстрый вход по коду или ссылке
              </span>

              <form onSubmit={handleQuickJoin} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickRoomCode}
                    onChange={(e) => setQuickRoomCode(e.target.value)}
                    placeholder="Код зала (напр. CINEMA) или ссылка..."
                    className="flex-1 bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-3.5 py-2.5 text-xs text-white uppercase font-mono font-bold outline-none transition-all placeholder:text-zinc-600 placeholder:normal-case shadow-inner"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl text-xs transition-colors flex items-center justify-center cursor-pointer shadow-md shadow-indigo-950/50"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </form>

              {/* Quick stats pills */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>В эфире: <strong className="text-white font-bold">{liveRoomsCount}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Зрителей: <strong className="text-white font-bold">{totalViewers}</strong></span>
                </div>
              </div>

            </motion.div>

          </div>

        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 relative z-10">
        <RoomList
          rooms={rooms}
          recentRooms={recentRooms}
          currentUserId={currentUserId}
          onJoinRoom={handleRoomCardClick}
          onDeleteRoom={onDeleteRoom}
          onClearRecentRooms={onClearRecentRooms}
          isLoading={isLoading}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 px-4 text-center text-xs text-zinc-600">
        <p>Sferium Homes Sync Pro — Интерактивный кинотеатр реального времени</p>
      </footer>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateRoom={onCreateRoom}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        currentUserColor={currentUserColor}
      />

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {passwordModalRoomId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPasswordModalRoomId(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 relative z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Приватный зал #{passwordModalRoomId}</h3>
                    <p className="text-xs text-zinc-400">Для входа требуется пароль хоста</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalRoomId(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-rose-300 text-xs font-semibold">
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleVerifyAndJoin} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Введите пароль или PIN
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={passwordAttempt}
                    onChange={(e) => setPasswordAttempt(e.target.value)}
                    placeholder="Пароль доступа..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-white font-mono text-sm outline-none shadow-inner"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalRoomId(null)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-2xl font-bold transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isVerifyingPassword}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-orange-950/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifyingPassword ? 'Проверка...' : 'Войти в зал'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 relative z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-base font-bold text-white">Настройка профиля</h3>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Ваше имя в зале
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-white font-bold outline-none shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Выберите аватарку
                  </label>
                  <div className="grid grid-cols-6 gap-2 p-2 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                    {AVATAR_PRESETS.map((av) => (
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        key={av}
                        type="button"
                        onClick={() => setEditAvatar(av)}
                        className={`text-2xl p-2 rounded-2xl border transition-all cursor-pointer ${
                          editAvatar === av
                            ? 'bg-indigo-950 border-indigo-500 scale-110 shadow-md shadow-indigo-900/40'
                            : 'bg-zinc-950/60 border-zinc-800/60 hover:bg-zinc-800'
                        }`}
                      >
                        {av}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-2xl font-bold transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all shadow-md shadow-indigo-950/50 cursor-pointer"
                  >
                    Сохранить
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default Lobby;
