import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Lock,
  Globe,
  Radio,
  Sliders,
  Tv,
  Film,
  Music,
  Flame,
  Gamepad2,
  ShieldCheck,
  Users,
  KeyRound,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { CreateRoomPayload, UserRole } from '../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (payload: CreateRoomPayload) => Promise<void> | void;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  currentUserColor: string;
}

const PRESET_TAGS = [
  { id: 'Кино', label: 'Кино & Трейлеры', icon: Film, color: 'text-amber-400 bg-amber-950/40 border-amber-500/30' },
  { id: 'Аниме', label: 'Аниме & AMV', icon: Flame, color: 'text-rose-400 bg-rose-950/40 border-rose-500/30' },
  { id: 'YouTube', label: 'YouTube', icon: Tv, color: 'text-red-400 bg-red-950/40 border-red-500/30' },
  { id: 'VK Video', label: 'VK Видео', icon: Globe, color: 'text-blue-400 bg-blue-950/40 border-blue-500/30' },
  { id: 'Rutube', label: 'Rutube', icon: Tv, color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' },
  { id: 'Музыка', label: 'Музыка & Lofi', icon: Music, color: 'text-purple-400 bg-purple-950/40 border-purple-500/30' },
  { id: 'Игры', label: 'Игры & Стримы', icon: Gamepad2, color: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30' },
];

const RANDOM_NAMES = [
  '🍿 Ночной Киносеанс с Друзьями',
  '🎧 Lofi & Chill Lounge',
  '⚡ Аниме Марафон 2026',
  '🚀 Обсуждение Киноновинок',
  '📺 Тренды YouTube & Мемы',
  '🎬 VK Видео & Шоу',
  '🔥 Эпичные Трейлеры 4K',
  '🎶 Музыкальный Джем-клуб',
];

const QUICK_VIDEOS = [
  { label: 'Lofi Girl', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: '4K Кино', url: 'https://www.youtube.com/watch?v=1Roy4o4WCyE' },
  { label: 'VK Видео', url: 'https://vkvideo.ru/video-220550000_456239149' },
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentUserColor,
}) => {
  const [name, setName] = useState('');
  const [customRoomId, setCustomRoomId] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Кино', 'YouTube']);
  const [initialVideoUrl, setInitialVideoUrl] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [anyoneCanControl, setAnyoneCanControl] = useState(true);
  const [defaultRole, setDefaultRole] = useState<UserRole>('member');
  const [maxMembers, setMaxMembers] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleGenerateRandomName = () => {
    const random = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setName(random);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Пожалуйста, укажите название комнаты');
      return;
    }

    if (isPrivate && password.trim() && password.trim().length < 3) {
      setError('Пароль для приватной комнаты должен быть не менее 3 символов');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const payload: CreateRoomPayload = {
        roomId: customRoomId.trim().toUpperCase() || undefined,
        name: cleanName,
        description: description.trim() || undefined,
        isPrivate,
        password: isPrivate && password.trim() ? password.trim() : undefined,
        tags: selectedTags.length > 0 ? selectedTags : ['Кино'],
        initialVideoUrl: initialVideoUrl.trim() || undefined,
        maxMembers,
        anyoneCanControl,
        defaultRole,
        hostId: currentUserId,
        hostName: currentUserName,
        hostAvatar: currentUserAvatar,
        hostColor: currentUserColor,
      };

      await onCreateRoom(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании комнаты');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-xl bg-zinc-950/95 border border-zinc-800/90 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-purple-950/50 overflow-hidden max-h-[90vh] flex flex-col z-10"
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-gradient-to-r from-indigo-600/30 via-fuchsia-600/30 to-pink-600/30 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center">
                  <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-wide">
                    Создать новый кинозал
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Совместный просмотр как в Rave и Discord Watch Together
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white rounded-2xl hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-rose-300 text-xs flex items-center justify-between shadow-md"
              >
                <span className="font-semibold">{error}</span>
                <button type="button" onClick={() => setError('')} className="text-rose-400 font-bold ml-2">✕</button>
              </motion.div>
            )}

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 custom-scrollbar relative z-10 text-xs">
              
              {/* Room Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Название комнаты <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomName}
                    className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Случайное название
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: 🍿 Кинозал с друзьями"
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-white font-medium outline-none transition-all placeholder:text-zinc-500 shadow-inner"
                />
              </div>

              {/* Custom Slug / Room ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Пользовательский код (ID)
                  </label>
                  <input
                    type="text"
                    value={customRoomId}
                    onChange={(e) => setCustomRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="Авто (например, CINEMA)"
                    maxLength={10}
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-indigo-300 font-mono font-bold tracking-wider uppercase outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Лимит участников
                  </label>
                  <select
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                    className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-zinc-200 outline-none transition-all cursor-pointer font-medium shadow-inner"
                  >
                    <option value={10}>10 участников (Уютный круг)</option>
                    <option value={25}>25 участников (Стандарт)</option>
                    <option value={50}>50 участников (Большой просмотр)</option>
                    <option value={100}>100 участников (Кино-фест)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  Описание (по желанию)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="О чем этот зал? Какое видео планируете смотреть?"
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-4 py-2 text-zinc-200 outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                />
              </div>

              {/* Privacy Toggle & Password */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-2xl border ${isPrivate ? 'bg-amber-950/50 border-amber-500/40 text-amber-300' : 'bg-indigo-950/50 border-indigo-500/40 text-indigo-300'}`}>
                      {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-zinc-200">
                        {isPrivate ? 'Приватная комната' : 'Публичная комната'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {isPrivate ? 'Только по ссылке или с паролем' : 'Видна всем пользователям в лобби'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      isPrivate ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-zinc-700'
                    }`}
                  >
                    <motion.div
                      layout
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        isPrivate ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-2 border-t border-zinc-800/60 space-y-1.5"
                  >
                    <label className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      Пароль доступа (опционально)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Введите PIN или пароль для входа"
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-2xl px-4 py-2 text-zinc-100 outline-none pr-9 font-mono shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Tags / Categories */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                  Теги и Категории
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    const Icon = tag.icon;
                    return (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-[11px] font-medium transition-all cursor-pointer ${
                          isSelected
                            ? tag.color + ' ring-1 ring-white/20'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{tag.label}</span>
                        {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Initial Video Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    Стартовое видео (YouTube / VK / Rutube / MP4)
                  </label>
                  <div className="flex gap-1.5">
                    {QUICK_VIDEOS.map((qv) => (
                      <button
                        key={qv.label}
                        type="button"
                        onClick={() => setInitialVideoUrl(qv.url)}
                        className="text-[9px] bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 px-2 py-0.5 rounded-lg text-indigo-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {qv.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="url"
                  value={initialVideoUrl}
                  onChange={(e) => setInitialVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-indigo-500 rounded-2xl px-4 py-2 text-zinc-200 font-mono outline-none text-xs shadow-inner"
                />
              </div>

              {/* Permissions & Roles options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-zinc-900/40 border border-zinc-800/70 p-3.5 rounded-2xl space-y-1.5 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-indigo-400" />
                    Управление плеером
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAnyoneCanControl(true)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                        anyoneCanControl
                          ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Свободный
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnyoneCanControl(false)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                        !anyoneCanControl
                          ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Только Хост
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/70 p-3.5 rounded-2xl space-y-1.5 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Роль гостей по умолчанию
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDefaultRole('member')}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                        defaultRole === 'member'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Участник
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultRole('viewer')}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                        defaultRole === 'viewer'
                          ? 'bg-sky-950/80 border-sky-500 text-sky-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Зритель
                    </button>
                  </div>
                </div>
              </div>

            </form>

            {/* Footer actions */}
            <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-2.5 relative z-10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-2xl font-bold text-xs transition-colors cursor-pointer"
              >
                Отмена
              </button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-purple-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Создание...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Создать и войти</span>
                  </>
                )}
              </motion.button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateRoomModal;
