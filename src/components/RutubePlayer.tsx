import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { ExternalLink, Film } from 'lucide-react';
import { extractVideoId } from '../utils/extractVideoId';
import { PlayerAdapter } from '../modules/sync';

export interface RutubePlayerRef extends PlayerAdapter {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isReady: () => boolean;
}

export interface RutubePlayerProps {
  videoUrl: string;
  videoId?: string;
  isPlaying?: boolean;
  targetTime?: number;
  onTimeUpdate?: (time: number, duration: number) => void;
  onReady?: () => void;
  onError?: (err: any) => void;
}

export const RutubePlayer = forwardRef<RutubePlayerRef, RutubePlayerProps>(({
  videoUrl,
  videoId,
  isPlaying,
  targetTime,
  onTimeUpdate,
  onReady,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedSrc, setEmbedSrc] = useState<string>('');
  const [localTime, setLocalTime] = useState<number>(0);
  const durationRef = useRef<number>(1800);
  const [isReadyState, setIsReadyState] = useState(false);

  // Construct iframe embed URL
  useEffect(() => {
    let id = videoId;
    if (!id) {
      const parsed = extractVideoId(videoUrl);
      if (parsed && parsed.platform === 'rutube') {
        id = parsed.id;
      }
    }

    if (id) {
      const cleanId = id.replace(/\/+$/, '');
      const src = `https://rutube.ru/play/embed/${cleanId}/?skinColor=7c3aed&autoplay=${isPlaying ? 1 : 0}`;
      setEmbedSrc(src);
    } else if (videoUrl.includes('rutube.ru/play/embed/')) {
      setEmbedSrc(videoUrl);
    } else {
      setEmbedSrc(videoUrl);
    }

    setIsReadyState(true);
    if (onReady) onReady();
  }, [videoUrl, videoId, onReady]);

  // PostMessage interface for Rutube
  const sendRutubeCommand = (type: string, data?: any) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      const message = JSON.stringify({
        type,
        data,
      });
      iframeRef.current.contentWindow.postMessage(message, '*');
    } catch (e) {
      console.warn('[RutubePlayer] postMessage error:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    isReady: () => isReadyState,
    play: () => {
      sendRutubeCommand('player:play');
    },
    pause: () => {
      sendRutubeCommand('player:pause');
    },
    seekTo: (seconds: number) => {
      setLocalTime(seconds);
      sendRutubeCommand('player:setCurrentTime', { time: seconds });
    },
    getCurrentTime: () => localTime,
    getDuration: () => durationRef.current,
  }), [localTime, isReadyState]);

  // Handle messages from Rutube Iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      try {
        let message = e.data;
        if (typeof message === 'string') {
          message = JSON.parse(message);
        }

        if (message.type === 'player:currentTime' && typeof message.data?.time === 'number') {
          const t = message.data.time;
          setLocalTime(t);
          if (onTimeUpdate) {
            onTimeUpdate(t, durationRef.current);
          }
        }

        if (message.type === 'player:durationChange' && typeof message.data?.duration === 'number') {
          durationRef.current = message.data.duration;
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTimeUpdate]);

  // Sync isPlaying state
  useEffect(() => {
    if (isPlaying) {
      sendRutubeCommand('player:play');
    } else {
      sendRutubeCommand('player:pause');
    }
  }, [isPlaying]);

  // Hard sync seek target with 0.7s drift limit
  useEffect(() => {
    if (typeof targetTime === 'number' && Math.abs(localTime - targetTime) > 0.7) {
      setLocalTime(targetTime);
      sendRutubeCommand('player:setCurrentTime', { time: targetTime });
    }
  }, [targetTime, localTime]);

  return (
    <div className="w-full h-full relative bg-zinc-950 flex flex-col items-center justify-center overflow-hidden rounded-xl shadow-2xl border border-zinc-800/80">
      {embedSrc ? (
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title="Rutube Video Player"
          className="w-full h-full min-h-[360px] border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;"
          allowFullScreen
        />
      ) : (
        <div className="p-8 text-center flex flex-col items-center justify-center text-zinc-400">
          <Film className="w-12 h-12 mb-3 text-purple-500 animate-pulse" />
          <p className="font-semibold text-zinc-200">Rutube Video загружается...</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Плеер подключен к пульту управления в режиме жесткой синхронизации.
          </p>
        </div>
      )}

      {/* External Link */}
      <div className="absolute top-3 right-3 z-10 opacity-60 hover:opacity-100 transition-opacity">
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg border border-white/10 text-xs flex items-center gap-1 backdrop-blur-md"
          title="Открыть оригинал Rutube"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">Rutube</span>
        </a>
      </div>
    </div>
  );
});

RutubePlayer.displayName = 'RutubePlayer';
export default RutubePlayer;
