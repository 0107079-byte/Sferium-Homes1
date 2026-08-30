import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { seekSafe, waitUntilReady, PlayerAdapter } from '../modules/sync';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface YouTubePlayerRef extends PlayerAdapter {
  initYouTubePlayer: (containerId: string, videoId: string) => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  isReady: () => boolean;
}

export interface YouTubePlayerProps {
  videoId: string;
  isPlaying?: boolean;
  targetTime?: number;
  onReady?: () => void;
  onStateChange?: (state: number, time: number) => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onError?: (error: any) => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(({
  videoId,
  isPlaying,
  targetTime,
  onReady,
  onStateChange,
  onTimeUpdate,
  onError,
}, ref) => {
  const containerId = useRef(`youtube-player-${Math.random().toString(36).substring(2, 9)}`);
  const playerRef = useRef<any>(null);
  const isApiReady = useRef<boolean>(false);
  const isPlayerReady = useRef<boolean>(false);
  const timerRef = useRef<any>(null);
  const lastVideoIdRef = useRef<string>('');

  // 1. YouTube API Loader
  const loadYouTubeApi = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        isApiReady.current = true;
        resolve();
        return;
      }

      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        isApiReady.current = true;
        resolve();
      };

      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          isApiReady.current = true;
          resolve();
        }
      }, 100);
    });
  }, []);

  // 2. initYouTubePlayer method
  const initYouTubePlayer = useCallback((container: string, vid: string) => {
    if (!window.YT || !window.YT.Player) {
      console.warn('[YouTubePlayer] YT API not yet ready for initialization');
      return;
    }

    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.warn('[YouTubePlayer] Error destroying existing player:', e);
      }
      playerRef.current = null;
    }

    isPlayerReady.current = false;
    lastVideoIdRef.current = vid;

    try {
      playerRef.current = new window.YT.Player(container, {
        videoId: vid,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          start: targetTime ? Math.floor(targetTime) : 0,
        },
        events: {
          onReady: (event: any) => {
            isPlayerReady.current = true;
            if (targetTime && targetTime > 0) {
              try { event.target.seekTo(targetTime, true); } catch {}
            }
            if (isPlaying) {
              try { event.target.playVideo(); } catch {}
            }
            if (onReady) onReady();
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const curTime = playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
            if (onStateChange) onStateChange(state, curTime);
          },
          onError: (event: any) => {
            console.error('[YouTubePlayer] Error event:', event.data);
            if (onError) onError(event.data);
          },
        },
      });
    } catch (err) {
      console.error('[YouTubePlayer] Failed to instantiate YT.Player:', err);
    }
  }, [isPlaying, targetTime, onReady, onStateChange, onError]);

  // 3. loadVideoById method
  const loadVideoById = useCallback((vid: string, startSeconds = 0) => {
    lastVideoIdRef.current = vid;
    if (playerRef.current && isPlayerReady.current && playerRef.current.loadVideoById) {
      try {
        playerRef.current.loadVideoById({
          videoId: vid,
          startSeconds: Math.floor(startSeconds),
        });
      } catch (err) {
        console.error('[YouTubePlayer] loadVideoById error:', err);
      }
    } else {
      initYouTubePlayer(containerId.current, vid);
    }
  }, [initYouTubePlayer]);

  // Imperative Handle (Slave Player API)
  useImperativeHandle(ref, () => ({
    isReady: () => Boolean(playerRef.current && isPlayerReady.current),
    initYouTubePlayer: (elemId: string, vid: string) => initYouTubePlayer(elemId, vid),
    loadVideoById: (vid: string, startSeconds = 0) => loadVideoById(vid, startSeconds),
    play: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.playVideo) {
        try { playerRef.current.playVideo(); } catch {}
      }
    },
    pause: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.pauseVideo) {
        try { playerRef.current.pauseVideo(); } catch {}
      }
    },
    seekTo: (seconds: number, allowSeekAhead = true) => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.seekTo) {
        try { playerRef.current.seekTo(seconds, allowSeekAhead); } catch {}
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.getCurrentTime) {
        try { return playerRef.current.getCurrentTime() || 0; } catch { return 0; }
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.getDuration) {
        try { return playerRef.current.getDuration() || 0; } catch { return 0; }
      }
      return 0;
    },
    getPlayerState: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.getPlayerState) {
        try { return playerRef.current.getPlayerState(); } catch { return -1; }
      }
      return -1;
    },
    setPlaybackRate: (rate: number) => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.setPlaybackRate) {
        try { playerRef.current.setPlaybackRate(rate); } catch {}
      }
    },
    getPlaybackRate: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.getPlaybackRate) {
        try { return playerRef.current.getPlaybackRate() || 1.0; } catch { return 1.0; }
      }
      return 1.0;
    },
    isPlaying: () => {
      if (playerRef.current && isPlayerReady.current && playerRef.current.getPlayerState) {
        try { return playerRef.current.getPlayerState() === 1; } catch { return false; }
      }
      return false;
    },
  }), [initYouTubePlayer, loadVideoById]);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    loadYouTubeApi().then(() => {
      if (!isMounted) return;
      if (videoId) {
        initYouTubePlayer(containerId.current, videoId);
      }
    });

    return () => {
      isMounted = false;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId, loadYouTubeApi, initYouTubePlayer]);

  // Sync isPlaying state strictly from master
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady.current) return;
    try {
      const state = playerRef.current.getPlayerState();
      // 1 = PLAYING, 2 = PAUSED
      if (isPlaying && state !== 1 && state !== 3) {
        playerRef.current.playVideo();
      } else if (!isPlaying && state === 1) {
        playerRef.current.pauseVideo();
      }
    } catch {}
  }, [isPlaying]);

  // Hard sync targetTime with 0.7s tolerance
  useEffect(() => {
    if (typeof targetTime !== 'number' || !playerRef.current || !isPlayerReady.current) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      if (Math.abs(cur - targetTime) > 0.7) {
        playerRef.current.seekTo(targetTime, true);
      }
    } catch {}
  }, [targetTime]);

  // Periodic time ticker for UI controls
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (playerRef.current && isPlayerReady.current && onTimeUpdate) {
        try {
          const cur = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          onTimeUpdate(cur, dur);
        } catch {}
      }
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onTimeUpdate]);

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden rounded-xl shadow-2xl">
      <div id={containerId.current} className="w-full h-full min-h-[360px]" />
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
