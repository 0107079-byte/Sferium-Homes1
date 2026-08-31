import React, { useState, useEffect } from 'react';
import { voiceManager } from '../modules/voice';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Radio } from 'lucide-react';

interface VoicePanelProps {
  onStatusChange?: (status: { isMuted: boolean; isDeafened: boolean; isSpeaking: boolean; isVideoOn: boolean }) => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({ onStatusChange }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    voiceManager.setSpeakingCallback((speaking) => {
      setIsSpeaking(speaking);
      onStatusChange?.({ isMuted, isDeafened, isSpeaking: speaking, isVideoOn: isCameraOn });
    });

    return () => {
      voiceManager.stop();
    };
  }, [isMuted, isDeafened, isCameraOn]);

  const handleToggleVoice = async () => {
    if (!isActive) {
      const stream = await voiceManager.startMicrophone();
      if (stream) {
        setIsActive(true);
      }
    } else {
      voiceManager.stop();
      setIsActive(false);
      setIsSpeaking(false);
    }
  };

  const handleToggleMute = () => {
    const muted = voiceManager.toggleMute();
    setIsMuted(muted);
    onStatusChange?.({ isMuted: muted, isDeafened, isSpeaking, isVideoOn: isCameraOn });
  };

  const handleToggleDeafen = () => {
    const deaf = voiceManager.toggleDeafen();
    setIsDeafened(deaf);
    onStatusChange?.({ isMuted, isDeafened: deaf, isSpeaking, isVideoOn: isCameraOn });
  };

  const handleToggleCamera = async () => {
    const cam = await voiceManager.toggleCamera();
    setIsCameraOn(cam);
    onStatusChange?.({ isMuted, isDeafened, isSpeaking, isVideoOn: cam });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${isActive ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400'}`}>
          <Radio className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-200">Голосовой чат P2P</span>
          <span className="text-[10px] text-slate-400">
            {isActive ? (isSpeaking ? '🟢 Говорите...' : 'Подключено') : 'Отключено'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {!isActive ? (
          <button
            onClick={handleToggleVoice}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition"
          >
            Войти в голос
          </button>
        ) : (
          <>
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-lg transition ${isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
              title={isMuted ? 'Включить микрофон' : 'Заглушить микрофон'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleToggleDeafen}
              className={`p-2 rounded-lg transition ${isDeafened ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
              title={isDeafened ? 'Включить звук' : 'Заглушить звук'}
            >
              {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleToggleCamera}
              className={`p-2 rounded-lg transition ${isCameraOn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
              title={isCameraOn ? 'Выключить камеру' : 'Включить камеру'}
            >
              {isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleToggleVoice}
              className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition ml-1"
            >
              Выйти
            </button>
          </>
        )}
      </div>
    </div>
  );
};
