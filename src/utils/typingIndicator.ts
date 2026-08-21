/**
 * Typing Indicator Manager
 * Tracks who is currently typing in the room and provides debounce handling
 */

export interface TypingUser {
  userId: string;
  name: string;
  avatar: string;
  lastTypedAt: number;
}

type TypingListener = (typingUsers: TypingUser[]) => void;

class TypingIndicatorService {
  private typingMap: Map<string, TypingUser> = new Map();
  private listeners: Set<TypingListener> = new Set();
  private cleanupTimer: any = null;
  private localTypingTimeout: any = null;
  private isLocallyTyping: boolean = false;
  private wsSender: ((data: any) => void) | null = null;
  private currentUserId: string = '';
  private currentUserName: string = '';
  private currentUserAvatar: string = '';

  constructor() {
    this.startCleanupInterval();
  }

  public setContext(userId: string, name: string, avatar: string, sender: (data: any) => void) {
    this.currentUserId = userId;
    this.currentUserName = name;
    this.currentUserAvatar = avatar;
    this.wsSender = sender;
  }

  public initContext(roomId: string, userId: string, name: string, avatar: string, sender: (data: any) => void) {
    this.setContext(userId, name, avatar, sender);
  }

  private startCleanupInterval() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      this.typingMap.forEach((user, id) => {
        if (now - user.lastTypedAt > 3500) {
          this.typingMap.delete(id);
          changed = true;
        }
      });
      if (changed) {
        this.notify();
      }
    }, 1000);
  }

  public handleUserTyping(userId: string, name: string, avatar: string = '🍿', isTyping: boolean = true) {
    if (userId === this.currentUserId) return; // Don't show myself in the remote typing indicator

    if (!isTyping) {
      if (this.typingMap.has(userId)) {
        this.typingMap.delete(userId);
        this.notify();
      }
      return;
    }

    this.typingMap.set(userId, {
      userId,
      name,
      avatar,
      lastTypedAt: Date.now(),
    });
    this.notify();
  }

  public reportLocalTyping() {
    if (!this.wsSender) return;

    if (!this.isLocallyTyping) {
      this.isLocallyTyping = true;
      this.wsSender({
        type: 'chat:typing',
        userId: this.currentUserId,
        name: this.currentUserName,
        avatar: this.currentUserAvatar,
        isTyping: true,
        timestamp: Date.now(),
      });
    }

    if (this.localTypingTimeout) clearTimeout(this.localTypingTimeout);
    this.localTypingTimeout = setTimeout(() => {
      this.isLocallyTyping = false;
      if (this.wsSender) {
        this.wsSender({
          type: 'chat:typing',
          userId: this.currentUserId,
          name: this.currentUserName,
          avatar: this.currentUserAvatar,
          isTyping: false,
          timestamp: Date.now(),
        });
      }
    }, 2500);
  }

  public subscribe(listener: TypingListener): () => void {
    this.listeners.add(listener);
    listener(this.getTypingUsers());
    return () => this.listeners.delete(listener);
  }

  public getTypingUsers(): TypingUser[] {
    return Array.from(this.typingMap.values());
  }

  public clearAll() {
    this.typingMap.clear();
    this.notify();
  }

  private notify() {
    const list = this.getTypingUsers();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch (err) {
        console.error('Error notifying typing listener:', err);
      }
    });
  }
}

export const typingManager = new TypingIndicatorService();
export default typingManager;
