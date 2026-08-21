import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Member } from '../types';
import { syncSocket } from '../ws/socket';
import {
  Crown,
  Power,
  MicOff,
  Mic,
  Radio,
  UserX,
  VolumeX,
  Volume2,
  Unlock,
  Lock,
  ChevronDown,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Users,
  Copy,
  Check,
  UserCheck
} from 'lucide-react';

export interface HostPanelProps {
  roomId: string;
  isHost: boolean;
  members: Member[] | Record<string, Member>;
  currentUserId: string;
  anyoneCanControl?: boolean;
  onCloseRoom: () => void;
  onKickUser: (userId: string, reason?: string) => void;
  onMuteUser: (userId: string, isMuted: boolean) => void;
  onStartBroadcast: (options: { mic?: boolean; videoUrl?: string; playing?: boolean }) => void;
  onTransferHost?: (userId: string) => void;
  onToggleControl?: () => void;
  onMuteBroadcast?: (isMuted: boolean) => void;
  onRestrictControls?: (restricted: boolean) => void;
}

export const HostPanel: React.FC<HostPanelProps> = ({
  roomId,
  isHost,
  members,
  currentUserId,
  anyoneCanControl = false,
  onCloseRoom,
  onKickUser,
  onMuteUser,
  onStartBroadcast,
  onTransferHost,
  onToggleControl,
  onMuteBroadcast,
  onRestrictControls,
}) => {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isBroadcastingNoMic, setIsBroadcastingNoMic] = useState(false);
  const [selectedGuestForTransfer, setSelectedGuestForTransfer] = useState<string | null>(null);
  const [selectedGuestForKick, setSelectedGuestForKick] = useState<string | null>(null);
  const [kickReason, setKickReason] = useState('Нарушение правил зала');
  const [copiedLink, setCopiedLink] = useState(false);

  // Strict rule: Panel is ONLY visible to the host
  if (!isHost) {
    return null;
  }

  const memberList: Member[] = Array.isArray(members)
    ? members
    : Object.values(members || {});

  const guests = memberList.filter((m) => m.userId !== currentUserId);

  // 🔹 Action 1: Broadcast without mic
  const handleToggleBroadcastNoMic = () => {
    const nextState = !isBroadcastingNoMic;
    setIsBroadcastingNoMic(nextState);

    // Send WebSocket event room:muteBroadcast
    syncSocket.sendMuteBroadcast(nextState);
    if (onMuteBroadcast) {
      onMuteBroadcast(nextState);
    }
    onStartBroadcast({ mic: !nextState, playing: true });
  };

  // 🔹 Action 2: Playback Control toggle
  const handleTogglePlaybackControl = () => {
    const nextRestricted = anyoneCanControl; // If currently anyone can control, we restrict to host only
    
    // Send WebSocket event video:restrictControls
    syncSocket.sendRestrictControls(nextRestricted);
    if (onRestrictControls) {
      onRestrictControls(nextRestricted);
    }
    if (onToggleControl) {
      onToggleControl();
    }
  };

  // 🔹 Action 3: Guest Management
  const handleMuteGuest = (targetUserId: string, currentlyMuted: boolean) => {
    const nextMute = !currentlyMuted;
    syncSocket.sendGuestAction('mute', targetUserId, { isMuted: nextMute });
    onMuteUser(targetUserId, nextMute);
  };

  const handleConfirmKick = () => {
    if (!selectedGuestForKick) return;
    syncSocket.sendGuestAction('kick', selectedGuestForKick, { reason: kickReason });
    onKickUser(selectedGuestForKick, kickReason);
    setSelectedGuestForKick(null);
  };

  const handleConfirmTransfer = (targetUserId: string) => {
    syncSocket.sendGuestAction('transferHost', targetUserId);
    if (onTransferHost) {
      onTransferHost(targetUserId);
    }
    setSelectedGuestForTransfer(null);
  };

  // 🔹 Action 4: Close Room
  const handleConfirmCloseRoom = () => {
    syncSocket.closeRoom();
    onCloseRoom();
    setShowCloseConfirm(false);
  };

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/room/${roomId.toUpperCase()}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <motion.div
      id="host-control-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-gradient-to-b from-zinc-950 via-zinc-900/90 to-zinc-950 border border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden space-y-4"
    >
      {/* Background Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-amber-400">
              <Crown className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-black text-white tracking-wide">
                Панель управления создателя 👑
              </h2>
              <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 text-[10px] font-mono font-black border border-amber-400/40 uppercase">
                HOST
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Комната #{roomId} • {memberList.length} участников
            </p>
          </div>
        </div>

        {/* Red Close Room Button (Header Action) */}
        <button
          type="button"
          id="btn-host-close-room-header"
          onClick={() => setShowCloseConfirm(true)}
          className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/40 cursor-pointer"
          title="Закрыть комнату для всех участников"
        >
          <Power className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Закрыть</span>
        </button>
      </div>

      {/* 🔹 Section 1: Эфир без микрофона (Blue Theme) */}
      <div className="p-3.5 bg-zinc-900/80 border border-blue-500/30 rounded-2xl relative overflow-hidden shadow-md">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                Эфир без микрофона
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                  isBroadcastingNoMic
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {isBroadcastingNoMic ? 'Активен' : 'Неактивен'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300">
              Запуск трансляции с отключенным микрофоном
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-broadcast-no-mic"
          onClick={handleToggleBroadcastNoMic}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
            isBroadcastingNoMic
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30 ring-2 ring-blue-400/50'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20'
          }`}
        >
          <MicOff className="w-4 h-4" />
          <span>
            {isBroadcastingNoMic
              ? '🎙 Эфир без микрофона активен'
              : '🎙 Включить эфир без микрофона'}
          </span>
        </button>
      </div>

      {/* 🔹 Section 2: Управление плеером (Gold / Amber Theme) */}
      <div className="p-3.5 bg-zinc-900/80 border border-amber-500/30 rounded-2xl relative overflow-hidden shadow-md">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                {anyoneCanControl ? (
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                )}
                Управление плеером
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                  anyoneCanControl
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}
              >
                {anyoneCanControl ? 'Доступно всем' : 'Только хост'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300">
              {anyoneCanControl
                ? 'Все участники могут перематывать видео'
                : 'Только хост может перематывать видео'}
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-host-toggle-control"
          onClick={handleTogglePlaybackControl}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
            anyoneCanControl
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 shadow-amber-500/20'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 shadow-amber-500/20'
          }`}
        >
          {anyoneCanControl ? (
            <>
              <Lock className="w-4 h-4 text-zinc-950" />
              <span>🔒 Ограничить (только хост)</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4 text-zinc-950" />
              <span>🔓 Разрешить всем</span>
            </>
          )}
        </button>
      </div>

      {/* 🔹 Section 3: Быстрое управление гостями */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[11px] font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            Быстрое управление гостями ({guests.length})
          </h4>
          {guests.length > 0 && (
            <span className="text-[10px] text-zinc-500 font-mono">
              Mute • Kick • Transfer
            </span>
          )}
        </div>

        {guests.length === 0 ? (
          <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl text-center space-y-2">
            <p className="text-xs text-zinc-400 font-medium">
              В комнате пока нет гостей. Пригласите друзей по ссылке зала!
            </p>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Ссылка скопирована!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Скопировать ссылку</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-0.5">
            {guests.map((guest) => {
              const isMuted = Boolean(guest.isMutedByMod);
              return (
                <div
                  key={guest.userId}
                  className="p-3 bg-zinc-900/90 hover:bg-zinc-850/90 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-sm"
                >
                  {/* Guest Info */}
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0 shadow-md"
                      style={{
                        backgroundColor: `${guest.color || '#a855f7'}25`,
                        borderColor: `${guest.color || '#a855f7'}50`,
                      }}
                    >
                      {guest.avatar || '🍿'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate max-w-[130px]">
                          {guest.name}
                        </span>
                        {isMuted && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/30">
                            Мут
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {guest.userId.substring(0, 8)}
                      </p>
                    </div>
                  </div>

                  {/* Guest Action Buttons: Mute, Kick, Transfer */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* Mute Button */}
                    <button
                      type="button"
                      onClick={() => handleMuteGuest(guest.userId, isMuted)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                        isMuted
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                          : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border-zinc-700 hover:text-white'
                      }`}
                      title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
                    >
                      {isMuted ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Unmute</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          <span>Mute</span>
                        </>
                      )}
                    </button>

                    {/* Kick Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedGuestForKick(guest.userId)}
                      className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Исключить участника из зала"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-400" />
                      <span>Kick</span>
                    </button>

                    {/* Transfer Host Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedGuestForTransfer(guest.userId)}
                      className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Передать права Создателя"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Transfer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔹 Section 4: Кнопка закрытия комнаты (Red Theme) */}
      <div className="pt-2 border-t border-zinc-800/80">
        <button
          type="button"
          id="btn-host-close-room"
          onClick={() => setShowCloseConfirm(true)}
          className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl shadow-rose-950/50"
        >
          <Power className="w-4 h-4" />
          <span>Закрыть комнату</span>
        </button>
      </div>

      {/* Modal: Confirmation for Room Close */}
      <AnimatePresence>
        {showCloseConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-rose-500/40 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 relative z-10"
            >
              <div className="flex items-center space-x-3 text-rose-400">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Закрыть комнату?</h3>
                  <p className="text-xs text-zinc-400">Это действие нельзя отменить</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                При закрытии комнаты история чата и текущий сеанс просмотра будут завершены. Все участники будут возвращены в лобби.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  id="btn-confirm-close-room"
                  onClick={handleConfirmCloseRoom}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white transition-all cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  Да, закрыть комнату
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmation for Kick */}
      <AnimatePresence>
        {selectedGuestForKick && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-rose-500/40 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 relative z-10"
            >
              <div className="flex items-center space-x-3 text-rose-400">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Исключить участника?</h3>
                  <p className="text-xs text-zinc-400">Укажите причину кика</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Причина исключения
                </label>
                <input
                  type="text"
                  value={kickReason}
                  onChange={(e) => setKickReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedGuestForKick(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmKick}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  Исключить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmation for Transfer Host */}
      <AnimatePresence>
        {selectedGuestForTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-amber-500/40 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 relative z-10"
            >
              <div className="flex items-center space-x-3 text-amber-400">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Передать статус Создателя?</h3>
                  <p className="text-xs text-zinc-400">Вы потеряете полный контроль над залом</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Выбранный участник получит статус Создателя комнаты (Host) и права управления видео, трансляцией и участниками.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedGuestForTransfer(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmTransfer(selectedGuestForTransfer)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Передать права
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HostPanel;
