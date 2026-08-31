import React, { useEffect, useState } from 'react';
import { Room, User } from '../types';
import { fetchRooms } from '../services/rooms';
import { Plus, Users, Tv, Play, Lock, Settings, Sparkles } from 'lucide-react';
import { CreateRoomModal } from './CreateRoomModal';
import { UserSettings } from './UserSettings';

interface LobbyProps {
  currentUser: User;
  onJoinRoom: (roomId: string) => void;
  onUpdateUser: (user: User) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ currentUser, onJoinRoom, onUpdateUser }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const loadRooms = async () => {
    try {
      const data = await fetchRooms();
      setRooms(data);
    } catch (e) {
      console.error('Failed to load rooms:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    const timer = setInterval(loadRooms, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Homes Sync</h1>
            <p className="text-xs text-slate-400">
              Единый канонический протокол видеосинхронизации и голосовой чат
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <div
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition flex-1 sm:flex-initial"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
              style={{ backgroundColor: currentUser.color || '#8b5cf6' }}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-slate-200">{currentUser.name}</span>
            <Settings className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-purple-600/25 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Создать комнату
          </button>
        </div>
      </div>

      {/* Room Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" /> Доступные комнаты
          </h2>
          <span className="text-xs text-slate-400">{rooms.length} комнат(ы)</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 bg-slate-900/60 rounded-2xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8 flex flex-col items-center">
            <Tv className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-300">Комнат пока нет</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Будьте первым! Создайте новую комнату и пригласите друзей для совместного просмотра.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition"
            >
              Создать комнату
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => onJoinRoom(room.id)}
                className="group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-5 shadow-lg hover:shadow-purple-500/10 cursor-pointer transition flex flex-col justify-between gap-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition line-clamp-1">
                      {room.name}
                    </h3>
                    {room.isPrivate && <Lock className="w-4 h-4 text-amber-400 shrink-0 ml-2" />}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Play className="w-3 h-3 text-purple-400" />
                    <span className="line-clamp-1">
                      {room.currentVideo?.title || 'Видео готово к просмотру'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{room.users?.length || 0} участников</span>
                  </div>

                  <span className="px-3 py-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg font-medium group-hover:bg-purple-600 group-hover:text-white transition text-xs">
                    Войти
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateRoomModal
          userId={currentUser.id}
          onCreated={(r) => {
            setShowCreateModal(false);
            onJoinRoom(r.id);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showSettingsModal && (
        <UserSettings
          user={currentUser}
          onUpdate={onUpdateUser}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
