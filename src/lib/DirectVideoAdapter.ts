import { BaseVideoAdapter } from './VideoAdapter';

export class DirectVideoAdapter extends BaseVideoAdapter {
  private video: HTMLVideoElement | null = null;

  constructor(videoElement: HTMLVideoElement, onReadyCallback?: () => void) {
    super();
    this.video = videoElement;
    this.init(onReadyCallback);
  }

  private init(onReadyCallback?: () => void): void {
    if (!this.video) return;

    this.video.addEventListener('play', () => this.events.onPlay?.());
    this.video.addEventListener('pause', () => this.events.onPause?.());
    this.video.addEventListener('seeking', () => this.events.onSeek?.(this.video?.currentTime || 0));
    this.video.addEventListener('ratechange', () => this.events.onRateChange?.(this.video?.playbackRate || 1.0));
    this.video.addEventListener('timeupdate', () => this.events.onTimeUpdate?.(this.video?.currentTime || 0));
    this.video.addEventListener('ended', () => this.events.onEnded?.());
    this.video.addEventListener('loadedmetadata', () => {
      this.events.onReady?.();
      onReadyCallback?.();
    });

    if (this.video.readyState >= 1) {
      this.events.onReady?.();
      onReadyCallback?.();
    }
  }

  play(): void {
    this.video?.play().catch(() => {});
  }

  pause(): void {
    this.video?.pause();
  }

  seekTo(seconds: number): void {
    if (this.video) {
      this.video.currentTime = seconds;
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }

  getCurrentTime(): number {
    return this.video?.currentTime || 0;
  }

  getDuration(): number {
    return this.video?.duration || 0;
  }

  isPlaying(): boolean {
    return !!(this.video && !this.video.paused && !this.video.ended && this.video.readyState > 2);
  }

  getPlaybackRate(): number {
    return this.video?.playbackRate || 1.0;
  }

  destroy(): void {
    this.video = null;
  }
}
