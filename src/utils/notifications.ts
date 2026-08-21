/**
 * Unified Notification Center
 * Manages in-app toast notifications, unread badges for menu tabs,
 * sounds, vibrations, and push notifications.
 */
import { soundManager } from './soundNotifications';
import { vibrationManager } from './vibration';
import { pushManager } from './pushNotifications';

export type NotificationType =
  | 'chat'
  | 'user_join'
  | 'user_leave'
  | 'host_change'
  | 'mod_kick'
  | 'mod_mute'
  | 'room_close'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  avatar?: string;
  icon?: string;
  timestamp: number;
  read: boolean;
  category: 'chat' | 'participants' | 'host' | 'settings' | 'general';
}

export interface UnreadCounters {
  participants: number;
  profile: number;
  settings: number;
  hostPanel: number;
  chat: number;
}

type NotificationListener = (notifications: AppNotification[], counters: UnreadCounters) => void;
type ToastListener = (toasts: AppNotification[]) => void;

class NotificationService {
  private notifications: AppNotification[] = [];
  private activeToasts: AppNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();
  private toastListeners: Set<ToastListener> = new Set();
  private counters: UnreadCounters = {
    participants: 0,
    profile: 0,
    settings: 0,
    hostPanel: 0,
    chat: 0,
  };

  constructor() {}

  public getNotifications(): AppNotification[] {
    return [...this.notifications];
  }

  public getActiveToasts(): AppNotification[] {
    return [...this.activeToasts];
  }

  public getCounters(): UnreadCounters {
    return { ...this.counters };
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    listener(this.notifications, this.counters);
    return () => this.listeners.delete(listener);
  }

  public subscribeToToasts(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    listener(this.activeToasts);
    return () => this.toastListeners.delete(listener);
  }

  /**
   * Reset badge counter for a specific menu section upon opening it
   */
  public resetCounter(section: keyof UnreadCounters) {
    if (this.counters[section] > 0) {
      this.counters[section] = 0;
      this.notify();
    }
  }

  /**
   * Add a notification, trigger sound, vibration, Web Push, and display toast
   */
  public pushNotification(item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fullItem: AppNotification = {
      ...item,
      id,
      timestamp: Date.now(),
      read: false,
    };

    // Increment category counter
    if (fullItem.category === 'participants') {
      this.counters.participants += 1;
    } else if (fullItem.category === 'host') {
      this.counters.hostPanel += 1;
    } else if (fullItem.category === 'chat') {
      this.counters.chat += 1;
    } else if (fullItem.category === 'settings') {
      this.counters.settings += 1;
    }

    // Keep history limit to 50
    this.notifications = [fullItem, ...this.notifications].slice(0, 50);

    // Toast queue (max 4 concurrent)
    this.activeToasts = [fullItem, ...this.activeToasts].slice(0, 4);

    // Auto-remove toast after 4.5 seconds
    setTimeout(() => {
      this.dismissToast(id);
    }, 4500);

    // Trigger Sound & Vibration
    switch (fullItem.type) {
      case 'chat':
        soundManager.playNewMessage();
        vibrationManager.vibrateNewMessage();
        break;
      case 'user_join':
        soundManager.playUserJoined();
        vibrationManager.vibrateUserPresence();
        break;
      case 'user_leave':
        soundManager.playUserLeft();
        vibrationManager.vibrateUserPresence();
        break;
      case 'host_change':
        soundManager.playNewHost();
        vibrationManager.vibrateHostAction();
        break;
      case 'mod_kick':
      case 'mod_mute':
      case 'room_close':
        soundManager.playKickOrMute();
        vibrationManager.vibrateHostAction();
        break;
      default:
        break;
    }

    // Send Web Push Notification if window is in background
    if (typeof document !== 'undefined' && document.hidden) {
      pushManager.sendNotification({
        title: fullItem.title,
        body: fullItem.message,
        icon: fullItem.avatar || '🍿',
        tag: fullItem.type,
      });
    }

    this.notify();
  }

  public dismissToast(id: string) {
    const prevLen = this.activeToasts.length;
    this.activeToasts = this.activeToasts.filter((t) => t.id !== id);
    if (this.activeToasts.length !== prevLen) {
      this.notify();
    }
  }

  public clearAll() {
    this.notifications = [];
    this.activeToasts = [];
    this.counters = {
      participants: 0,
      profile: 0,
      settings: 0,
      hostPanel: 0,
      chat: 0,
    };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.notifications, this.counters);
      } catch (err) {
        console.error('Error notifying notification listener:', err);
      }
    });

    this.toastListeners.forEach((fn) => {
      try {
        fn(this.activeToasts);
      } catch (err) {
        console.error('Error notifying toast listener:', err);
      }
    });
  }
}

export const notificationManager = new NotificationService();
export default notificationManager;
