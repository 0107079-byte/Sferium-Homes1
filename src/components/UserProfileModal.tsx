import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  History,
  Palette,
  Sparkles,
  Check,
  Trash2,
  X,
  Mic,
  MicOff,
  Video,
  Volume2,
  Radio,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Smile,
  Shield,
  ShieldCheck,
  LogOut,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { UserStatus, UserAudioSettings, UserVideoSettings, UserProfile as UserProfileType, AppUser } from '../types';
import { userManager } from '../modules/user';
import UserAvatar from './UserAvatar';
import UserColorPicker from './UserColorPicker';
import AuthButtons from './AuthButtons';
import UserProfile from './UserProfile';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userAvatar?: string;
  userColor?: string;
  userId?: string;
  userStatus?: UserStatus;
  userCustomStatus?: string;
  userBio?: string;
  userMicSettings?: UserAudioSettings;
  userCameraSettings?: UserVideoSettings;
  onSaveProfile?: (profile: Partial<UserProfileType>) => void;
  recentRooms?: string[];
  onJoinRoomFromHistory?: (roomId: string) => void;
  onClearHistory?: () => void;
}

const PRESET_NAMES = [
  'Киноман', 'Эфирщик', 'Медиагуру', 'Телезритель',
  'Спутник', 'Астронавт', 'Фильмофил', 'Видеовояжер', 'ЗрительX'
];

const PRESET_AVATARS = [
  '🍿', '👾', '🎬', '🚀', '🪐', '🦊', '🐼', '🤖', '🍕', '📺',
  '👑', '🎧', '🎮', '⚡', '🌟', '🎨', '🏆', '🐱', '🐶', '🔥'
];

const STATUS_OPTIONS: { id: UserStatus; label: string; desc: string; color: string; ringColor: string }[] = [
  { id: 'online', label: 'В сети', desc: 'Доступен для совместного просмотра', color: 'bg-emerald-500', ringColor: 'border-emerald-500/50' },
  { id: 'idle', label: 'Не активен', desc: 'Отошел от экрана', color: 'bg-amber-500', ringColor: 'border-amber-500/50' },
  { id: 'dnd', label: 'Не беспокоить', desc: 'Отключить звуковые уведомления', color: 'bg-rose-500', ringColor: 'border-rose-500/50' },
  { id: 'offline', label: 'Невидимка', desc: 'Отображаться как офлайн', color: 'bg-zinc-500', ringColor: 'border-zinc-500/50' },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userName: propUserName,
  userAvatar: propUserAvatar,
  userColor: propUserColor,
  userId: propUserId,
  userStatus: propUserStatus = 'online',
  userCustomStatus: propUserCustomStatus = '',
  userBio: propUserBio = '',
  userMicSettings: propUserMicSettings,
  userCameraSettings: propUserCameraSettings,
  onSaveProfile,
  recentRooms = [],
  onJoinRoomFromHistory,
  onClearHistory,
}) => {
  const [currentUser, setCurrentUser] = useState<AppUser>(userManager.getUser());
  const [activeTab, setActiveTab] = useState<'profile' | 'auth' | 'color' | 'mic' | 'history'>('profile');

  // Profile Form States
  const [name, setName] = useState(currentUser.name);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [color, setColor] = useState(currentUser.color);
  const [status, setStatus] = useState<UserStatus>(currentUser.status);
  const [customStatus, setCustomStatus] = useState(currentUser.customStatus || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'url'>('emoji');
  const [savedNotice, setSavedNotice] = useState(false);

  // Microphone Settings State
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(currentUser.micSettings.deviceId || '');
  const [micVolume, setMicVolume] = useState<number>(currentUser.micSettings.inputVolume || 100);
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(currentUser.micSettings.noiseSuppression ?? true);
  const [echoCancellation, setEchoCancellation] = useState<boolean>(currentUser.micSettings.echoCancellation ?? true);
  const [micTestLevel, setMicTestLevel] = useState<number>(0);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testAnimFrameRef = useRef<number | null>(null);

  // Subscribe to user manager changes
  useEffect(() => {
    const unsub = userManager.subscribe((u) => {
      setCurrentUser(u);
      setName(u.name);
      setAvatar(u.avatar);
      setColor(u.color);
      setStatus(u.status);
      setCustomStatus(u.customStatus || '');
      setBio(u.bio || '');
    });
    return unsub;
  }, []);

  // Update from props if opened
  useEffect(() => {
    if (isOpen) {
      const u = userManager.getUser();
      setCurrentUser(u);
      setName(propUserName || u.name);
      setAvatar(propUserAvatar || u.avatar);
      setColor(propUserColor || u.color);
      setStatus(propUserStatus || u.status);
      setCustomStatus(propUserCustomStatus || u.customStatus || '');
      setBio(propUserBio || u.bio || '');
      setSavedNotice(false);
    }
  }, [isOpen, propUserName, propUserAvatar, propUserColor, propUserStatus, propUserCustomStatus, propUserBio]);

  // Load Audio devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          setMicDevices(devs.filter((d) => d.kind === 'audioinput'));
        }
      } catch (e) {
        console.warn('Cannot enumerate audio devices:', e);
      }
    };

    if (isOpen && activeTab === 'mic') {
      loadDevices();
    }
  }, [isOpen, activeTab]);

  // Mic test cleanup
  useEffect(() => {
    return () => {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (testAnimFrameRef.current) {
        cancelAnimationFrame(testAnimFrameRef.current);
      }
    };
  }, []);

  const handleToggleMicTest = async () => {
    if (isTestingMic) {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((t) => t.stop());
        testStreamRef.current = null;
      }
      if (testAnimFrameRef.current) {
        cancelAnimationFrame(testAnimFrameRef.current);
        testAnimFrameRef.current = null;
      }
      setIsTestingMic(false);
      setMicTestLevel(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
          video: false,
        });
        testStreamRef.current = stream;
        setIsTestingMic(true);

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            sum += data[i];
          }
          const avg = sum / data.length;
          setMicTestLevel(Math.min(100, Math.round((avg / 128) * 100)));
          testAnimFrameRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        console.error('Error starting mic test:', err);
        alert('Не удалось получить доступ к микрофону для проверки.');
      }
    }
  };

  const handleSaveAll = () => {
    const updated = userManager.setUser({
      name: name.trim() || 'Гость',
      avatar: avatar || '🍿',
      color: color || '#6366f1',
      status,
      customStatus: customStatus.trim(),
      bio: bio.trim(),
      micSettings: {
        deviceId: selectedMicId,
        inputVolume: micVolume,
        noiseSuppression,
        echoCancellation,
        autoGainControl: true,
      },
    });

    if (onSaveProfile) {
      onSaveProfile(updated);
    }

    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 600);
  };

  const handleLogout = () => {
    const guestUser = userManager.logout();
    if (onSaveProfile) {
      onSaveProfile(guestUser);
    }
    setActiveTab('profile');
  };

  const handleDeleteAccount = () => {
    const freshGuest = userManager.deleteAccount();
    if (onSaveProfile) {
      onSaveProfile(freshGuest);
    }
    setActiveTab('profile');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850 bg-zinc-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                <span>Личный кабинет</span>
                {currentUser.isGuest ? (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                    Гость
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                    {currentUser.authProvider?.toUpperCase() || 'VK ID'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">Настройки профиля, авторизации и оборудования</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-zinc-850 bg-zinc-900/30 overflow-x-auto space-x-1 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Профиль</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'auth'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Вход / VK OneTap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('color')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'color'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-purple-400" />
            <span>Цвет и стиль</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'mic'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>Микрофон</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>История</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Active Profile Card Overview */}
              <UserProfile
                user={{
                  ...currentUser,
                  name,
                  avatar,
                  color,
                  status,
                  customStatus,
                  bio,
                }}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
                showActions={true}
              />

              {/* Name & Avatar Customization */}
              <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Smile className="w-4 h-4 text-indigo-400" />
                  <span>Кастомизация ника и аватара</span>
                </h3>

                {/* Nickname Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 block">Отображаемое имя:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={name}
                      maxLength={32}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Введите ваше имя"
                      className="flex-1 bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setName(PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)])}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      title="Случайное имя"
                    >
                      🎲 Случайное
                    </button>
                  </div>
                </div>

                {/* Status & Bio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Статус-сообщение:</label>
                    <input
                      type="text"
                      value={customStatus}
                      maxLength={60}
                      onChange={(e) => setCustomStatus(e.target.value)}
                      placeholder="Например: Смотрю аниме 🍿"
                      className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Сетевой статус:</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as UserStatus)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.desc})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Avatar Presets / Custom URL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">Выберите аватар:</label>
                    <div className="flex items-center space-x-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setAvatarMode('emoji')}
                        className={`px-2 py-0.5 rounded-md font-bold ${avatarMode === 'emoji' ? 'bg-indigo-600 text-white' : 'text-zinc-400'}`}
                      >
                        Эмодзи
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarMode('url')}
                        className={`px-2 py-0.5 rounded-md font-bold ${avatarMode === 'url' ? 'bg-indigo-600 text-white' : 'text-zinc-400'}`}
                      >
                        Ссылка URL
                      </button>
                    </div>
                  </div>

                  {avatarMode === 'emoji' ? (
                    <div className="grid grid-cols-10 gap-1.5 p-2 bg-zinc-950 rounded-2xl border border-zinc-800 max-h-32 overflow-y-auto">
                      {PRESET_AVATARS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatar(emoji)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-pointer ${
                            avatar === emoji ? 'bg-indigo-600/30 border border-indigo-400 shadow-md' : 'hover:bg-zinc-800'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={customAvatarUrl}
                        onChange={(e) => setCustomAvatarUrl(e.target.value)}
                        placeholder="https://example.com/my-photo.jpg"
                        className="flex-1 bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customAvatarUrl.trim()) {
                            setAvatar(customAvatarUrl.trim());
                          }
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Применить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUTHENTICATION & VK ONETAP */}
          {activeTab === 'auth' && (
            <div className="space-y-5">
              <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-3xl space-y-2">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Регистрация и вход через VK ID</h3>
                </div>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  Регистрация необязательна — вы можете продолжать пользоваться приложением как гость. Войдите через VK ID, OK.ru или Mail.ru для сохранения профиля и доступа к закрытым видеозаписям.
                </p>
              </div>

              {/* Status info */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${currentUser.isGuest ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-white">
                      Текущий статус: {currentUser.isGuest ? 'Гостевой режим' : `Авторизован (${currentUser.authProvider?.toUpperCase()})`}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      ID: {currentUser.userId}
                    </div>
                  </div>
                </div>

                {!currentUser.isGuest && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                )}
              </div>

              {/* OneTap Widget */}
              <div className="p-5 bg-zinc-900/80 border border-zinc-800 rounded-3xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Виджет быстрой авторизации
                </h4>

                <AuthButtons
                  onSuccess={() => {
                    const u = userManager.getUser();
                    setCurrentUser(u);
                    setName(u.name);
                    setAvatar(u.avatar);
                    if (onSaveProfile) {
                      onSaveProfile(u);
                    }
                  }}
                  onContinueAsGuest={() => {
                    onClose();
                  }}
                  showGuestButton={true}
                />
              </div>
            </div>
          )}

          {/* TAB 3: COLOR & PALETTE */}
          {activeTab === 'color' && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  <span>Персональный цвет профиля</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Этот цвет используется для подсветки вашего имени в чате, рамки аватара и индикатора активности.
                </p>
                <UserColorPicker
                  selectedColor={color}
                  onChange={(newColor: string) => setColor(newColor)}
                />
              </div>
            </div>
          )}

          {/* TAB 4: MICROPHONE SETTINGS */}
          {activeTab === 'mic' && (
            <div className="space-y-4">
              <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>Настройки микрофона и звука</span>
                </h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Устройство ввода (микрофон):</label>
                  <select
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">По умолчанию</option>
                    {micDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Микрофон ${d.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Noise Suppression & Echo Cancellation */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center space-x-2.5 p-3 bg-zinc-950 rounded-2xl border border-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noiseSuppression}
                      onChange={(e) => setNoiseSuppression(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span className="text-xs text-zinc-200 font-medium">Шумоподавление</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-3 bg-zinc-950 rounded-2xl border border-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={echoCancellation}
                      onChange={(e) => setEchoCancellation(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span className="text-xs text-zinc-200 font-medium">Эхоподавление</span>
                  </label>
                </div>

                {/* Volume Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span>Чувствительность входа:</span>
                    <span className="font-mono text-emerald-400">{micVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={micVolume}
                    onChange={(e) => setMicVolume(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Mic Test Section */}
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Проверка звука микрофона:</span>
                    <button
                      type="button"
                      onClick={handleToggleMicTest}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isTestingMic
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      }`}
                    >
                      {isTestingMic ? 'Остановить тест' : 'Начать тест'}
                    </button>
                  </div>

                  <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                    <motion.div
                      animate={{ width: `${micTestLevel}%` }}
                      transition={{ duration: 0.05 }}
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Недавние комнаты</span>
                  </h3>

                  {recentRooms.length > 0 && onClearHistory && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Очистить</span>
                    </button>
                  )}
                </div>

                {recentRooms.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-4 text-center">
                    История просмотров пока пуста. Присоединяйтесь к комнатам в лобби!
                  </p>
                ) : (
                  <div className="flex flex-col space-y-2 max-h-48 overflow-y-auto">
                    {recentRooms.map((rId) => (
                      <div
                        key={rId}
                        className="flex items-center justify-between p-3 bg-zinc-950 rounded-2xl border border-zinc-800"
                      >
                        <span className="font-mono text-xs font-bold text-indigo-300">{rId}</span>
                        {onJoinRoomFromHistory && (
                          <button
                            type="button"
                            onClick={() => {
                              onJoinRoomFromHistory(rId);
                              onClose();
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Войти
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Action Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-850 bg-zinc-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            {savedNotice && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-1.5 text-xs text-emerald-400 font-bold"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Профиль сохранен!</span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-950/50 transition-all cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserProfileModal;
