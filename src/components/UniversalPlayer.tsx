import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Play, Maximize } from 'lucide-react';
import { VideoProvider } from '../types';
import { extractVideoId } from '../utils/extractVideoId';
import { seekSafe, syncEngine, PlayerAdapter } from '../modules/sync';
import { syncSocket } from '../ws/socket';
import { VideoSyncPlugin, UnifiedPlayer } from '../plugins/videoSync';

export interface UniversalPlayerRef extends PlayerAdapter {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  play: () => void;
  pause: () => void;
  isReady: () => boolean;
  getDuration: () => number;
  provider?: string;
}

interface UniversalPlayerProps {
  roomId?: string;
  userId?: string;
  videoUrl: string;
  provider: VideoProvider;
  videoId?: string;
  playing: boolean;
  currentTime: number;
  isHost: boolean;
  anyoneCanControl?: boolean;
  ws?: WebSocket | null;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onStreamRequest?: (streamUrl: string) => void;
}

export const UniversalPlayer = forwardRef<UniversalPlayerRef, UniversalPlayerProps>(({
  roomId,
  videoUrl,
  provider,
  videoId: propVideoId,
  playing,
  currentTime,
  isHost,
  ws,
  onPlay,
  onPause,
  onSeek,
  onTimeUpdate,
  onDurationChange,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [internalTime, setInternalTime] = useState<number>(currentTime);
  const durationRef = useRef<number>(1800);

  const lastSyncedTimeRef = useRef<number>(currentTime);
  const isHostRef = useRef<boolean>(isHost);
  const playingRef = useRef<boolean>(playing);
  const currentTimeRef = useRef<number>(currentTime);
  const providerRef = useRef<VideoProvider>(provider);

  useEffect(() => {
    isHostRef.current = isHost;
    playingRef.current = playing;
    currentTimeRef.current = currentTime;
    providerRef.current = provider;
  }, [isHost, playing, currentTime, provider]);

  const extractedId = propVideoId || extractVideoId(videoUrl)?.id || '';

  // Send postMessage commands to iframe players (VK, YouTube, Rutube, Dzen)
  const sendIframeCommand = useCallback((action: 'play' | 'pause' | 'seek' | 'rate', timeOrRate?: number) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    const win = iframe.contentWindow;

    try {
      if (provider === 'vk') {
        if (action === 'play') {
          win.postMessage(JSON.stringify({ method: 'play' }), '*');
          win.postMessage(JSON.stringify({ type: 'action', action: 'play' }), '*');
          win.postMessage(JSON.stringify({ event: 'play' }), '*');
        } else if (action === 'pause') {
          win.postMessage(JSON.stringify({ method: 'pause' }), '*');
          win.postMessage(JSON.stringify({ type: 'action', action: 'pause' }), '*');
          win.postMessage(JSON.stringify({ event: 'pause' }), '*');
        } else if (action === 'seek' && timeOrRate !== undefined) {
          // VK seek logic: pause -> seek -> resume after 150ms if playing
          win.postMessage(JSON.stringify({ method: 'pause' }), '*');
          win.postMessage(JSON.stringify({ method: 'seek', param: timeOrRate }), '*');
          win.postMessage(JSON.stringify({ type: 'action', action: 'seek', time: timeOrRate }), '*');
          win.postMessage(JSON.stringify({ event: 'seek', time: timeOrRate }), '*');
          if (playingRef.current) {
            setTimeout(() => {
              win.postMessage(JSON.stringify({ method: 'play' }), '*');
            }, 150);
          }
        }
      } else if (provider === 'youtube') {
        if (action === 'play') {
          win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        } else if (action === 'pause') {
          win.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        } else if (action === 'seek' && timeOrRate !== undefined) {
          win.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [timeOrRate, true] }), '*');
        } else if (action === 'rate' && timeOrRate !== undefined) {
          win.postMessage(JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [timeOrRate] }), '*');
        }
      } else if (provider === 'rutube') {
        if (action === 'play') {
          win.postMessage(JSON.stringify({ type: 'player:play' }), '*');
        } else if (action === 'pause') {
          win.postMessage(JSON.stringify({ type: 'player:pause' }), '*');
        } else if (action === 'seek' && timeOrRate !== undefined) {
          win.postMessage(JSON.stringify({ type: 'player:setCurrentTime', data: { time: timeOrRate } }), '*');
          win.postMessage(JSON.stringify({ type: 'player:changeTime', data: { time: timeOrRate } }), '*');
        } else if (action === 'rate' && timeOrRate !== undefined) {
          win.postMessage(JSON.stringify({ type: 'player:changePlaybackRate', data: { rate: timeOrRate } }), '*');
        }
      } else if (provider === 'yandex') {
        if (action === 'play') {
          win.postMessage(JSON.stringify({ command: 'play' }), '*');
        } else if (action === 'pause') {
          win.postMessage(JSON.stringify({ command: 'pause' }), '*');
        } else if (action === 'seek' && timeOrRate !== undefined) {
          win.postMessage(JSON.stringify({ command: 'seek', time: timeOrRate }), '*');
        }
      }
    } catch (e) {
      console.warn('[UniversalPlayer] sendIframeCommand error:', e);
    }
  }, [provider]);

  const playbackRateRef = useRef<number>(1.0);

  // Imperative player adapter handle for strict master remote control
  const playerAdapter: UniversalPlayerRef = {
    provider,
    isReady: () => isPlayerReady || (provider === 'direct' ? Boolean(videoRef.current) : true),
    getCurrentTime: () => {
      if (videoRef.current) {
        return videoRef.current.currentTime || internalTime;
      }
      return internalTime;
    },
    seekTo: (seconds: number) => {
      setInternalTime(seconds);
      lastSyncedTimeRef.current = seconds;
      if (videoRef.current) {
        if (provider === 'vk') {
          videoRef.current.pause();
          videoRef.current.currentTime = seconds;
          if (playingRef.current) {
            setTimeout(() => videoRef.current?.play().catch(() => {}), 150);
          }
        } else {
          videoRef.current.currentTime = seconds;
        }
      }
      sendIframeCommand('seek', seconds);
    },
    play: () => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      sendIframeCommand('play');
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      sendIframeCommand('pause');
    },
    getDuration: () => {
      if (videoRef.current && videoRef.current.duration) {
        return videoRef.current.duration;
      }
      return durationRef.current;
    },
    setPlaybackRate: (rate: number) => {
      playbackRateRef.current = rate;
      if (videoRef.current && rate > 0) {
        videoRef.current.playbackRate = rate;
      }
      sendIframeCommand('rate', rate);
    },
    getPlaybackRate: () => {
      if (videoRef.current) {
        return videoRef.current.playbackRate || 1.0;
      }
      return playbackRateRef.current;
    },
    isPlaying: () => {
      if (videoRef.current) return !videoRef.current.paused;
      return playingRef.current;
    },
  };

  useImperativeHandle(ref, () => playerAdapter, [isPlayerReady, internalTime, sendIframeCommand, provider]);

  // Bind player to sync engine
  useEffect(() => {
    syncEngine.bindPlayer(playerAdapter);
    syncEngine.setMaster(isHost);
    return () => {
      syncEngine.bindPlayer(null);
    };
  }, [internalTime, isPlayerReady, sendIframeCommand, isHost, provider]);

  // Mark player as ready on URL mount
  useEffect(() => {
    setIsPlayerReady(false);
    const timer = setTimeout(() => {
      setIsPlayerReady(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [videoUrl, provider]);

  // VideoSyncPlugin Lifecycle: Replaces legacy fragmented intervals with unified sub-second sync engine
  const pluginRef = useRef<VideoSyncPlugin | null>(null);

  useEffect(() => {
    if (!ws) return;

    const unified: UnifiedPlayer = {
      play: () => playerAdapter.play(),
      pause: () => playerAdapter.pause(),
      seekTo: (seconds: number) => playerAdapter.seekTo(seconds),
      getCurrentTime: () => playerAdapter.getCurrentTime(),
      getDuration: () => playerAdapter.getDuration(),
      setPlaybackRate: (rate: number) => {
        playbackRateRef.current = rate;
        if (videoRef.current) videoRef.current.playbackRate = rate;
        sendIframeCommand('rate', rate);
      },
      getPlaybackRate: () => {
        if (videoRef.current) return videoRef.current.playbackRate || 1.0;
        return playbackRateRef.current;
      },
      isPlaying: () => {
        if (videoRef.current) return !videoRef.current.paused;
        return playingRef.current;
      },
      isReady: () => playerAdapter.isReady(),
    };

    const plugin = new VideoSyncPlugin(unified, ws, isHost, roomId || 'CINEMA');
    pluginRef.current = plugin;
    plugin.start();

    return () => {
      plugin.stop();
      pluginRef.current = null;
    };
  }, [ws, isHost, roomId, provider, isPlayerReady]);

  // Host notification hooks for immediate event broadcast
  useEffect(() => {
    if (pluginRef.current) {
      pluginRef.current.updateHostStatus(isHost);
      if (roomId) pluginRef.current.updateRoomId(roomId);
    }
  }, [isHost, roomId]);

  // 4. Listen for iframe postMessage events (VK, YouTube, Rutube, Dzen) with origin verification
  useEffect(() => {
    const ALLOWED_ORIGIN_PATTERNS = [
      /https:\/\/(www\.)?youtube\.com/,
      /https:\/\/(www\.)?youtube-nocookie\.com/,
      /https:\/\/(www\.)?vk\.com/,
      /https:\/\/(www\.)?rutube\.ru/,
      /https:\/\/(www\.)?dzen\.ru/,
      /https:\/\/(www\.)?ok\.ru/,
      /https:\/\/yastatic\.net/,
    ];

    const isAllowedOrigin = (origin: string) => {
      if (!origin || origin === 'null' || origin === window.location.origin) return true;
      return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
    };

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (event.origin && !isAllowedOrigin(event.origin)) {
          return;
        }

        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            return;
          }
        }
        if (!data || typeof data !== 'object') return;

        let cur: number | undefined = undefined;
        let dur: number | undefined = undefined;

        // YouTube infoDelivery
        if (data.info && typeof data.info === 'object') {
          if (typeof data.info.currentTime === 'number') cur = data.info.currentTime;
          if (typeof data.info.duration === 'number') dur = data.info.duration;
        }

        // VK / Rutube data formats
        if (Array.isArray(data.data)) {
          if (typeof data.data[0] === 'number') cur = data.data[0];
          if (typeof data.data[1] === 'number') dur = data.data[1];
        } else if (data.data && typeof data.data === 'object') {
          if (typeof data.data.time === 'number') cur = data.data.time;
          if (typeof data.data.currentTime === 'number') cur = data.data.currentTime;
          if (typeof data.data.duration === 'number') dur = data.data.duration;
        }

        // Direct root fields
        if (typeof data.currentTime === 'number') cur = data.currentTime;
        if (typeof data.time === 'number') cur = data.time;
        if (typeof data.duration === 'number') dur = data.duration;

        if (cur !== undefined && !isNaN(cur) && cur >= 0) {
          setInternalTime(cur);
          // Only update UI timeline, never override the master remote
          onTimeUpdate?.(cur);
        }
        if (dur !== undefined && !isNaN(dur) && dur > 0) {
          durationRef.current = dur;
          onDurationChange?.(dur);
        }
      } catch (err) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [onTimeUpdate, onDurationChange]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setInternalTime(cur);
      if (onTimeUpdate) {
        onTimeUpdate(cur);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && onDurationChange) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && dur !== Infinity) {
        durationRef.current = dur;
        onDurationChange(dur);
      }
    }
  };

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!videoUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] bg-zinc-950 border border-zinc-850 rounded-3xl text-zinc-500 p-6 text-center space-y-3">
        <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
          <Play className="w-8 h-8 stroke-1" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Плеер готов к трансляции</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            Откройте панель выше и вставьте ссылку на видео (VK, YouTube, Rutube или MP4 файл). Плеер жёстко привязан к пульту управления.
          </p>
        </div>
      </div>
    );
  }

  // YouTube Embed
  if (provider === 'youtube') {
    const embedUrl = `https://www.youtube.com/embed/${extractedId}?autoplay=${playing ? 1 : 0}&start=${Math.floor(currentTime)}&enablejsapi=1&rel=0`;
    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[320px] bg-black rounded-3xl overflow-hidden border border-zinc-850 shadow-2xl">
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full min-h-[320px] border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube Video"
        />
      </div>
    );
  }

  // VK Video Embed
  if (provider === 'vk') {
    let vkOid = '';
    let vkId = '';
    let vkHash = '';

    if (extractedId.includes('_')) {
      const parts = extractedId.split('_');
      vkOid = parts[0];
      vkId = parts[1];
      if (parts[2]) vkHash = parts[2];
    }

    const vkEmbedUrl = `https://vk.com/video_ext.php?oid=${vkOid}&id=${vkId}${vkHash ? `&hash=${vkHash}` : ''}&autoplay=${playing ? 1 : 0}&js_api=1`;

    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[320px] bg-black rounded-3xl overflow-hidden border border-zinc-850 shadow-2xl">
        <iframe
          ref={iframeRef}
          src={vkEmbedUrl}
          className="w-full h-full min-h-[320px] border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer"
          allowFullScreen
          title="VK Video"
        />
      </div>
    );
  }

  // Rutube Video Embed
  if (provider === 'rutube') {
    const rutubeUrl = `https://rutube.ru/play/embed/${extractedId}?autoplay=${playing ? 1 : 0}`;

    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[320px] bg-black rounded-3xl overflow-hidden border border-zinc-850 shadow-2xl">
        <iframe
          ref={iframeRef}
          src={rutubeUrl}
          className="w-full h-full min-h-[320px] border-0"
          allow="clipboard-write; autoplay; fullscreen"
          allowFullScreen
          title="Rutube Video"
        />
      </div>
    );
  }

  // Yandex / Dzen Video Embed
  if (provider === 'yandex') {
    const dzenUrl = `https://dzen.ru/embed/${extractedId}?from_block=partner&autoplay=${playing ? 1 : 0}`;

    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[320px] bg-black rounded-3xl overflow-hidden border border-zinc-850 shadow-2xl">
        <iframe
          ref={iframeRef}
          src={dzenUrl}
          className="w-full h-full min-h-[320px] border-0"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title="Dzen Video"
        />
      </div>
    );
  }

  // HTML5 Direct Video
  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[320px] bg-black rounded-3xl overflow-hidden border border-zinc-850 shadow-2xl flex items-center justify-center group">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full max-h-[500px] object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => onPause && onPause()}
      />

      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button
          type="button"
          onClick={toggleFullScreen}
          className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md transition-all cursor-pointer border border-white/10"
          title="На весь экран"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

UniversalPlayer.displayName = 'UniversalPlayer';
export default UniversalPlayer;
