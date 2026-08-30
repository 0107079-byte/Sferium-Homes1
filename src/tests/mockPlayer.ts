import { PlayerAdapter } from '../plugins/videoSync';

export class MockPlayer implements PlayerAdapter {
  public currentTime: number = 0;
  public playing: boolean = false;
  public playbackRate: number = 1.0;
  public ready: boolean = true;
  public duration: number = 7200; // 2 hours
  public provider: string = 'mock';

  public seekHistory: number[] = [];
  public playHistory: number[] = [];
  public pauseHistory: number[] = [];
  public rateHistory: number[] = [];

  constructor(initialTime = 0, initialPlaying = false) {
    this.currentTime = initialTime;
    this.playing = initialPlaying;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.seekHistory.push(seconds);
  }

  play(): void {
    this.playing = true;
    this.playHistory.push(this.currentTime);
  }

  pause(): void {
    this.playing = false;
    this.pauseHistory.push(this.currentTime);
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    this.rateHistory.push(rate);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  isReady(): boolean {
    return this.ready;
  }

  getDuration(): number {
    return this.duration;
  }

  // Simulator helper: advances time by seconds according to playing state and rate
  tick(seconds: number): void {
    if (this.playing) {
      this.currentTime += seconds * this.playbackRate;
    }
  }

  resetHistories(): void {
    this.seekHistory = [];
    this.playHistory = [];
    this.pauseHistory = [];
    this.rateHistory = [];
  }
}

export class MockWebSocket {
  public sentMessages: any[] = [];
  public listeners: ((event: { data: string }) => void)[] = [];

  send(data: string): void {
    try {
      this.sentMessages.push(JSON.parse(data));
    } catch {
      this.sentMessages.push(data);
    }
  }

  addEventListener(event: string, handler: (event: { data: string }) => void): void {
    if (event === 'message') {
      this.listeners.push(handler);
    }
  }

  removeEventListener(event: string, handler: (event: { data: string }) => void): void {
    if (event === 'message') {
      this.listeners = this.listeners.filter((h) => h !== handler);
    }
  }

  // Simulate incoming message to client
  receive(msg: any): void {
    const dataStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
    this.listeners.forEach((h) => h({ data: dataStr }));
  }
}
