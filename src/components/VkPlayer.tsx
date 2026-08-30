import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { ExternalLink, Film } from 'lucide-react';
import { extractVideoId } from '../utils/extractVideoId';
import { PlayerAdapter } from '../modules/sync';

export interface VkPlayerRef extends PlayerAdapter {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isReady: () => boolean;
}

export interface VkPlayerProps {
  videoUrl: string;
  videoId?: string;
  isPlaying?: boolean;
  targetTime?: number;
  onTimeUpdate?: (time: number, duration: number) => void;
  onReady?: () => void;
  onError?: (err: any) => void;
}

export const VkPlayer = forwardRef<VkPlayerRef, VkPlayerProps>(({
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
    let src = '';
    const parsed = extractVideoId(videoUrl);

    if (videoUrl.includes('vk.com/video_ext.php') || videoUrl.includes('vkvideo.ru/video_ext.php')) {
      src = videoUrl;
    } else if (parsed && parsed.platform === 'vk' && parsed.embedUrl) {
      src = parsed.embedUrl;
    } else if (videoId) {
      const parts = videoId.split('_');
      if (parts.length >= 2) {
        const oid = parts[0];
        const vid = parts[1];
        const hash = parts[2] || '';
        src = `https://vk.com/video_ext.php?oid=${oid}&id=${vid}${hash ? `&hash=${hash}` : ''}&autoplay=1&js_api=1`;
      }
    }

    if (!src && videoUrl) {
      src = videoUrl;
    }

    if (src && !src.includes('js_api=')) {
      src += (src.includes('?') ? '&' : '?') + 'js_api=1';
    }
    if (src && !src.includes('autoplay=')) {
      src += (src.includes('?') ? '&' : '?') + (isPlaying ? 'autoplay=1' : 'autoplay=0');
    }

    setEmbedSrc(src);
    setIsReadyState(true);
    if (onReady) onReady();
  }, [videoUrl, videoId, onReady]);

  // PostMessage interface for VK player iframe
  const sendVkCommand = (method: string, param?: any) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      const payload = JSON.stringify({ method, param });
      iframeRef.current.contentWindow.postMessage(payload, '*');
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ type: 'action', action: method, time: param }), '*');
    } catch (e) {
      console.warn('[VkPlayer] postMessage error:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    isReady: () => isReadyState,
    play: () => {
      sendVkCommand('play');
    },
    pause: () => {
      sendVkCommand('pause');
    },
    seekTo: (seconds: number) => {
      sendVkCommand('pause');
      setLocalTime(seconds);
      sendVkCommand('seek', seconds);
      if (isPlaying) {
        setTimeout(() => sendVkCommand('play'), 150);
      }
    },
    getCurrentTime: () => localTime,
    getDuration: () => durationRef.current,
    setPlaybackRate: (rate: number) => {
      sendVkCommand('playbackRate', rate);
      sendVkCommand('setPlaybackRate', rate);
    },
    getPlaybackRate: () => 1.0,
    isPlaying: () => Boolean(isPlaying),
  }), [localTime, isReadyState, isPlaying]);

  // Handle messages from VK Iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      try {
        let data = e.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data.event === 'timeupdate' && typeof data.time === 'number') {
          setLocalTime(data.time);
          if (typeof data.duration === 'number' && data.duration > 0) {
            durationRef.current = data.duration;
          }
          if (onTimeUpdate) {
            onTimeUpdate(data.time, durationRef.current);
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTimeUpdate]);

  // Sync isPlaying with VK player
  useEffect(() => {
    if (isPlaying) {
      sendVkCommand('play');
    } else {
      sendVkCommand('pause');
    }
  }, [isPlaying]);

  // Hard sync target time with 0.7s drift limit
  useEffect(() => {
    if (typeof targetTime === 'number' && Math.abs(localTime - targetTime) > 0.7) {
      sendVkCommand('pause');
      setLocalTime(targetTime);
      sendVkCommand('seek', targetTime);
      if (isPlaying) {
        setTimeout(() => sendVkCommand('play'), 150);
      }
    }
  }, [targetTime, localTime, isPlaying]);

  return (
    <div className="w-full h-full relative bg-zinc-950 flex flex-col items-center justify-center overflow-hidden rounded-xl shadow-2xl border border-zinc-800/80">
      {embedSrc ? (
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title="VK Video Player"
          className="w-full h-full min-h-[360px] border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;"
          allowFullScreen
        />
      ) : (
        <div className="p-8 text-center flex flex-col items-center justify-center text-zinc-400">
          <Film className="w-12 h-12 mb-3 text-purple-500 animate-pulse" />
          <p className="font-semibold text-zinc-200">VK Video загружается...</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Плеер подключен к пульту управления в режиме жесткой синхронизации.
          </p>
        </div>
      )}

      {/* Quick link button to open original in new tab if needed */}
      <div className="absolute top-3 right-3 z-10 opacity-60 hover:opacity-100 transition-opacity">
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg border border-white/10 text-xs flex items-center gap-1 backdrop-blur-md"
          title="Открыть оригинал VK"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">VK</span>
        </a>
      </div>
    </div>
  );
});

VkPlayer.displayName = 'VkPlayer';
export default VkPlayer;
