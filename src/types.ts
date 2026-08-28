export type VideoProvider = 'youtube' | 'vk' | 'rutube' | 'direct' | 'yandex' | 'unknown';

export type UserRole = 'host' | 'moderator' | 'member' | 'viewer';

export interface RolePermissions {
  manageVideo: boolean;
  manageVoice: boolean;
  manageMembers: boolean;
  manageRoles: boolean;
  transferHost: boolean;
  canShareScreen: boolean;
  canShareCamera: boolean;
  canChat: boolean;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  host: {
    manageVideo: true,
    manageVoice: true,
    manageMembers: true,
    manageRoles: true,
    transferHost: true,
    canShareScreen: true,
    canShareCamera: true,
    canChat: true,
  },
  moderator: {
    manageVideo: true,
    manageVoice: true,
    manageMembers: true,
    manageRoles: true,
    transferHost: false,
    canShareScreen: true,
    canShareCamera: true,
    canChat: true,
  },
  member: {
    manageVideo: false,
    manageVoice: false,
    manageMembers: false,
    manageRoles: false,
    transferHost: false,
    canShareScreen: true,
    canShareCamera: true,
    canChat: true,
  },
  viewer: {
    manageVideo: false,
    manageVoice: false,
    manageMembers: false,
    manageRoles: false,
    transferHost: false,
    canShareScreen: false,
    canShareCamera: false,
    canChat: true,
  },
};

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserAudioSettings {
  deviceId?: string;
  inputVolume: number; // 0 - 200 (percentage, 100 default)
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  threshold?: number; // 0 - 100
}

export interface UserVideoSettings {
  deviceId?: string;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  mirror: boolean;
  frameRate?: number;
}

export type AuthProviderType = 'guest' | 'vk' | 'ok' | 'mail';

export interface UserProfile {
  userId: string;
  guestId?: string;
  isGuest?: boolean;
  authProvider?: AuthProviderType;
  email?: string;
  phone?: string;
  name: string;
  avatar: string;
  color: string;
  status: UserStatus;
  customStatus?: string;
  bio?: string;
  registeredAt?: number;
  lastLoginAt?: number;
  accessToken?: string;
  micSettings: UserAudioSettings;
  cameraSettings: UserVideoSettings;
}

export type AppUser = UserProfile;

export interface User {
  id?: string;
  userId: string;
  name: string;
  avatar: string;
  color: string;
  status?: UserStatus;
  customStatus?: string;
  bio?: string;
  isHost?: boolean;
  role?: UserRole;
  customPermissions?: Partial<RolePermissions>;
  isMutedByMod?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  micSettings?: UserAudioSettings;
  cameraSettings?: UserVideoSettings;
}

export type Member = User;

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  userId?: string;
  name?: string;
  avatar?: string;
  color?: string;
  text: string;
  timestamp: number;
  reactions?: Record<string, string[]>;
}

export interface RoomSummary {
  roomId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  hasPassword?: boolean;
  tags?: string[];
  createdAt: number;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  membersCount: number;
  maxMembers?: number;
  currentVideoTitle?: string;
  currentVideoThumbnail?: string;
  videoUrl?: string;
  provider?: VideoProvider;
  playing?: boolean;
  anyoneCanControl?: boolean;
}

export interface CreateRoomPayload {
  roomId?: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  password?: string;
  tags?: string[];
  initialVideoUrl?: string;
  maxMembers?: number;
  anyoneCanControl?: boolean;
  defaultRole?: UserRole;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  hostColor?: string;
}

export interface RoomState {
  roomId: string;
  name?: string;
  description?: string;
  isPrivate?: boolean;
  password?: string;
  tags?: string[];
  maxMembers?: number;
  createdAt?: number;
  hostId: string;
  hostName?: string;
  hostAvatar?: string;
  videoUrl: string;
  currentVideoTitle?: string;
  provider: VideoProvider;
  videoId?: string;
  currentTime: number;
  hostTime?: number;
  playing: boolean;
  isPlaying?: boolean;
  hostPlaying?: boolean;
  hostProvider?: VideoProvider | string;
  lastUpdated?: number;
  isLocked?: boolean;
  mediaType?: 'vod' | 'live';
  playbackRate?: number;
  revision?: number;
  serverTime?: number;
  duration?: number;
  members: Record<string, Member>;
  chatHistory: ChatMessage[];
  anyoneCanControl?: boolean;
  lastHeartbeatSyncTime?: number;
  bannedUserIds?: string[];
  defaultRole?: UserRole;
  rolePermissionsOverride?: Partial<Record<UserRole, Partial<RolePermissions>>>;
}

export interface VKAuthState {
  isAuthorized: boolean;
  token: string | null;
  userId?: string | null;
}

export interface VKVideoStream {
  quality: string;
  url: string;
}

export interface VKVideoDetails {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  playerUrl?: string;
  streams?: VKVideoStream[];
  directUrl?: string;
}

export interface PeerAudioParticipant {
  identity: string;
  name: string;
  avatar?: string;
  color?: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened?: boolean;
  volume: number;
  stream?: any;
}

export type LiveKitParticipant = PeerAudioParticipant;

export interface VoiceChatState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  selectedAudioDevice?: string;
  peers: Record<string, PeerAudioParticipant>;
  error?: string | null;
}

export type LiveKitState = VoiceChatState;

// ==========================================
// AI ASSISTANT TYPES & INTERFACES
// ==========================================

export type AIAnalysisType = 'scene' | 'summary' | 'translation' | 'qna' | 'objects' | 'context';

export interface AISceneAnalysis {
  timestamp: number;
  currentTime: number;
  videoUrl?: string;
  sceneDescription: string;
  detectedObjects: string[];
  currentAction: string;
  emotionalTone: string;
  contextSummary: string;
  suggestedQuestions?: string[];
}

export interface AISummary {
  timestamp: number;
  timeRange: string;
  summary: string;
  keyPoints: string[];
  highlights: string[];
}

export interface AITranslation {
  timestamp: number;
  originalText?: string;
  translatedText: string;
  language: string;
  detectedLanguage?: string;
  lines?: { speaker?: string; text: string; translation: string }[];
}

export interface AIChatModeration {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  originalText: string;
  isToxic: boolean;
  toxicityScore: number; // 0 to 1
  reason: string;
  suggestedAction: 'none' | 'warn' | 'mute' | 'kick' | 'clean';
  cleanedText?: string;
  timestamp: number;
  applied?: boolean;
}

export interface AIModerationAlert {
  id: string;
  type: 'loud_mic' | 'chat_spam' | 'toxic_behavior' | 'afk_user';
  userId: string;
  userName: string;
  userAvatar?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestedAction: 'mute' | 'warn' | 'kick';
  timestamp: number;
}

export interface AIHostHelp {
  timestamp: number;
  summary: string;
  alerts: AIModerationAlert[];
  tips: string[];
  uiExplanations: { control: string; description: string }[];
}

export interface AIGuestHelp {
  topic: string;
  answer: string;
  guideSteps?: string[];
  faqList?: { q: string; a: string; category: string }[];
}

export interface AIActivityUserStats {
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  messageCount: number;
  speakingScore: number;
  warningCount: number;
  isFlagged?: boolean;
  lastActive: number;
}

export interface AIActivityReport {
  timestamp: number;
  totalMembers: number;
  overallActivityScore: number; // 0 - 100
  roomMood: string; // e.g. "Весёлая", "Динамичная", "Спокойная", "Шумная"
  topSpeakers: { userId: string; name: string; avatar?: string; color?: string; score: number }[];
  topChatters: { userId: string; name: string; avatar?: string; color?: string; count: number }[];
  flaggedUsers: { userId: string; name: string; avatar?: string; warnings: number; lastReason: string }[];
  recommendations: string[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  type?: 'chat' | 'analysis' | 'help' | 'moderation';
}

// ==========================================
// WATCH PARTY & INTERACTIVE SUITE TYPES
// ==========================================

export interface VideoReaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userColor?: string;
  timestamp: number;
  xPercent: number;
  yPercent: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // userIds
}

export interface Poll {
  id: string;
  roomId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  expiresAt?: number;
  isClosed: boolean;
  totalVotes: number;
}

export type RoomLayoutMode = 'standard' | 'cinema' | 'streamer';

export interface SyncStatusInfo {
  isSyncing: boolean;
  driftSeconds: number;
  latencyMs: number;
  lastSyncedAt: number;
  serverTime: number;
  localTime: number;
}

export interface VoiceActivityItem {
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  isSpeaking: boolean;
  isLoud: boolean; // audioLevel > 80
  audioLevel: number; // 0 - 100
  isMuted: boolean;
}


