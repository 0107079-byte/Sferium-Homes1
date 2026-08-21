/**
 * Normalizes input video URLs for YouTube, VK Video, and Rutube
 */

export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // Remove surrounding quotes or angle brackets
  url = url.replace(/^[<"']+|[>"']+$/g, '');

  // Add https:// protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vk.com') || url.includes('vkvideo.ru') || url.includes('rutube.ru')) {
      url = `https://${url}`;
    }
  }

  try {
    const parsed = new URL(url);

    // YouTube normalization
    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace(/^\/+/, '');
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        const videoId = parsed.pathname.replace('/shorts/', '');
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const videoId = parsed.pathname.replace('/embed/', '');
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    // Rutube normalization
    if (parsed.hostname.includes('rutube.ru')) {
      if (parsed.pathname.startsWith('/video/')) {
        const videoId = parsed.pathname.replace('/video/', '').replace(/\/+$/, '');
        return `https://rutube.ru/video/${videoId}/`;
      }
      if (parsed.pathname.startsWith('/play/embed/')) {
        const videoId = parsed.pathname.replace('/play/embed/', '').replace(/\/+$/, '');
        return `https://rutube.ru/video/${videoId}/`;
      }
    }

    // VK normalization
    if (parsed.hostname.includes('vkvideo.ru')) {
      return url.replace('vkvideo.ru', 'vk.com');
    }

    return url;
  } catch {
    return url;
  }
}
