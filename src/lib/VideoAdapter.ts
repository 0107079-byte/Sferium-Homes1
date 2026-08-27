export interface VideoAdapter {
  load(url: string): Promise<void>;
  play(): void;
  pause(): void;
  seek(time: number): void;
  getCurrentTime(): number;
}

export type AdapterFactory = (element: HTMLVideoElement | HTMLIFrameElement) => VideoAdapter;
