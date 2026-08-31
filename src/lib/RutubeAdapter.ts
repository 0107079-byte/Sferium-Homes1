import { BaseVideoAdapter } from './VideoAdapter';

export class RutubeAdapter extends BaseVideoAdapter {
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

        if (data.type === 'player:currentTime' || data.type === 'rutube:currentTime') {
          this.currentTime = data.data?.time || data.time || this.currentTime;
          this.events.onTimeUpdate?.(this.currentTime);
        } else if (data.type === 'player:play' || data.type === 'rutube:play') {
          this.playingState = true;
          this.events.onPlay?.();
        } else if (data.type === 'player:pause' || data.type === 'rutube:pause') {
          this.playingState = false;
          this.events.onPause?.();
        } else if (data.type === 'player:ready' || data.type === 'rutube:ready') {
          this.events.onReady?.();
          onReadyCallback?.();
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('message', this.messageHandler);
    setTimeout(() => {
      this.events.onReady?.();
      onReadyCallback?.();
    }, 1000);
  }

  private postMessage(type: string, data?: any): void {
    if (!this.iframe || !this.iframe.contentWindow) return;
    try {
      this.iframe.contentWindow.postMessage(JSON.stringify({ type, data }), '*');
    } catch (e) {
      console.warn('Rutube postMessage error:', e);
    }
  }

  play(): void {
    this.playingState = true;
    this.postMessage('player:play');
  }

  pause(): void {
    this.playingState = false;
    this.postMessage('player:pause');
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.postMessage('player:setCurrentTime', { time: seconds });
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.postMessage('player:setPlaybackRate', { rate });
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
