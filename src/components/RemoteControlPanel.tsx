import React, { useState, useEffect, useRef } from "react";
import { 
  Sliders, 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Lock, 
  Unlock as LockOpen, 
  ChevronDown, 
  ChevronUp, 
  Radio, 
  Tv, 
  FastForward, 
  Rewind,
  Activity
} from "lucide-react";
import { RoomState } from "../types";

interface RemoteControlPanelProps {
  roomState: RoomState | null;
  localTime: number;
  videoDuration: number;
  isHost: boolean;
  canIControl: boolean;
  anyoneCanControl: boolean;
  formatTime: (secs: number) => string;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSkipTime: (seconds: number) => void;
  onForceSyncAll?: () => void;
  onToggleControlMode?: () => void;
}

export const RemoteControlPanel: React.FC<RemoteControlPanelProps> = React.memo(({
  roomState,
  localTime,
  videoDuration,
  isHost,
  canIControl,
  anyoneCanControl,
  formatTime,
  onPlay,
  onPause,
  onSeek,
  onSkipTime,
  onForceSyncAll,
  onToggleControlMode,
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      return false;
    }
    return true;
  });

  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  if (!roomState) return null;

  // Host is source of truth: Guests see hostTime and hostPlaying
  const hostTime = isHost ? (localTime || 0) : (roomState.hostTime ?? roomState.currentTime ?? localTime ?? 0);
  const isPlaying = roomState.hostPlaying !== undefined ? roomState.hostPlaying : (roomState.playing ?? false);
  const maxDur = videoDuration > 0 ? videoDuration : Math.max((hostTime || 0) + 300, 3600);
  const displayTime = isDraggingSeek ? dragTime : hostTime;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / maxDur) * 100));

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDragTime(val);
    if (!isDraggingSeek) setIsDraggingSeek(true);
  };

  const handleSeekCommit = () => {
    setIsDraggingSeek(false);
    onSeek(dragTime);
  };

  return (
    <div className="w-full my-2 bg-gradient-to-b from-zinc-950/90 to-zinc-900/90 border border-zinc-800/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transition-all duration-300 relative backdrop-blur-md">
      
      {/* Dropdown Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-gradient-to-r from-zinc-900/90 via-purple-950/30 to-zinc-900/90 hover:from-zinc-850 hover:to-zinc-850 flex items-center justify-between transition-colors cursor-pointer text-left border-b border-zinc-800/60"
      >
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-xs uppercase tracking-wider text-white">
                🎮 Пульт Управления (Мастер-Время)
              </span>
              <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400"}`} />
            </div>
            <p className="text-[10px] text-white font-bold font-mono flex items-center gap-1.5 mt-0.5">
              <span className="text-indigo-300 font-extrabold">{formatTime(displayTime)} / {formatTime(maxDur)}</span>
              <span>•</span>
              <span className={anyoneCanControl ? "text-emerald-300 font-bold" : "text-amber-300 font-bold"}>
                {anyoneCanControl ? "🔓 Доступен всем" : "🔒 Только Создатель"}
              </span>
              <span>•</span>
              <span className="text-pink-300 font-mono text-[9px]">
                {isPlaying ? "⚡ Вещание активно" : "⏸ Пауза"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-2 py-1 rounded-lg uppercase tracking-wider inline-block shadow-sm">
            {isOpen ? "Свернуть" : "Открыть"}
          </span>
          <div className="p-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Dropdown Content */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4 bg-zinc-950/95 animate-fade-in">
          
          {canIControl ? (
            <div className="space-y-4">
              
              {/* Screen / CRT Master Status Box */}
              <div className="bg-black/90 border border-zinc-800/90 rounded-2xl p-4 flex flex-col justify-between relative shadow-inner overflow-hidden font-mono text-zinc-300 select-none">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none opacity-25" />
                
                <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-widest relative z-10">
                  <span className="flex items-center gap-1.5 font-bold text-indigo-300">
                    <Radio className="w-3 h-3 text-fuchsia-400 animate-pulse" />
                    {roomState.provider ? `${roomState.provider.toUpperCase()} • ВЕДУЩИЙ ИСТОЧНИК` : "SFERIUM STREAM • MASTER"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
                      <Activity className="w-3 h-3 animate-spin" />
                      ЖЕСТКИЙ СИНХРОН (±0.2с)
                    </span>
                    <span className={`px-2.5 py-0.5 rounded font-bold text-[9px] ${isPlaying ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-amber-950/80 text-amber-300 border border-amber-500/40"}`}>
                      {isPlaying ? "PLAYING" : "PAUSED"}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-center gap-2 py-2 text-center relative z-10">
                  <span className="text-2xl sm:text-4xl font-black font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                    {formatTime(displayTime)}
                  </span>
                  <span className="text-xs text-zinc-600">/</span>
                  <span className="text-sm font-semibold text-zinc-500">
                    {formatTime(maxDur)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden relative border border-zinc-900 z-10 mt-1">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full shadow-[0_0_12px_rgba(236,72,153,0.8)] transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Timeline Slider with Smooth Scrubbing */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                  <span>00:00</span>
                  <span className="text-indigo-400">Ведущий таймлайн пульта (секунды вещаются в плеер)</span>
                  <span>{formatTime(maxDur)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxDur}
                  step={0.5}
                  value={displayTime}
                  onChange={handleSeekChange}
                  onMouseUp={handleSeekCommit}
                  onTouchEnd={handleSeekCommit}
                  className="w-full h-3 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none border border-zinc-800 shadow-inner"
                  title="Перемотка видео пульта"
                />
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSkipTime(-30)}
                  className="hidden sm:flex py-3 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 rounded-2xl border border-zinc-800 flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                  title="Назад на 30 секунд"
                >
                  <Rewind className="w-4 h-4 mb-0.5 text-zinc-400" />
                  <span className="text-[10px] font-black font-mono">-30с</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSkipTime(-10)}
                  className="py-3 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                  title="Назад на 10 секунд"
                >
                  <span className="text-xs font-black font-mono text-zinc-200">-10с</span>
                  <span className="text-[7px] text-zinc-500 font-mono tracking-wider mt-0.5 uppercase">SEEK BACK</span>
                </button>

                <button
                  type="button"
                  onClick={isPlaying ? onPause : onPlay}
                  className={`py-3.5 rounded-2xl border flex flex-col items-center justify-center text-white transition-all cursor-pointer shadow-lg active:translate-y-0.5 ${
                    isPlaying 
                      ? "bg-gradient-to-tr from-amber-600 to-rose-600 border-amber-400/50 shadow-amber-900/40 hover:brightness-110" 
                      : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 border-purple-400/50 shadow-purple-900/40 hover:brightness-110"
                  }`}
                  title={isPlaying ? "Пауза" : "Воспроизведение"}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                  <span className="text-[8px] font-mono font-bold tracking-widest mt-1 uppercase">
                    {isPlaying ? "PAUSE" : "PLAY"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSkipTime(10)}
                  className="py-3 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                  title="Вперед на 10 секунд"
                >
                  <span className="text-xs font-black font-mono text-zinc-200">+10с</span>
                  <span className="text-[7px] text-zinc-500 font-mono tracking-wider mt-0.5 uppercase">SEEK FWD</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSkipTime(30)}
                  className="hidden sm:flex py-3 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 rounded-2xl border border-zinc-800 flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                  title="Вперед на 30 секунд"
                >
                  <FastForward className="w-4 h-4 mb-0.5 text-zinc-400" />
                  <span className="text-[10px] font-black font-mono">+30с</span>
                </button>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSeek(0)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs rounded-xl border border-zinc-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Перемотать в самое начало"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>В начало (00:00)</span>
                </button>

                {isHost && onToggleControlMode && (
                  <button
                    type="button"
                    onClick={onToggleControlMode}
                    className="w-full sm:flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs rounded-xl border border-zinc-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Изменить режим доступа к пульту"
                  >
                    {anyoneCanControl ? (
                      <>
                        <LockOpen className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Свободный доступ для всех</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Управление только у Создателя</span>
                      </>
                    )}
                  </button>
                )}

                {isHost && onForceSyncAll && (
                  <button
                    type="button"
                    onClick={onForceSyncAll}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl border border-purple-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 active:translate-y-0.5 uppercase tracking-wider"
                    title="Принудительно переместить всех участников на вашу секунду"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
                    <span>Синхронизировать всех</span>
                  </button>
                )}
              </div>

            </div>
          ) : (
            /* Locked State Overlay */
            <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
                <Lock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-widest text-zinc-200 uppercase">
                  Пульт Заблокирован
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Создатель зафиксировал управление. Плеер жёстко привязан к времени ведущего пульта.
                </p>
              </div>
              <div className="font-mono text-xs text-indigo-400 font-bold bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                Текущий эфир: {formatTime(displayTime)}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
});

export default RemoteControlPanel;
