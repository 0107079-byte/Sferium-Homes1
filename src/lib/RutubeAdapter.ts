import type { VideoAdapter } from "./VideoAdapter";

export function createRutubeAdapter(video: HTMLVideoElement): VideoAdapter {
  return {
    async load(url: string) {
      video.src = url;
      await video.play().catch(() => {});
      video.pause();
    },
    play() {
      video.play();
    },
    pause() {
      video.pause();
    },
    seek(time: number) {
      video.currentTime = time;
    },
    getCurrentTime() {
      return video.currentTime;
    },
  };
}
