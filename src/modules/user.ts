import { AppUser, AuthProviderType, UserStatus } from '../types';

const STORAGE_KEY = 'sferium_user_profile';
const GUEST_ID_KEY = 'sferium_guest_id';
const USER_ID_KEY = 'sferium_userid';

const PRESET_NAMES = [
  'Киноман', 'Эфирщик', 'Медиагуру', 'Телезритель',
  'Спутник', 'Астронавт', 'Фильмофил', 'Видеовояжер', 'ЗрительX'
];

const PRESET_AVATARS = [
  '🍿', '👾', '🎬', '🚀', '🪐', '🦊', '🐼', '🤖', '🍕', '📺',
  '👑', '🎧', '🎮', '⚡', '🌟', '🎨', '🏆', '🐱', '🐶', '🔥'
];

const PRESET_COLORS = [
  'text-indigo-400 border-indigo-400 bg-indigo-950/20',
  'text-emerald-400 border-emerald-400 bg-emerald-950/20',
  'text-rose-400 border-rose-400 bg-rose-950/20',
  'text-amber-400 border-amber-400 bg-amber-950/20',
  'text-sky-400 border-sky-400 bg-sky-950/20',
  'text-fuchsia-400 border-fuchsia-400 bg-fuchsia-950/20',
];

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateGuestId(): string {
  return `guest_${generateUUID()}`;
}

type UserListener = (user: AppUser) => void;

class UserManager {
  private currentUser: AppUser;
  private listeners: Set<UserListener> = new Set();

  constructor() {
    this.currentUser = this.loadInitialUser();
  }

  private loadInitialUser(): AppUser {
    // 1. Try to read comprehensive stored user profile
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppUser;
        if (parsed && parsed.userId && parsed.name) {
          return {
            ...parsed,
            isGuest: parsed.isGuest !== false,
            authProvider: parsed.authProvider || 'guest',
            status: parsed.status || 'online',
            micSettings: parsed.micSettings || {
              inputVolume: 100,
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true,
            },
            cameraSettings: parsed.cameraSettings || {
              quality: '720p',
              mirror: true,
            },
          };
        }
      }
    } catch (e) {
      console.warn('[UserManager] Failed to parse stored profile:', e);
    }

    // 2. Try legacy individual keys or generate fresh guest
    const legacyGuestId = localStorage.getItem(GUEST_ID_KEY) || localStorage.getItem(USER_ID_KEY);
    const guestId = legacyGuestId && legacyGuestId.startsWith('guest_') ? legacyGuestId : generateGuestId();

    const name = localStorage.getItem('sferium_username') || PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)];
    const avatar = localStorage.getItem('sferium_avatar') || PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];
    const color = localStorage.getItem('sferium_color') || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    const status = (localStorage.getItem('sferium_status') as UserStatus) || 'online';
    const customStatus = localStorage.getItem('sferium_custom_status') || '';
    const bio = localStorage.getItem('sferium_bio') || '';

    // Check if there is an existing VK token
    const vkToken = localStorage.getItem('sferium_vk_token') || localStorage.getItem('vk_access_token');
    const vkUserId = localStorage.getItem('sferium_vk_user_id') || localStorage.getItem('vk_user_id');

    const isRegistered = Boolean(vkToken && vkUserId);
    const userId = isRegistered && vkUserId ? `vk_${vkUserId}` : guestId;
    const authProvider: AuthProviderType = isRegistered ? 'vk' : 'guest';

    const initialUser: AppUser = {
      userId,
      guestId,
      isGuest: !isRegistered,
      authProvider,
      name,
      avatar,
      color,
      status,
      customStatus,
      bio,
      accessToken: vkToken || undefined,
      micSettings: {
        inputVolume: 100,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
      cameraSettings: {
        quality: '720p',
        mirror: true,
      },
      registeredAt: isRegistered ? Date.now() : undefined,
      lastLoginAt: Date.now(),
    };

    this.saveUserToStorage(initialUser);
    return initialUser;
  }

  private saveUserToStorage(user: AppUser) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(USER_ID_KEY, user.userId);
      if (user.guestId) {
        localStorage.setItem(GUEST_ID_KEY, user.guestId);
      }
      localStorage.setItem('sferium_username', user.name);
      localStorage.setItem('sferium_avatar', user.avatar);
      localStorage.setItem('sferium_color', user.color);
      localStorage.setItem('sferium_status', user.status);
      if (user.customStatus !== undefined) {
        localStorage.setItem('sferium_custom_status', user.customStatus);
      }
      if (user.bio !== undefined) {
        localStorage.setItem('sferium_bio', user.bio);
      }
      if (user.accessToken) {
        localStorage.setItem('sferium_vk_token', user.accessToken);
        localStorage.setItem('vk_access_token', user.accessToken);
      }
    } catch (e) {
      console.warn('[UserManager] Failed to save user to storage:', e);
    }
  }

  private notify() {
    const copy = this.getUser();
    this.listeners.forEach((l) => l(copy));
  }

  public subscribe(listener: UserListener): () => void {
    this.listeners.add(listener);
    listener(this.getUser());
    return () => this.listeners.delete(listener);
  }

  public getUser(): AppUser {
    return {
      ...this.currentUser,
      micSettings: { ...this.currentUser.micSettings },
      cameraSettings: { ...this.currentUser.cameraSettings },
    };
  }

  public setUser(patch: Partial<AppUser>): AppUser {
    this.currentUser = {
      ...this.currentUser,
      ...patch,
      micSettings: patch.micSettings ? { ...this.currentUser.micSettings, ...patch.micSettings } : this.currentUser.micSettings,
      cameraSettings: patch.cameraSettings ? { ...this.currentUser.cameraSettings, ...patch.cameraSettings } : this.currentUser.cameraSettings,
    };

    this.saveUserToStorage(this.currentUser);
    this.notify();
    return this.getUser();
  }

  public createGuestUser(): AppUser {
    const guestId = generateGuestId();
    const name = PRESET_NAMES[Math.floor(Math.random() * PRESET_NAMES.length)];
    const avatar = PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];
    const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

    const guestUser: AppUser = {
      userId: guestId,
      guestId,
      isGuest: true,
      authProvider: 'guest',
      name,
      avatar,
      color,
      status: 'online',
      customStatus: '',
      bio: '',
      micSettings: {
        inputVolume: 100,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
      cameraSettings: {
        quality: '720p',
        mirror: true,
      },
      registeredAt: undefined,
      lastLoginAt: Date.now(),
    };

    this.currentUser = guestUser;
    this.saveUserToStorage(guestUser);
    this.notify();
    return this.getUser();
  }

  /**
   * Upgrades a guest profile to a registered user with VK/OK/Mail.ru info
   */
  public upgradeGuestToUser(authData: {
    userId?: string | number;
    name?: string;
    avatar?: string;
    email?: string;
    phone?: string;
    provider: AuthProviderType;
    token?: string;
    userInfo?: any;
  }): AppUser {
    const rawUserId = authData.userId ? String(authData.userId) : generateUUID();
    const finalUserId = rawUserId.startsWith(`${authData.provider}_`) ? rawUserId : `${authData.provider}_${rawUserId}`;
    
    // Parse name if provided
    let finalName = authData.name || this.currentUser.name;
    let finalAvatar = authData.avatar || this.currentUser.avatar;

    if (authData.userInfo) {
      if (authData.userInfo.first_name || authData.userInfo.last_name) {
        finalName = `${authData.userInfo.first_name || ''} ${authData.userInfo.last_name || ''}`.trim() || finalName;
      }
      if (authData.userInfo.avatar || authData.userInfo.photo_200 || authData.userInfo.photo_max) {
        finalAvatar = authData.userInfo.avatar || authData.userInfo.photo_200 || authData.userInfo.photo_max || finalAvatar;
      }
    }

    const upgradedUser: AppUser = {
      ...this.currentUser,
      userId: finalUserId,
      guestId: this.currentUser.guestId || this.currentUser.userId,
      isGuest: false,
      authProvider: authData.provider,
      name: finalName,
      avatar: finalAvatar,
      email: authData.email || this.currentUser.email,
      phone: authData.phone || this.currentUser.phone,
      accessToken: authData.token,
      registeredAt: this.currentUser.registeredAt || Date.now(),
      lastLoginAt: Date.now(),
    };

    this.currentUser = upgradedUser;
    this.saveUserToStorage(upgradedUser);
    this.notify();
    return this.getUser();
  }

  /**
   * Logs out the user and smoothly transitions back to Guest mode
   */
  public logout(): AppUser {
    localStorage.removeItem('sferium_vk_token');
    localStorage.removeItem('vk_access_token');
    localStorage.removeItem('sferium_vk_user_id');
    localStorage.removeItem('vk_user_id');

    const guestId = this.currentUser.guestId || generateGuestId();
    
    const guestUser: AppUser = {
      ...this.currentUser,
      userId: guestId,
      guestId,
      isGuest: true,
      authProvider: 'guest',
      accessToken: undefined,
      email: undefined,
      phone: undefined,
    };

    this.currentUser = guestUser;
    this.saveUserToStorage(guestUser);
    this.notify();
    return this.getUser();
  }

  /**
   * Completely clears user data and creates a brand-new clean Guest profile
   */
  public deleteAccount(): AppUser {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_ID_KEY);
      localStorage.removeItem(GUEST_ID_KEY);
      localStorage.removeItem('sferium_username');
      localStorage.removeItem('sferium_avatar');
      localStorage.removeItem('sferium_color');
      localStorage.removeItem('sferium_status');
      localStorage.removeItem('sferium_custom_status');
      localStorage.removeItem('sferium_bio');
      localStorage.removeItem('sferium_vk_token');
      localStorage.removeItem('vk_access_token');
      localStorage.removeItem('sferium_vk_user_id');
      localStorage.removeItem('vk_user_id');
      localStorage.removeItem('sferium_mic_settings');
      localStorage.removeItem('sferium_camera_settings');
      localStorage.removeItem('sferium_recent_rooms');
    } catch (e) {
      console.warn('[UserManager] Error during deleteAccount storage purge:', e);
    }

    return this.createGuestUser();
  }
}

export const userManager = new UserManager();
