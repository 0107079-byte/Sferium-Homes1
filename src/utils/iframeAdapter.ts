/**
 * Universal iframe player adapter (for VK Video, Rutube, and embedded players)
 */
export interface IframePlayerAdapter {
  getCurrentTime(): number;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  seekTo(t: number): void;
}

export function createIframeAdapter(iframe: HTMLIFrameElement | null): IframePlayerAdapter {
  return {
    getCurrentTime(): number {
      try {
        return (iframe?.contentWindow as any)?.player?.getCurrentTime?.() || 0;
      } catch {
        return 0;
      }
    },
    isPlaying(): boolean {
      try {
        return (iframe?.contentWindow as any)?.player?.isPlaying?.() || false;
      } catch {
        return false;
      }
    },
    play() {
      try {
        (iframe?.contentWindow as any)?.player?.play?.();
      } catch {}
    },
    pause() {
      try {
        (iframe?.contentWindow as any)?.player?.pause?.();
      } catch {}
    },
    seekTo(t: number) {
      try {
        (iframe?.contentWindow as any)?.player?.seekTo?.(t);
      } catch {}
    },
  };
}

export default createIframeAdapter;
