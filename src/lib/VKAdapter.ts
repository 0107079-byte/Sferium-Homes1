import { BaseVideoAdapter } from './VideoAdapter';

export class VKAdapter extends BaseVideoAdapter {
  private iframe: HTMLIFrameElement | null = null;
  private duration = 0;
  private currentTime = 0;
  private playingState = false;
  private playbackRate = 1.0;
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  constructor(iframeElement: HTMLIFrameElement, onReadyCallback?: () => void) {
    super();
    this.iframe = iframeElement;
    this.init(onReadyCallback);
  }

  private init(onReadyCallback?: () => void): void {
    this.messageHandler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        if (data.type === 'vk_player_time' || data.event === 'timeupdate') {
          this.currentTime = data.time || data.currentTime || this.currentTime;
          this.events.onTimeUpdate?.(this.currentTime);
        } else if (data.type === 'vk_player_play' || data.event === 'play') {
          this.playingState = true;
          this.events.onPlay?.();
        } else if (data.type === 'vk_player_pause' || data.event === 'pause') {
          this.playingState = false;
          this.events.onPause?.();
        } else if (data.type === 'vk_player_ready' || data.event === 'ready') {
          this.events.onReady?.();
          onReadyCallback?.();
        } else if (data.type === 'vk_player_seek' || data.event === 'seek') {
          this.currentTime = data.time || this.currentTime;
          this.events.onSeek?.(this.currentTime);
        }
      } catch (e) {
        // ignore non-VK messages
      }
    };

    window.addEventListener('message', this.messageHandler);
    setTimeout(() => {
      this.events.onReady?.();
      onReadyCallback?.();
    }, 1000);
  }

  private postMessage(action: string, value?: any): void {
    if (!this.iframe || !this.iframe.contentWindow) return;
    try {
      this.iframe.contentWindow.postMessage(JSON.stringify({ action, value }), '*');
    } catch (e) {
      console.warn('VK postMessage error:', e);
    }
  }

  play(): void {
    this.playingState = true;
    this.postMessage('play');
  }

  pause(): void {
    this.playingState = false;
    this.postMessage('pause');
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.postMessage('seek', seconds);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.postMessage('set_playback_rate', rate);
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  isPlaying(): boolean {
    return this.playingState;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe = null;
  }
}
