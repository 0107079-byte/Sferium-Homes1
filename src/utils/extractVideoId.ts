/**
 * Extracts platform and video ID from URLs for YouTube, VK Video, and Rutube
 */

export type VideoPlatform = 'youtube' | 'vk' | 'rutube' | 'direct' | 'unknown';

export interface ExtractedVideo {
  platform: VideoPlatform;
  id: string;
  embedUrl?: string;
  originalUrl?: string;
}

export function extractVideoId(rawUrl: string): ExtractedVideo | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim();

  // If user pasted an iframe tag, extract the src attribute
  const iframeSrcMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    url = iframeSrcMatch[1];
  }

  // 1. YouTube
  // Patterns: youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/embed/<id>, youtube.com/shorts/<id>, youtube.com/v/<id>
  const ytShortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (ytShortMatch && ytShortMatch[1]) {
    const id = ytShortMatch[1];
    return {
      platform: 'youtube',
      id,
      embedUrl: `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`,
      originalUrl: url,
    };
  }

  const ytWatchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (ytWatchMatch && ytWatchMatch[1]) {
    const id = ytWatchMatch[1];
    return {
      platform: 'youtube',
      id,
      embedUrl: `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`,
      originalUrl: url,
    };
  }

  const ytPathMatch = url.match(/youtube\.com\/(?:embed|shorts|v|live)\/([a-zA-Z0-9_-]{11})/i);
  if (ytPathMatch && ytPathMatch[1]) {
    const id = ytPathMatch[1];
    return {
      platform: 'youtube',
      id,
      embedUrl: `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`,
      originalUrl: url,
    };
  }

  // Check if raw 11-char YouTube ID was provided
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return {
      platform: 'youtube',
      id: url,
      embedUrl: `https://www.youtube.com/embed/${url}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`,
      originalUrl: `https://www.youtube.com/watch?v=${url}`,
    };
  }

  // 2. VK Video
  // Patterns:
  // - https://vk.com/video_ext.php?oid=-220754053&id=456241857&hash=abc (Direct embed URL)
  // - https://vk.com/video-220754053_456241857
  // - https://vkvideo.ru/video-220754053_456241857
  // - https://vk.com/clip-220754053_456241857
  if (url.includes('vk.com/video_ext.php') || url.includes('vkvideo.ru/video_ext.php')) {
    const oidMatch = url.match(/[?&]oid=(-?\d+)/);
    const idMatch = url.match(/[?&]id=(\d+)/);
    const hashMatch = url.match(/[?&]hash=([a-zA-Z0-9]+)/);
    const oid = oidMatch ? oidMatch[1] : '';
    const vid = idMatch ? idMatch[1] : '';
    const hash = hashMatch ? hashMatch[1] : '';
    const combinedId = `${oid}_${vid}${hash ? `_${hash}` : ''}`;
    return {
      platform: 'vk',
      id: combinedId,
      embedUrl: url,
      originalUrl: url,
    };
  }

  const vkMatch = url.match(/(?:vk\.com|vkvideo\.ru)\/(?:video|clip)(-?\d+)_(\d+)/i);
  if (vkMatch && vkMatch[1] && vkMatch[2]) {
    const oid = vkMatch[1];
    const vid = vkMatch[2];
    const id = `${oid}_${vid}`;
    // Build direct embed URL
    const embedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&autoplay=1&js_api=1`;
    return {
      platform: 'vk',
      id,
      embedUrl,
      originalUrl: url,
    };
  }

  // 3. Rutube
  // Patterns:
  // - https://rutube.ru/video/e9d249f87498c61fa25d304f4cbbdb50/
  // - https://rutube.ru/play/embed/e9d249f87498c61fa25d304f4cbbdb50/
  const rutubeMatch = url.match(/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]{32})/i);
  if (rutubeMatch && rutubeMatch[1]) {
    const id = rutubeMatch[1];
    const embedUrl = `https://rutube.ru/play/embed/${id}/?skinColor=7c3aed`;
    return {
      platform: 'rutube',
      id,
      embedUrl,
      originalUrl: url,
    };
  }

  // Check 32-char hex Rutube ID
  if (/^[a-f0-9]{32}$/i.test(url)) {
    return {
      platform: 'rutube',
      id: url,
      embedUrl: `https://rutube.ru/play/embed/${url}/?skinColor=7c3aed`,
      originalUrl: `https://rutube.ru/video/${url}/`,
    };
  }

  // 4. Direct video streams (.mp4, .webm, .ogg, .m3u8, .mov, blob, or general URLs)
  if (
    url.match(/\.(mp4|webm|ogg|m3u8|mov|m4v)(?:\?.*)?$/i) ||
    url.startsWith('blob:') ||
    url.startsWith('data:video') ||
    url.includes('/video-stream/') ||
    url.includes('/sample/')
  ) {
    return {
      platform: 'direct',
      id: url,
      embedUrl: url,
      originalUrl: url,
    };
  }

  // If it's a valid http/https URL but unknown service, treat as direct video
  if (/^https?:\/\//i.test(url)) {
    return {
      platform: 'direct',
      id: url,
      embedUrl: url,
      originalUrl: url,
    };
  }

  return null;
}
