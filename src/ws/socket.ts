/**
 * WebSocket client manager for Sferium Homes Sync
 * Supports player:state, player:seek, player:heartbeat hard-synchronization
 */

export type SocketEventType =
  | 'SYNC_COMMAND'
  | 'SYNC_STATE'
  | 'SYNC_REQUEST'
  | 'room_state'
  | 'change_video'
  | 'chat_message'
  | 'chat_broadcast'
  | 'react_message'
  | 'kick_user'
  | 'transfer_host'
  | 'toggle_control_mode'
  | 'voice:join'
  | 'voice:leave'
  | 'voice:peers_list'
  | 'voice:user_joined'
  | 'voice:user_left'
  | 'voice:offer'
  | 'voice:answer'
  | 'voice:ice_candidate'
  | 'voice:state'
  | 'voice:speaking'
  | 'connect'
  | 'disconnect'
  | 'error';

export interface SocketMessage<T = any> {
  type: SocketEventType | string;
  roomId?: string;
  userId?: string;
  senderId?: string;
  name?: string;
  avatar?: string;
  color?: string;
  videoUrl?: string;
  provider?: string;
  videoId?: string;
  currentTime?: number;
  time?: number;
  playing?: boolean;
  isPlaying?: boolean;
  state?: any;
  playbackRate?: number;
  message?: any;
  timestamp?: number;
  [key: string]: any;
}

type EventHandler<T = any> = (data: T) => void;

export class SyncSocket {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 2000;
  private reconnectTimeoutId: any = null;
  private pingIntervalId: any = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private isExplicitlyClosed = false;

  public roomId: string = '';
  public userId: string = '';
  public userName: string = '';
  public userAvatar: string = '';
  public userColor: string = '';

  constructor() {
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  public connect(params: {
    roomId: string;
    userId: string;
    name: string;
    avatar?: string;
    color?: string;
  }) {
    this.isExplicitlyClosed = false;
    this.roomId = params.roomId.toUpperCase();
    this.userId = params.userId;
    this.userName = params.name;
    this.userAvatar = params.avatar || '🍿';
    this.userColor = params.color || '#a855f7';

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    clearTimeout(this.reconnectTimeoutId);
    clearInterval(this.pingIntervalId);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}/ws?roomId=${encodeURIComponent(this.roomId)}&userId=${encodeURIComponent(this.userId)}&name=${encodeURIComponent(this.userName)}&avatar=${encodeURIComponent(this.userAvatar)}&color=${encodeURIComponent(this.userColor)}`;

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = this.handleError;
    } catch (err) {
      console.error('[SyncSocket] Failed to construct WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log(`[SyncSocket] Connected to room #${this.roomId}`);
    this.reconnectAttempts = 0;
    this.emit('connect', { roomId: this.roomId });

    // Join room explicitly
    this.send({
      type: 'join_room',
      roomId: this.roomId,
      userId: this.userId,
      name: this.userName,
      avatar: this.userAvatar,
      color: this.userColor,
    });

    // Start keepalive ping
    this.pingIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 15000);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data: SocketMessage = JSON.parse(event.data);

      if (data.type === 'pong') return;

      if (data.type) {
        this.emit(data.type, data);
      }
      this.emit('*', data);
    } catch (err) {
      console.error('[SyncSocket] Failed to parse message:', err, event.data);
    }
  }

  private handleClose(event: CloseEvent) {
    console.warn(`[SyncSocket] Disconnected (code: ${event.code})`);
    clearInterval(this.pingIntervalId);
    this.emit('disconnect', { code: event.code, reason: event.reason });

    if (!this.isExplicitlyClosed) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event) {
    console.error('[SyncSocket] WebSocket Error:', event);
    this.emit('error', event);
  }

  private scheduleReconnect() {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[SyncSocket] Max reconnect attempts reached');
      return;
    }

    const timeout = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    console.log(`[SyncSocket] Reconnecting in ${timeout}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect({
        roomId: this.roomId,
        userId: this.userId,
        name: this.userName,
        avatar: this.userAvatar,
        color: this.userColor,
      });
    }, timeout);
  }

  public send(messageOrType: SocketMessage | string, payload: Record<string, any> = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: SocketMessage =
        typeof messageOrType === 'string'
          ? { type: messageOrType, ...payload }
          : messageOrType;

      this.ws.send(JSON.stringify({
        ...message,
        roomId: message.roomId || this.roomId,
        userId: message.userId || this.userId,
        senderId: message.senderId || this.userId,
      }));
    } else {
      const msgType = typeof messageOrType === 'string' ? messageOrType : messageOrType.type;
      console.warn('[SyncSocket] Cannot send message, socket not open:', msgType);
    }
  }

  /**
   * Request initial / catch-up sync state from server
   */
  public requestSync() {
    this.send({
      type: 'SYNC_REQUEST',
      roomId: this.roomId,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Send playback command (play, pause, seek, rate)
   */
  public sendSyncCommand(payload: {
    command: 'play' | 'pause' | 'seek' | 'rate';
    position?: number;
    playing?: boolean;
    playbackRate?: number;
  }) {
    this.send({
      type: 'SYNC_COMMAND',
      roomId: this.roomId,
      command: payload.command,
      position: payload.position,
      currentTime: payload.position,
      playing: payload.playing,
      playbackRate: payload.playbackRate,
      timestamp: Date.now(),
    });
  }

  /**
   * Send authoritative host state heartbeat
   */
  public sendSyncState(payload: {
    position: number;
    playing: boolean;
    playbackRate?: number;
  }) {
    this.send({
      type: 'SYNC_STATE',
      roomId: this.roomId,
      position: payload.position,
      currentTime: payload.position,
      playing: payload.playing,
      playbackRate: payload.playbackRate || 1.0,
      timestamp: Date.now(),
    });
  }

  /**
   * Convenience helpers for components
   */
  public sendPlay(currentTime?: number) {
    this.sendSyncCommand({
      command: 'play',
      position: currentTime,
      playing: true,
    });
  }

  public sendPause(currentTime?: number) {
    this.sendSyncCommand({
      command: 'pause',
      position: currentTime,
      playing: false,
    });
  }

  public sendSeek(currentTime: number) {
    this.sendSyncCommand({
      command: 'seek',
      position: currentTime,
    });
  }

  public sendVideoSync(payload: {
    hostTime: number;
    hostPlaying: boolean;
    hostProvider?: string;
    rate?: number;
    playbackRate?: number;
    roomId?: string;
  }) {
    this.sendSyncState({
      position: payload.hostTime,
      playing: payload.hostPlaying,
      playbackRate: payload.rate || payload.playbackRate || 1.0,
    });
  }

  public sendVideoUrl(url: string, provider?: string, videoId?: string) {
    this.send({
      type: 'change_video',
      videoUrl: url,
      provider,
      videoId,
      timestamp: Date.now(),
    });
  }

  public sendChatMessage(text: string) {
    this.send({
      type: 'chat_message',
      text,
      userId: this.userId,
      name: this.userName,
      avatar: this.userAvatar,
      color: this.userColor,
      timestamp: Date.now(),
    });
  }

  // Voice Chat Signaling Methods
  public sendVoiceJoin(isMuted: boolean = false) {
    this.send({
      type: 'voice:join',
      userId: this.userId,
      name: this.userName,
      avatar: this.userAvatar,
      color: this.userColor,
      isMuted,
      timestamp: Date.now(),
    });
  }

  public sendVoiceLeave() {
    this.send({
      type: 'voice:leave',
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  public sendVoiceOffer(toUserId: string, offer: any) {
    this.send({
      type: 'voice:offer',
      fromUserId: this.userId,
      toUserId,
      offer,
      name: this.userName,
      avatar: this.userAvatar,
      color: this.userColor,
      timestamp: Date.now(),
    });
  }

  public sendVoiceAnswer(toUserId: string, answer: any) {
    this.send({
      type: 'voice:answer',
      fromUserId: this.userId,
      toUserId,
      answer,
      timestamp: Date.now(),
    });
  }

  public sendVoiceIce(toUserId: string, candidate: any) {
    this.send({
      type: 'voice:ice',
      fromUserId: this.userId,
      toUserId,
      candidate,
      ice: candidate,
      timestamp: Date.now(),
    });
  }

  public sendVoiceIceCandidate(toUserId: string, candidate: any) {
    this.send({
      type: 'voice:ice_candidate',
      fromUserId: this.userId,
      toUserId,
      candidate,
      timestamp: Date.now(),
    });
  }

  public sendVoiceState(isMuted: boolean, isDeafened: boolean) {
    this.send({
      type: 'voice:state',
      userId: this.userId,
      isMuted,
      isDeafened,
      timestamp: Date.now(),
    });
  }

  public sendVoiceSpeaking(isSpeaking: boolean) {
    this.send({
      type: 'voice:speaking',
      userId: this.userId,
      isSpeaking,
      timestamp: Date.now(),
    });
  }

  public sendRoleGrant(targetUserId: string, role: string, customPermissions?: any) {
    this.send({
      type: 'role:grant',
      targetUserId,
      role,
      customPermissions,
      timestamp: Date.now(),
    });
  }

  public sendRoleRevoke(targetUserId: string) {
    this.send({
      type: 'role:revoke',
      targetUserId,
      timestamp: Date.now(),
    });
  }

  // --- ROOM MANAGEMENT & HOST CONTROL METHODS ---
  public joinRoom(params?: { roomId?: string; userId?: string; name?: string; avatar?: string; color?: string }) {
    this.send({
      type: 'room:join',
      roomId: params?.roomId || this.roomId,
      userId: params?.userId || this.userId,
      name: params?.name || this.userName,
      avatar: params?.avatar || this.userAvatar,
      color: params?.color || this.userColor,
      timestamp: Date.now(),
    });
  }

  public leaveRoom() {
    this.send({
      type: 'room:leave',
      roomId: this.roomId,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  public kickUser(targetUserId: string, reason?: string) {
    this.send({
      type: 'room:kick',
      targetUserId,
      reason: reason || 'Исключен создателем комнаты',
      timestamp: Date.now(),
    });
    // Also send backward-compatible member:kick
    this.send({
      type: 'member:kick',
      targetUserId,
      reason,
      timestamp: Date.now(),
    });
  }

  public muteUser(targetUserId: string, isMuted: boolean = true) {
    this.send({
      type: 'room:mute',
      targetUserId,
      isMuted,
      timestamp: Date.now(),
    });
    // Also send backward-compatible voice:mod_mute
    this.send({
      type: 'voice:mod_mute',
      targetUserId,
      isMuted,
      timestamp: Date.now(),
    });
  }

  public closeRoom() {
    this.send({
      type: 'room:close',
      roomId: this.roomId,
      userId: this.userId,
      timestamp: Date.now(),
    });
  }

  public sendMuteBroadcast(isMuted: boolean = true) {
    this.send({
      type: 'room:muteBroadcast',
      roomId: this.roomId,
      userId: this.userId,
      isMuted,
      timestamp: Date.now(),
    });
  }

  public sendRestrictControls(restricted: boolean = true) {
    this.send({
      type: 'video:restrictControls',
      roomId: this.roomId,
      userId: this.userId,
      restricted,
      timestamp: Date.now(),
    });
  }

  public sendGuestAction(action: 'mute' | 'kick' | 'transferHost', targetUserId: string, data: Record<string, any> = {}) {
    this.send({
      type: 'room:guestAction',
      roomId: this.roomId,
      userId: this.userId,
      action,
      targetUserId,
      ...data,
      timestamp: Date.now(),
    });
  }

  public startBroadcast(options: { mic?: boolean; videoUrl?: string; playing?: boolean }) {
    this.send({
      type: 'room:muteBroadcast',
      roomId: this.roomId,
      userId: this.userId,
      isMuted: options.mic === false,
      timestamp: Date.now(),
    });
    this.send({
      type: 'room:hostAction',
      action: 'startBroadcast',
      roomId: this.roomId,
      mic: options.mic,
      videoUrl: options.videoUrl,
      playing: options.playing,
      timestamp: Date.now(),
    });
  }

  public sendHostAction(action: string, data: Record<string, any> = {}) {
    this.send({
      type: 'room:hostAction',
      action,
      roomId: this.roomId,
      ...data,
      timestamp: Date.now(),
    });
  }

  public sendKickMember(targetUserId: string, reason?: string) {
    this.kickUser(targetUserId, reason);
  }

  public sendBanMember(targetUserId: string, reason?: string) {
    this.send({
      type: 'member:ban',
      targetUserId,
      reason,
      timestamp: Date.now(),
    });
  }

  public sendTransferHost(targetUserId: string) {
    this.send({
      type: 'host:transfer',
      targetUserId,
      timestamp: Date.now(),
    });
  }

  public sendVoiceModMute(targetUserId: string, isMuted: boolean) {
    this.send({
      type: 'voice:mod_mute',
      targetUserId,
      isMuted,
      timestamp: Date.now(),
    });
  }

  public sendRoomSettingsUpdate(settings: {
    anyoneCanControl?: boolean;
    defaultRole?: string;
    rolePermissionsOverride?: any;
  }) {
    this.send({
      type: 'room:settings_update',
      ...settings,
      timestamp: Date.now(),
    });
  }

  public sendUserUpdate(profile: {
    name?: string;
    avatar?: string;
    color?: string;
    status?: string;
    customStatus?: string;
    bio?: string;
    micSettings?: any;
    cameraSettings?: any;
  }) {
    if (profile.name) this.userName = profile.name;
    if (profile.avatar) this.userAvatar = profile.avatar;
    if (profile.color) this.userColor = profile.color;

    this.send({
      type: 'user:update',
      userId: this.userId,
      ...profile,
      timestamp: Date.now(),
    });
  }

  public sendUserProfile(profile: {
    name?: string;
    avatar?: string;
    color?: string;
    status?: string;
    customStatus?: string;
    bio?: string;
    micSettings?: any;
    cameraSettings?: any;
  }) {
    if (profile.name) this.userName = profile.name;
    if (profile.avatar) this.userAvatar = profile.avatar;
    if (profile.color) this.userColor = profile.color;

    this.send({
      type: 'user:profile',
      userId: this.userId,
      profile,
      timestamp: Date.now(),
    });
  }

  public sendUserColor(color: string) {
    this.userColor = color;
    this.send({
      type: 'user:color',
      userId: this.userId,
      color,
      timestamp: Date.now(),
    });
  }

  public getSocket(): WebSocket | null {
    return this.ws;
  }

  public on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public subscribe(handler: (msg: any) => void): () => void {
    return this.on('*', handler);
  }

  public off<T = any>(event: string, handler: EventHandler<T>) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  public emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[SyncSocket] Handler error for '${event}':`, err);
        }
      });
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    clearTimeout(this.reconnectTimeoutId);
    clearInterval(this.pingIntervalId);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.listeners.clear();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const syncSocket = new SyncSocket();
