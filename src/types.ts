export type VideoProvider = 'youtube' | 'vk' | 'rutube' | 'direct';

export type Role = 'host' | 'moderator' | 'member' | 'guest';

export interface User {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  role: Role;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isVideoOn?: boolean;
  joinedAt?: number;
}

export interface VideoInfo {
  url: string;
  provider: VideoProvider;
  id: string;
  title?: string;
  thumbnail?: string;
}

// -------------------------------------------------------------
// CANONICAL VIDEO SYNC PROTOCOL (STRICTLY 3 EVENTS ONLY)
// -------------------------------------------------------------

export type SyncCommandType = 'play' | 'pause' | 'seek' | 'rate';

export interface SyncCommandMessage {
  type: 'SYNC_COMMAND';
  roomId: string;
  command: SyncCommandType;
  position?: number;
  playbackRate?: number;
  clientTime?: number;
  userId?: string;
}

export interface SyncStateMessage {
  type: 'SYNC_STATE';
  roomId: string;
  position: number;
  playing: boolean;
  playbackRate: number;
  revision: number;
  serverTime: number;
}

export interface SyncRequestMessage {
  type: 'SYNC_REQUEST';
  roomId: string;
  userId?: string;
}

export type VideoSyncMessage =
  | SyncCommandMessage
  | SyncStateMessage
  | SyncRequestMessage;

// -------------------------------------------------------------
// ROOM & APPLICATION STATE
// -------------------------------------------------------------

export interface Room {
  id: string;
  name: string;
  hostId: string;
  currentVideo: VideoInfo | null;
  playbackState: {
    position: number;
    playing: boolean;
    playbackRate: number;
    revision: number;
    updatedAt: number;
  };
  users: User[];
  createdAt: number;
  isPrivate?: boolean;
  accessCode?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userColor?: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  action?: string;
}
