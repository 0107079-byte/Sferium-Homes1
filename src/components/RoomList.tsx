import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Users,
  Lock,
  Globe,
  Play,
  Copy,
  Check,
  Trash2,
  Tv,
  Film,
  Sparkles,
  Radio,
  Clock,
  ExternalLink,
  Flame,
  Music,
  Share2,
  Shield
} from 'lucide-react';
import { RoomSummary, VideoProvider } from '../types';

interface RoomListProps {
  rooms: RoomSummary[];
  recentRooms: string[];
  currentUserId: string;
  onJoinRoom: (roomId: string, hasPassword?: boolean) => void;
  onDeleteRoom: (roomId: string) => void;
  onClearRecentRooms: () => void;
  isLoading?: boolean;
}

const CATEGORY_TABS = [
  'Все',
  'Популярные',
  'YouTube',
  'VK Video',
  'Rutube',
  'Кино',
  'Аниме',
  'Музыка',
  'Мои залы',
];

export const RoomList: React.FC<RoomListProps> = ({
  rooms,
  recentRooms,
  currentUserId,
  onJoinRoom,
  onDeleteRoom,
  onClearRecentRooms,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Все');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(roomId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Tab filter
      if (activeTab === 'Мои залы') {
        if (room.hostId !== currentUserId) return false;
      } else if (activeTab === 'Популярные') {
        if (room.membersCount < 1) return false;
      } else if (activeTab === 'YouTube') {
        if (room.provider !== 'youtube' && !room.tags?.includes('YouTube')) return false;
      } else if (activeTab === 'VK Video') {
        if (room.provider !== 'vk' && !room.tags?.includes('VK Video')) return false;
      } else if (activeTab === 'Rutube') {
        if (room.provider !== 'rutube' && !room.tags?.includes('Rutube')) return false;
      } else if (activeTab === 'Кино') {
        if (!room.tags?.includes('Кино') && !room.name.toLowerCase().includes('кино')) return false;
      } else if (activeTab === 'Аниме') {
        if (!room.tags?.includes('Аниме') && !room.name.toLowerCase().includes('аниме')) return false;
      } else if (activeTab === 'Музыка') {
        if (!room.tags?.includes('Музыка') && !room.name.toLowerCase().includes('lofi')) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = room.name.toLowerCase().includes(q);
        const matchId = room.roomId.toLowerCase().includes(q);
        const matchHost = room.hostName.toLowerCase().includes(q);
        const matchTags = room.tags?.some((t) => t.toLowerCase().includes(q));
        const matchDesc = room.description?.toLowerCase().includes(q);
        return matchName || matchId || matchHost || matchTags || matchDesc;
      }

      return true;
    });
  }, [rooms, activeTab, searchQuery, currentUserId]);

  const getProviderBadge = (provider?: VideoProvider) => {
    switch (provider) {
      case 'youtube':
        return <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/40 px-2.5 py-0.5 rounded-full font-bold">YouTube</span>;
      case 'vk':
        return <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full font-bold">VK Video</span>;
      case 'rutube':
        return <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">Rutube</span>;
      case 'direct':
        return <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-bold">Прямой поток</span>;
      default:
        return <span className="text-[9px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-0.5 rounded-full font-bold">Видео</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search & Categories Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск залов по названию, коду, хосту или тегам..."
            className="w-full bg-zinc-900/80 border border-zinc-800/90 focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-500 outline-none transition-all shadow-inner backdrop-blur-md"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Total Active Rooms indicator */}
        <div className="flex items-center gap-2 self-end sm:self-center px-3.5 py-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-xs text-zinc-400 shadow-sm backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Активных комнат: <strong className="text-white font-bold">{rooms.length}</strong></span>
        </div>
      </div>

      {/* Categories Chips with Smooth Layout ID animation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar relative">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer relative border ${
                isActive
                  ? 'border-indigo-500 text-white shadow-lg shadow-purple-950/40'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCategoryPill"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          );
        })}
      </div>

      {/* Recent Rooms Strip (if any) */}
      <AnimatePresence>
        {recentRooms.length > 0 && !searchQuery && activeTab === 'Все' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-4 space-y-2.5 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Недавние кинозалы
              </span>
              <button
                type="button"
                onClick={onClearRecentRooms}
                className="text-[10px] text-zinc-500 hover:text-rose-400 font-semibold transition-colors cursor-pointer"
              >
                Очистить историю
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {recentRooms.map((rId) => {
                const matchedRoom = rooms.find((r) => r.roomId === rId);
                return (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={rId}
                    type="button"
                    onClick={() => onJoinRoom(rId, matchedRoom?.hasPassword)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-zinc-950/80 hover:bg-indigo-950/40 border border-zinc-800 hover:border-indigo-500/60 rounded-2xl text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer group whitespace-nowrap shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-400 group-hover:animate-ping" />
                    <span className="font-mono font-bold text-indigo-300">{rId}</span>
                    {matchedRoom && (
                      <span className="text-zinc-400 text-[10px] max-w-[120px] truncate">
                        {matchedRoom.name}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 bg-zinc-900/40 rounded-3xl border border-zinc-800/60 animate-pulse" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-3"
        >
          <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl shadow-inner">
            🎬
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Комнаты не найдены</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              {searchQuery
                ? `По запросу «${searchQuery}» ничего не найдено. Попробуйте изменить параметры поиска.`
                : 'В этой категории пока нет открытых комнат. Станьте первым и создайте свой кинозал!'}
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room, idx) => {
            const isMyRoom = room.hostId === currentUserId;

            return (
              <motion.div
                key={room.roomId}
                initial={{ opacity: 0, y: 15, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => onJoinRoom(room.roomId, room.hasPassword)}
                className="group relative bg-zinc-950/80 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-indigo-500/60 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/50 cursor-pointer flex flex-col justify-between backdrop-blur-xl"
              >
                {/* Top Card Gradient Light on hover */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Header & Preview Image */}
                <div className="p-4 space-y-3">
                  
                  {/* Thumbnail / Header bar */}
                  <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 flex items-center justify-center">
                    {room.currentVideoThumbnail ? (
                      <img
                        src={room.currentVideoThumbnail}
                        alt={room.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 via-purple-950/40 to-zinc-950 flex items-center justify-center">
                        <Tv className="w-10 h-10 text-indigo-400/40" />
                      </div>
                    )}

                    {/* Dark gradient overlay for badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {getProviderBadge(room.provider)}
                        {room.isPrivate && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 backdrop-blur-md">
                            <Lock className="w-2.5 h-2.5" />
                            {room.hasPassword ? 'Пароль' : 'Приватная'}
                          </span>
                        )}
                      </div>

                      {/* Live Play Status */}
                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-[9px] font-bold text-zinc-300 backdrop-blur-md">
                        {room.playing ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span className="text-emerald-300">В эфире</span>
                          </>
                        ) : (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span className="text-zinc-400">Пауза</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Room ID Tag on bottom of thumbnail */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-xs">
                      <span className="font-mono font-black text-white text-[11px] tracking-wider bg-black/70 border border-white/20 px-2 py-0.5 rounded-xl backdrop-blur-md">
                        #{room.roomId}
                      </span>

                      <span className="flex items-center gap-1 text-[11px] font-bold text-white bg-black/70 border border-white/20 px-2.5 py-0.5 rounded-xl backdrop-blur-md">
                        <Users className="w-3 h-3 text-indigo-400" />
                        <span>{room.membersCount}</span>
                        <span className="text-zinc-400">/{room.maxMembers || 50}</span>
                      </span>
                    </div>
                  </div>

                  {/* Room Title & Description */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {room.name}
                    </h4>
                    {room.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {room.description}
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {room.tags && room.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-lg font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                </div>

                {/* Card Footer */}
                <div className="p-4 pt-3 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between gap-2">
                  
                  {/* Host info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs shadow-sm">
                      {room.hostAvatar || '🍿'}
                    </div>
                    <div className="text-[11px] truncate">
                      <span className="text-zinc-500 text-[9px] block uppercase font-bold tracking-wider">Хост</span>
                      <span className="font-bold text-zinc-200 truncate">{room.hostName}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={(e) => handleCopyLink(room.roomId, e)}
                      title="Скопировать ссылку-приглашение"
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/40 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedId === room.roomId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </motion.button>

                    {isMyRoom && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => onDeleteRoom(room.roomId)}
                        title="Удалить мою комнату"
                        className="p-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-500/60 rounded-xl text-rose-300 hover:text-rose-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => onJoinRoom(room.roomId, room.hasPassword)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-950/50 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Войти</span>
                    </motion.button>
                  </div>

                </div>

              </motion.div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default RoomList;
