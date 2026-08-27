import type { VideoAdapter } from "./VideoAdapter";

export function createVKAdapter(element: HTMLVideoElement | HTMLIFrameElement): VideoAdapter {
  // 1. If it's a direct HTML5 Video element
  if (element instanceof HTMLVideoElement) {
    return {
      async load(url: string) {
        element.src = url;
        await element.play().catch(() => {});
        element.pause();
      },
      play() {
        element.play().catch(() => {});
      },
      pause() {
        element.pause();
      },
      seek(time: number) {
        element.currentTime = time;
      },
      getCurrentTime() {
        return element.currentTime;
      },
    };
  }

  // 2. If it's an official VK IFrame player with js_api=1 enabled
  const iframe = element as HTMLIFrameElement;
  let localCurrentTime = 0;

  const sendVkCommand = (method: string, param?: any) => {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify({ method, param }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ type: 'action', action: method, time: param }), '*');
    } catch (e) {
      console.warn('[VKAdapter] postMessage error:', e);
    }
  };

  // Listen for VK video events (timeupdate, play, pause, seek)
  if (typeof window !== 'undefined') {
    const onMessage = (e: MessageEvent) => {
      try {
        let data = e.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (!data || typeof data !== 'object') return;

        if (data.event === 'timeupdate' && typeof data.time === 'number') {
          localCurrentTime = data.time;
        } else if (data.data && typeof data.data.time === 'number') {
          localCurrentTime = data.data.time;
        } else if (typeof data.currentTime === 'number') {
          localCurrentTime = data.currentTime;
        }
      } catch {}
    };
    window.addEventListener('message', onMessage);
  }

  return {
    async load(embedUrl: string) {
      if (iframe && embedUrl) {
        let finalUrl = embedUrl;
        if (!finalUrl.includes('js_api=')) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'js_api=1';
        }
        iframe.src = finalUrl;
      }
    },
    play() {
      sendVkCommand('play');
    },
    pause() {
      sendVkCommand('pause');
    },
    seek(time: number) {
      localCurrentTime = time;
      sendVkCommand('pause');
      sendVkCommand('seek', time);
      sendVkCommand('play');
    },
    getCurrentTime() {
      return localCurrentTime;
    },
  };
}

