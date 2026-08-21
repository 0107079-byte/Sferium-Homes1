import { VKAuthState, VKVideoDetails } from '../types';

const VK_TOKEN_KEY = 'vk_access_token';
const VK_USER_ID_KEY = 'vk_user_id';
const SFERIUM_VK_TOKEN_KEY = 'sferium_vk_token';
const SFERIUM_VK_USER_ID_KEY = 'sferium_vk_user_id';

/**
 * Get saved VK OAuth access token from localStorage
 */
export function getVKToken(): string | null {
  return localStorage.getItem(SFERIUM_VK_TOKEN_KEY) || localStorage.getItem(VK_TOKEN_KEY);
}

/**
 * Save VK OAuth access token to localStorage
 */
export function setVKToken(token: string, userId?: string | null): void {
  localStorage.setItem(SFERIUM_VK_TOKEN_KEY, token);
  localStorage.setItem(VK_TOKEN_KEY, token);
  if (userId) {
    localStorage.setItem(SFERIUM_VK_USER_ID_KEY, userId);
    localStorage.setItem(VK_USER_ID_KEY, userId);
  }
}

/**
 * Remove VK access token from localStorage
 */
export function removeVKToken(): void {
  localStorage.removeItem(SFERIUM_VK_TOKEN_KEY);
  localStorage.removeItem(SFERIUM_VK_USER_ID_KEY);
  localStorage.removeItem(VK_TOKEN_KEY);
  localStorage.removeItem(VK_USER_ID_KEY);
}

/**
 * Check if user is authorized via VK OAuth
 */
export function isVKAuthorized(): boolean {
  const token = getVKToken();
  return Boolean(token && token.length > 5);
}

/**
 * Get full VK auth state
 */
export function getVKAuthState(): VKAuthState {
  const token = getVKToken();
  const userId = localStorage.getItem(SFERIUM_VK_USER_ID_KEY) || localStorage.getItem(VK_USER_ID_KEY);
  return {
    isAuthorized: isVKAuthorized(),
    token: token,
    userId: userId
  };
}

/**
 * Initiate VK OAuth 2.0 flow via backend popup
 */
export async function loginWithVK(): Promise<string> {
  // 1. Fetch OAuth URL from backend
  const response = await fetch('/api/auth/vk/login');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Ошибка сервера' }));
    throw new Error(errorData.detail || 'Ключи не настроены или ошибка сервера');
  }

  const { url } = await response.json();
  if (!url) {
    throw new Error('URL авторизации не получен');
  }

  // 2. Open popup
  const width = 600;
  const height = 650;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    url,
    'vk_oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
  );

  if (!popup) {
    throw new Error('Окно авторизации заблокировано браузером. Разрешите всплывающие окна.');
  }

  // 3. Wait for postMessage
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      reject(new Error('Время ожидания авторизации истекло'));
    }, 120000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'vk') {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handleMessage);
        
        const token = event.data.token;
        const userId = event.data.user_id;

        if (token) {
          setVKToken(token, userId);
          resolve(token);
        } else {
          reject(new Error('Токен авторизации не был получен'));
        }
      } else if (event.data?.type === 'OAUTH_AUTH_FAILURE' && event.data?.provider === 'vk') {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handleMessage);
        reject(new Error(event.data.error || 'Ошибка авторизации VK'));
      }
    };

    window.addEventListener('message', handleMessage);
  });
}

/**
 * Helper to parse VK video IDs from VK URLs (e.g. vk.com/video-12345_67890 or oid/id params)
 */
export function parseVKVideoParams(url: string): { ownerId: string; videoId: string } | null {
  try {
    // Match video-1234_5678 or video1234_5678
    const match = url.match(/video(-?\d+)_(\d+)/);
    if (match) {
      return { ownerId: match[1], videoId: match[2] };
    }

    // Match oid=-1234&id=5678 query params
    const parsedUrl = new URL(url);
    const oid = parsedUrl.searchParams.get('oid');
    const id = parsedUrl.searchParams.get('id');
    if (oid && id) {
      return { ownerId: oid, videoId: id };
    }
  } catch {
    // Not a valid URL structure
  }
  return null;
}

/**
 * Fetch video details / direct MP4 or HLS stream using VK access token via JSONP / proxy
 */
export async function fetchVKVideoDetails(videoUrl: string): Promise<VKVideoDetails | null> {
  const token = getVKToken();
  const parsed = parseVKVideoParams(videoUrl);

  if (!parsed) {
    return null;
  }

  const { ownerId, videoId } = parsed;
  const fullVideoId = `${ownerId}_${videoId}`;

  if (!token) {
    // Return basic structure with embed URL if no token is available
    return {
      id: fullVideoId,
      title: `VK Video (${fullVideoId})`,
      playerUrl: `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&autoplay=1`
    };
  }

  try {
    // Attempt to call VK API video.get
    const apiUrl = `https://api.vk.com/method/video.get?videos=${fullVideoId}&access_token=${token}&v=5.131`;
    const response = await fetch(apiUrl).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      if (data?.response?.items?.[0]) {
        const item = data.response.items[0];
        const files = item.files || {};

        // Extract direct video quality streams
        const streams = Object.entries(files)
          .filter(([key]) => key.startsWith('mp4_') || key === 'hls')
          .map(([key, value]) => ({
            quality: key.replace('mp4_', ''),
            url: value as string
          }));

        const directUrl = files.mp4_720 || files.mp4_480 || files.mp4_360 || files.hls || item.player;

        return {
          id: fullVideoId,
          title: item.title || `VK Video ${fullVideoId}`,
          description: item.description,
          duration: item.duration,
          playerUrl: item.player,
          directUrl: directUrl,
          streams: streams
        };
      }
    }
  } catch (err) {
    console.warn('VK API request failed, falling back to embed player:', err);
  }

  // Default embed URL fallback
  return {
    id: fullVideoId,
    title: `VK Video (${fullVideoId})`,
    playerUrl: `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&autoplay=1`
  };
}
