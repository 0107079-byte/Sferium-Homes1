import React, { useEffect, useRef, useState } from 'react';
import { SyncController } from '../plugins/videoSync';
import { VideoInfo } from '../types';
import { YouTubeAdapter } from '../lib/YouTubeAdapter';
import { VKAdapter } from '../lib/VKAdapter';
import { RutubeAdapter } from '../lib/RutubeAdapter';
import { DirectVideoAdapter } from '../lib/DirectVideoAdapter';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, ShieldAlert } from 'lucide-react';

interface UniversalPlayerProps {
  video: VideoInfo | null;
  syncController: SyncController | null;
  canControl: boolean;
  isHost: boolean;
}

export const UniversalPlayer: React.FC<UniversalPlayerProps> = ({
  video,
  syncController,
  canControl,
  isHost,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Initialize and bind player adapter to the single SyncController
  useEffect(() => {
    if (!video || !syncController) return;

    let adapter: any = null;
    setIsPlayerReady(false);

    if (video.provider === 'youtube') {
      const containerId = 'youtube-player-container';
      if (document.getElementById(containerId)) {
        adapter = new YouTubeAdapter(containerId, video.id, () => {
          setIsPlayerReady(true);
        });
      }
    } else if (video.provider === 'vk' && iframeRef.current) {
      adapter = new VKAdapter(iframeRef.current, () => {
        setIsPlayerReady(true);
      });
    } else if (video.provider === 'rutube' && iframeRef.current) {
      adapter = new RutubeAdapter(iframeRef.current, () => {
        setIsPlayerReady(true);
      });
    } else if (video.provider === 'direct' && videoRef.current) {
      adapter = new DirectVideoAdapter(videoRef.current, () => {
        setIsPlayerReady(true);
      });
    }

    if (adapter) {
      syncController.setAdapter(adapter);
    }

    return () => {
      if (adapter) {
        adapter.destroy();
        syncController.setAdapter(null);
      }
    };
  }, [video?.url, video?.provider, video?.id, syncController]);

  // Track progress locally for UI controls
  useEffect(() => {
    const timer = setInterval(() => {
      const state = syncController?.getLastKnownState();
      if (state) {
        setIsPlaying(state.playing);
        setPlaybackRate(state.playbackRate);
        const now = Date.now();
        const elapsed = state.playing ? Math.max(0, (now - state.serverTime) / 1000) * state.playbackRate : 0;
        setCurrentTime(state.position + elapsed);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [syncController]);

  const handlePlayPause = () => {
    if (!syncController || (!canControl && !isHost)) return;
    if (isPlaying) {
      syncController.handleUserCommand('pause');
    } else {
      syncController.handleUserCommand('play');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!syncController || (!canControl && !isHost)) return;
    const targetPos = parseFloat(e.target.value);
    setCurrentTime(targetPos);
    syncController.handleUserCommand('seek', targetPos);
  };

  const handleRateChange = (rate: number) => {
    if (!syncController || (!canControl && !isHost)) return;
    setPlaybackRate(rate);
    syncController.handleUserCommand('rate', undefined, rate);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderPlayer = () => {
    if (!video) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900 rounded-xl p-8 border border-slate-800">
          <Play className="w-16 h-16 text-purple-500 mb-4 opacity-70" />
          <h3 className="text-xl font-medium text-slate-200">Видео не выбрано</h3>
          <p className="text-sm text-slate-400 mt-1 text-center max-w-sm">
            Выберите видео из каталога или вставьте ссылку на YouTube, VK или Rutube
          </p>
        </div>
      );
    }

    if (video.provider === 'youtube') {
      return (
        <div className="w-full h-full relative bg-black rounded-xl overflow-hidden">
          <div id="youtube-player-container" className="w-full h-full" />
        </div>
      );
    }

    if (video.provider === 'vk') {
      const vkEmbedUrl = video.url.includes('embed') ? video.url : `https://vk.com/video_ext.php?oid=${video.id.split('_')[0]}&id=${video.id.split('_')[1]}&hash=`;
      return (
        <iframe
          ref={iframeRef}
          src={vkEmbedUrl}
          className="w-full h-full rounded-xl bg-black"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (video.provider === 'rutube') {
      const rutubeUrl = `https://rutube.ru/play/embed/${video.id}`;
      return (
        <iframe
          ref={iframeRef}
          src={rutubeUrl}
          className="w-full h-full rounded-xl bg-black"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (video.provider === 'direct') {
      return (
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full rounded-xl bg-black"
          playsInline
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Player Canvas */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center" ref={containerRef}>
        {renderPlayer()}

        {!canControl && !isHost && (
          <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 shadow-lg">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Синхронизация от Хоста</span>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-slate-900/90 backdrop-blur p-4 border-t border-slate-800 flex flex-col gap-3">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 min-w-[40px]">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 1800}
            step="0.5"
            value={currentTime}
            onChange={handleSeek}
            disabled={!canControl && !isHost}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-xs font-mono text-slate-400 min-w-[40px]">{formatTime(duration || 1800)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              disabled={!canControl && !isHost}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              title={isPlaying ? 'Пауза (SYNC_COMMAND)' : 'Воспроизведение (SYNC_COMMAND)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              <span className="text-xs pr-1">{isPlaying ? 'Пауза' : 'Играть'}</span>
            </button>

            <button
              onClick={() => syncController?.handleUserCommand('seek', 0)}
              disabled={!canControl && !isHost}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition active:scale-95 disabled:opacity-40"
              title="В начало (SYNC_COMMAND)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Playback Rate Selector */}
            <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 ml-2">
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleRateChange(rate)}
                  disabled={!canControl && !isHost}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                    playbackRate === rate
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
