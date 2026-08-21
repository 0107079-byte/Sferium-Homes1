import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Mic,
  Palette,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  Check,
  Sparkles,
  Sliders,
  ShieldCheck,
  Save,
  CheckCircle2,
  Smile,
  RefreshCw,
} from 'lucide-react';
import { UserStatus, AppUser } from '../types';
import { userManager } from '../modules/user';
import UserColorPicker from './UserColorPicker';
import { soundManager } from '../utils/soundNotifications';
import { vibrationManager } from '../utils/vibration';
import { pushManager } from '../utils/pushNotifications';

export interface UserSettingsProps {
  onSaved?: () => void;
  onClose?: () => void;
}

const PRESET_NAMES = [
  'Киноман', 'Эфирщик', 'Медиагуру', 'Телезритель',
  'Спутник', 'Астронавт', 'Фильмофил', 'Видеовояжер', 'ЗрительX',
  'КиноКритик', 'КиноманPRO', 'НочнойЗритель'
];

const PRESET_AVATARS = [
  '🍿', '👾', '🎬', '🚀', '🪐', '🦊', '🐼', '🤖', '🍕', '📺',
  '👑', '🎧', '🎮', '⚡', '🌟', '🎨', '🏆', '🐱', '🐶', '🔥',
  '💎', '🦄', '🍧', '🛸', '🎯', '🕶️', '🔮', '🎭', '🍀', '✨'
];

const STATUS_OPTIONS: { id: UserStatus; label: string; desc: string; color: string }[] = [
  { id: 'online', label: 'В сети', desc: 'Готов к просмотру', color: 'bg-emerald-500' },
  { id: 'idle', label: 'Не активен', desc: 'Отошел от экрана', color: 'bg-amber-500' },
  { id: 'dnd', label: 'Не беспокоить', desc: 'Без звуков', color: 'bg-rose-500' },
  { id: 'offline', label: 'Невидимка', desc: 'Скрытый режим', color: 'bg-zinc-500' },
];

export const UserSettings: React.FC<UserSettingsProps> = ({ onSaved, onClose }) => {
  const [currentUser, setCurrentUser] = useState<AppUser>(userManager.getUser());
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'notifications' | 'color'>('general');

  // Form Fields
  const [name, setName] = useState(currentUser.name);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [color, setColor] = useState(currentUser.color);
  const [status, setStatus] = useState<UserStatus>(currentUser.status);
  const [customStatus, setCustomStatus] = useState(currentUser.customStatus || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'url'>('emoji');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Audio / Mic Settings
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(currentUser.micSettings.deviceId || '');
  const [micVolume, setMicVolume] = useState<number>(currentUser.micSettings.inputVolume || 100);
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(currentUser.micSettings.noiseSuppression ?? true);
  const [echoCancellation, setEchoCancellation] = useState<boolean>(currentUser.micSettings.echoCancellation ?? true);

  // Notification Preferences
  const [soundEnabled, setSoundEnabled] = useState<boolean>(!soundManager.getIsMuted());
  const [vibrateEnabled, setVibrateEnabled] = useState<boolean>(vibrationManager.getIsEnabled());
  const [pushEnabled, setPushEnabled] = useState<boolean>(pushManager.getIsEnabled());
  const [pushStatus, setPushStatus] = useState<string>(pushManager.getPermissionStatus());

  // UI feedback
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const unsub = userManager.subscribe((u) => {
      setCurrentUser(u);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          setMicDevices(devs.filter((d) => d.kind === 'audioinput'));
        }
      } catch (e) {
        console.warn('Audio device enum failed:', e);
      }
    };
    loadAudioDevices();
  }, []);

  const handleRequestPushPermission = async () => {
    const granted = await pushManager.requestPermission();
    setPushEnabled(granted);
    setPushStatus(pushManager.getPermissionStatus());
    if (granted) {
      pushManager.sendNotification({
        title: 'Уведомления Sferium',
        body: 'Push-уведомления успешно подключены!',
        icon: avatar || '🍿',
      });
    }
  };

  const handleSave = () => {
    // Save to user manager
    userManager.setUser({
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

    // Save notification preferences
    soundManager.setMuted(!soundEnabled);
    vibrationManager.setEnabled(vibrateEnabled);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (onSaved) onSaved();
      if (onClose) onClose();
    }, 600);
  };

  return (
    <div id="user-settings-panel" className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/40 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Настройки личного кабинета</h2>
            <p className="text-[11px] text-zinc-400">Кастомизация профиля, аудио и уведомлений</p>
          </div>
        </div>

        {savedSuccess && (
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
            <CheckCircle2 className="w-4 h-4" /> Сохранено
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 py-2 bg-zinc-900/60 border-b border-zinc-850 gap-1.5 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Профиль
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('color')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'color'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Цвет и стиль
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audio')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'audio'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          Микрофон
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Уведомления
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Nickname */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Отображаемое имя:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={name}
                  maxLength={32}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше имя в зале"
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setName(PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)])}
                  className="px-3 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Рандом
                </button>
              </div>
            </div>

            {/* Status & Custom status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Статус-сообщение:</label>
                <input
                  type="text"
                  value={customStatus}
                  maxLength={60}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="Например: Смотрю кино 🍿"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Сетевой статус:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.desc})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">О себе (Bio):</label>
              <textarea
                value={bio}
                maxLength={150}
                rows={2}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Расскажите пару слов о себе или любимых фильмах..."
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Avatar Selector */}
            <div className="space-y-2 pt-2 border-t border-zinc-850">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">Выбор аватара:</label>
                <div className="flex items-center space-x-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setAvatarMode('emoji')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${avatarMode === 'emoji' ? 'bg-indigo-600 text-white' : 'text-zinc-400'}`}
                  >
                    Эмодзи
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarMode('url')}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${avatarMode === 'url' ? 'bg-indigo-600 text-white' : 'text-zinc-400'}`}
                  >
                    URL картинка
                  </button>
                </div>
              </div>

              {avatarMode === 'emoji' ? (
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 p-2 bg-zinc-900/60 rounded-2xl border border-zinc-850 max-h-36 overflow-y-auto">
                  {PRESET_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`h-9 w-full rounded-xl flex items-center justify-center text-lg transition-transform cursor-pointer ${
                        avatar === emoji
                          ? 'bg-indigo-600/30 border border-indigo-400 shadow-md scale-105'
                          : 'hover:bg-zinc-800'
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
                    placeholder="https://example.com/avatar.jpg"
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAvatarUrl.trim()) setAvatar(customAvatarUrl.trim());
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Применить
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COLOR */}
        {activeTab === 'color' && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                <span>Фирменный цвет профиля</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Цвет вашего имени в сообщениях чата и подсветки аватара.
              </p>
              <UserColorPicker
                selectedColor={color}
                onChange={(newColor) => setColor(newColor)}
              />
            </div>
          </div>
        )}

        {/* TAB 3: AUDIO */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Устройство ввода</span>
              </h3>

              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">Микрофон по умолчанию</option>
                {micDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Микрофон ${d.deviceId.slice(0, 8)}...`}
                  </option>
                ))}
              </select>

              {/* Noise Suppression & Echo Cancellation */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <label className="flex items-center space-x-2 p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noiseSuppression}
                    onChange={(e) => setNoiseSuppression(e.target.checked)}
                    className="rounded accent-emerald-500"
                  />
                  <span className="text-xs text-zinc-200">Шумоподавление</span>
                </label>

                <label className="flex items-center space-x-2 p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={echoCancellation}
                    onChange={(e) => setEchoCancellation(e.target.checked)}
                    className="rounded accent-emerald-500"
                  />
                  <span className="text-xs text-zinc-200">Эхоподавление</span>
                </label>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Чувствительность микрофона:</span>
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
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS & WEB PUSH */}
        {activeTab === 'notifications' && (
          <div className="space-y-3">
            {/* Sound Toggles */}
            <div className="p-3.5 bg-zinc-900/50 border border-zinc-850 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">Звуковые сигналы</h4>
                  <p className="text-[10px] text-zinc-400">Сообщения, входы участников, действия хоста</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Vibration Toggle */}
            <div className="p-3.5 bg-zinc-900/50 border border-zinc-850 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Вибрация на смартфонах</h4>
                  <p className="text-[10px] text-zinc-400">Тактильный отклик при новых событиях</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={vibrateEnabled}
                onChange={(e) => setVibrateEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Web Push Toggle */}
            <div className="p-3.5 bg-zinc-900/50 border border-zinc-850 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Web Push уведомления</h4>
                    <p className="text-[10px] text-zinc-400">
                      Уведомления в фоне и при свернутой вкладке
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    pushStatus === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {pushStatus === 'granted' ? 'Активно' : 'Выключено'}
                </span>
              </div>

              {pushStatus !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPushPermission}
                  className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Разрешить Web Push
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex items-center justify-end space-x-2 shrink-0">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          Сохранить изменения
        </button>
      </div>
    </div>
  );
};

export default UserSettings;
