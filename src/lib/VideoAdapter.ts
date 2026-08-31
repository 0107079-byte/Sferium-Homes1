export interface VideoPlayerEvents {
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (position: number) => void;
  onRateChange?: (rate: number) => void;
  onTimeUpdate?: (position: number) => void;
  onReady?: () => void;
  onEnded?: () => void;
  onError?: (err: unknown) => void;
}

export interface IVideoAdapter {
  play(): Promise<void> | void;
  pause(): Promise<void> | void;
  seekTo(seconds: number): Promise<void> | void;
  setPlaybackRate(rate: number): Promise<void> | void;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  getPlaybackRate(): number;
  destroy(): void;
  setEventListeners(events: VideoPlayerEvents): void;
}

export abstract class BaseVideoAdapter implements IVideoAdapter {
  protected events: VideoPlayerEvents = {};

  setEventListeners(events: VideoPlayerEvents): void {
    this.events = events;
  }

  abstract play(): Promise<void> | void;
  abstract pause(): Promise<void> | void;
  abstract seekTo(seconds: number): Promise<void> | void;
  abstract setPlaybackRate(rate: number): Promise<void> | void;
  abstract getCurrentTime(): number;
  abstract getDuration(): number;
  abstract isPlaying(): boolean;
  abstract getPlaybackRate(): number;
  abstract destroy(): void;
}
