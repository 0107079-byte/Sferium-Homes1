/**
 * Web Push & Browser Notifications Manager
 * Handles Service Worker registration, permission requests, and background notifications
 */

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
}

class PushNotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isEnabled: boolean = true;

  constructor() {
    try {
      const stored = localStorage.getItem('sferium_push_enabled');
      if (stored !== null) {
        this.isEnabled = stored === 'true';
      }
    } catch {}

    this.initServiceWorker();
  }

  private async initServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        this.swRegistration = reg;
        console.log('[PUSH] Service Worker registered successfully');
      } catch (err) {
        console.warn('[PUSH] SW registration failed (ignorable in dev/sandbox):', err);
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      this.setEnabled(granted);
      return granted;
    } catch (err) {
      console.error('[PUSH] Request permission error:', err);
      return false;
    }
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('sferium_push_enabled', String(enabled));
    } catch {}
  }

  public getIsEnabled(): boolean {
    return this.isEnabled && this.getPermissionStatus() === 'granted';
  }

  /**
   * Send notification to user (especially when document is hidden / tab is backgrounded)
   */
  public async sendNotification(options: PushNotificationOptions) {
    if (!this.isEnabled || !this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    const {
      title,
      body,
      icon = '🍿',
      badge = '/favicon.ico',
      tag = 'sferium-alert',
      data,
    } = options;

    try {
      if (this.swRegistration && 'showNotification' in this.swRegistration) {
        await this.swRegistration.showNotification(title, {
          body,
          icon: typeof icon === 'string' && icon.startsWith('http') ? icon : undefined,
          badge,
          tag,
          data,
        });
      } else {
        new Notification(title, {
          body,
          icon: typeof icon === 'string' && icon.startsWith('http') ? icon : undefined,
          tag,
        });
      }
    } catch (err) {
      console.warn('[PUSH] Notification display failed:', err);
    }
  }
}

export const pushManager = new PushNotificationService();
export default pushManager;
