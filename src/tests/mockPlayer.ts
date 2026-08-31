import { BaseVideoAdapter, VideoPlayerEvents } from '../lib/VideoAdapter';

export class MockPlayerAdapter extends BaseVideoAdapter {
  public currentTime = 0;
  public duration = 300;
  public playing = false;
  public playbackRate = 1.0;

  public playCount = 0;
  public pauseCount = 0;
  public seekCount = 0;
  public rateCount = 0;

  play(): void {
    this.playing = true;
    this.playCount += 1;
    this.events.onPlay?.();
  }

  pause(): void {
    this.playing = false;
    this.pauseCount += 1;
    this.events.onPause?.();
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.seekCount += 1;
    this.events.onSeek?.(seconds);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.rateCount += 1;
    this.events.onRateChange?.(rate);
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  destroy(): void {
    this.playing = false;
  }
}
