import { BaseVideoAdapter } from './VideoAdapter';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export class YouTubeAdapter extends BaseVideoAdapter {
  private player: any = null;
  private isReady = false;
  private duration = 0;
  private pollInterval: any = null;
  private lastTime = 0;

  constructor(containerId: string, videoId: string, onReadyCallback?: () => void) {
    super();
    this.init(containerId, videoId, onReadyCallback);
  }

  private init(containerId: string, videoId: string, onReadyCallback?: () => void): void {
    const loadApi = () => {
      if (window.YT && window.YT.Player) {
        this.createPlayer(containerId, videoId, onReadyCallback);
      } else {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevReady) prevReady();
          this.createPlayer(containerId, videoId, onReadyCallback);
        };
      }
    };

    loadApi();
  }

  private createPlayer(containerId: string, videoId: string, onReadyCallback?: () => void): void {
    try {
      this.player = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.isReady = true;
            this.duration = this.player.getDuration() || 0;
            this.startPolling();
            this.events.onReady?.();
            onReadyCallback?.();
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            if (event.data === 1) {
              this.events.onPlay?.();
            } else if (event.data === 2) {
              this.events.onPause?.();
            } else if (event.data === 0) {
              this.events.onEnded?.();
            }
          },
          onPlaybackRateChange: (event: any) => {
            this.events.onRateChange?.(event.data);
          },
          onError: (event: any) => {
            this.events.onError?.(event);
          },
        },
      });
    } catch (e) {
      console.warn('YouTube Player init error:', e);
    }
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      if (!this.player || !this.isReady) return;
      try {
        const t = this.player.getCurrentTime();
        if (typeof t === 'number') {
          if (Math.abs(t - this.lastTime) > 1.5 && this.player.getPlayerState() === 1) {
            this.events.onSeek?.(t);
          }
          this.lastTime = t;
          this.events.onTimeUpdate?.(t);
        }
      } catch (e) {
        // ignore
      }
    }, 500);
  }

  play(): void {
    if (this.player && this.isReady && this.player.playVideo) {
      this.player.playVideo();
    }
  }

  pause(): void {
    if (this.player && this.isReady && this.player.pauseVideo) {
      this.player.pauseVideo();
    }
  }

  seekTo(seconds: number): void {
    if (this.player && this.isReady && this.player.seekTo) {
      this.player.seekTo(seconds, true);
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.player && this.isReady && this.player.setPlaybackRate) {
      this.player.setPlaybackRate(rate);
    }
  }

  getCurrentTime(): number {
    if (this.player && this.isReady && this.player.getCurrentTime) {
      return this.player.getCurrentTime() || 0;
    }
    return 0;
  }

  getDuration(): number {
    if (this.player && this.isReady && this.player.getDuration) {
      return this.player.getDuration() || this.duration;
    }
    return this.duration;
  }

  isPlaying(): boolean {
    if (this.player && this.isReady && this.player.getPlayerState) {
      return this.player.getPlayerState() === 1;
    }
    return false;
  }

  getPlaybackRate(): number {
    if (this.player && this.isReady && this.player.getPlaybackRate) {
      return this.player.getPlaybackRate() || 1.0;
    }
    return 1.0;
  }

  destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.player && this.player.destroy) {
      try {
        this.player.destroy();
      } catch (e) {
        // ignore
      }
      this.player = null;
    }
  }
}
