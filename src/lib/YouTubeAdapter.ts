import type { VideoAdapter } from "./VideoAdapter";

declare const YT: any;

export function createYouTubeAdapter(iframe: HTMLIFrameElement): VideoAdapter {
  const player = new YT.Player(iframe);

  return {
    async load(_url: string) {
      return;
    },
    play() {
      player.playVideo();
    },
    pause() {
      player.pauseVideo();
    },
    seek(time: number) {
      player.seekTo(time, true);
    },
    getCurrentTime() {
      return player.getCurrentTime();
    },
  };
}
