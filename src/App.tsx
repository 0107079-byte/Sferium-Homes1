import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tv, 
  Users, 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Power, 
  Sliders,
  Play,
  Pause,
  Lock,
  Zap,
  Radio,
  User,
  Sparkles,
  X,
  Unlock as LockOpen
} from "lucide-react";
import VideoSelector from "./components/VideoSelector";
import UniversalPlayer from "./components/UniversalPlayer";
import AuthModal from "./components/AuthModal";
import RoomDashboard from "./components/RoomDashboard";
import UserProfileModal from "./components/UserProfileModal";
import RemoteControlPanel from "./components/RemoteControlPanel";
import VoicePanel from "./components/VoicePanel";
import ChatPanel from "./components/ChatPanel";
import HostPanel from "./components/HostPanel";
import ParticipantList from "./components/ParticipantList";
import HamburgerMenu from "./components/HamburgerMenu";
import Lobby from "./components/Lobby";
import { AIProvider } from "./context/AIContext";
import { RoomState, ChatMessage, VideoProvider, RoomSummary, CreateRoomPayload, UserStatus, UserAudioSettings, UserVideoSettings, UserProfile } from "./types";
import { fetchRoomsApi, createRoomApi, deleteRoomApi } from "./services/rooms";
import { syncSocket } from "./ws/socket";
import { rtcManager } from "./modules/rtc";
import { userManager } from "./modules/user";
import { notificationManager, AppNotification } from "./utils/notifications";
import { typingManager } from "./utils/typingIndicator";
import { pushManager } from "./utils/pushNotifications";
import UserAvatar from "./components/UserAvatar";

// Random usernames & avatars for fast initial login
const PRESET_NAMES = ["Киноман", "Эфирщик", "Медиагуру", "Телезритель", "Спутник", "Астронавт"];
const PRESET_AVATARS = ["🍿", "👾", "🎬", "🚀", "🪐", "🦊", "🐼", "🤖", "🍕", "📺"];
const PRESET_COLORS = [
  "text-indigo-400 border-indigo-400 bg-indigo-950/20",
  "text-emerald-400 border-emerald-400 bg-emerald-950/20",
  "text-rose-400 border-rose-400 bg-rose-950/20",
  "text-amber-400 border-amber-400 bg-amber-950/20",
  "text-sky-400 border-sky-400 bg-sky-950/20",
  "text-fuchsia-400 border-fuchsia-400 bg-fuchsia-950/20",
];

// 1. Detect Provider function
export function detectProvider(url: string): VideoProvider {
  if (!url) return "unknown";
  const cleanUrl = url.trim();
  if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) return "youtube";
  if (cleanUrl.includes("vk.com") || cleanUrl.includes("vkvideo.ru")) return "vk";
  if (cleanUrl.includes("rutube.ru")) return "rutube";
  if (cleanUrl.includes("yandex.ru") || cleanUrl.includes("dzen.ru")) return "yandex";
  if (cleanUrl.match(/\.(mp4|webm|mov|m3u8|mpd)(\?.*)?$/i)) return "direct";
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) return "direct";
  return "unknown";
}

// 2. Extract Video ID function
export function extractVideoId(url: string, provider: VideoProvider): string {
  if (!url) return "";
  const cleanUrl = url.trim();

  try {
    if (provider === "youtube") {
      if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
      const match = cleanUrl.match(/(?:v=|\/embed\/|\/shorts\/|\/v\/|youtu\.be\/|\/watch\?.*v=)([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) return match[1];

      try {
        const parsed = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`);
        const v = parsed.searchParams.get("v");
        if (v && v.length === 11) return v;
      } catch (e) {}

      return cleanUrl;
    }

    if (provider === "vk") {
      const oidMatch = cleanUrl.match(/[\?&]oid=(-?\d+)/);
      const idMatch = cleanUrl.match(/[\?&]id=(\d+)/);
      const hashMatch = cleanUrl.match(/[\?&]hash=([a-zA-Z0-9]+)/);
      const hashId = hashMatch ? `_${hashMatch[1]}` : "";
      
      if (oidMatch && idMatch) {
        return `${oidMatch[1]}_${idMatch[1]}${hashId}`;
      }

      const match = cleanUrl.match(/(?:video|clip|z=video)(-?\d+)_(\d+)(?:_([a-zA-Z0-9]+))?/);
      if (match) {
        const finalHash = match[3] ? `_${match[3]}` : hashId;
        return `${match[1]}_${match[2]}${finalHash}`;
      }

      const rawMatch = cleanUrl.match(/^(-?\d+)_(\d+)(?:_([a-zA-Z0-9]+))?$/);
      if (rawMatch) {
        return cleanUrl;
      }

      return cleanUrl;
    }

    if (provider === "rutube") {
      const hexMatch = cleanUrl.match(/([a-fA-F0-9]{32})/);
      if (hexMatch) return hexMatch[1];

      const match = cleanUrl.match(/rutube\.ru\/(?:video|play\/embed|shorts)\/(?:private\/)?([a-zA-Z0-9_-]+)/);
      if (match && match[1] !== 'private') return match[1];

      return cleanUrl;
    }

    if (provider === "yandex") {
      const dzenMatch = cleanUrl.match(/dzen\.ru\/(?:video\/watch|embed)\/([a-zA-Z0-9_-]+)/);
      if (dzenMatch) return dzenMatch[1];
      return cleanUrl;
    }

    if (provider === "direct") {
      return cleanUrl;
    }
  } catch (e) {
    console.error("Error extracting ID:", e);
  }

  return cleanUrl;
}

// 0. Parse and sanitize Room ID from URL, code, path, query, or pasted link
export function parseRoomId(input: string): string {
  if (!input) return "";
  let str = input.trim();
  // Strip query parameters and hashes
  str = str.replace(/[?#].*$/, "");
  // Strip leading/trailing slashes
  str = str.replace(/^\/+|\/+$/g, "");

  // Extract room ID from known URL patterns
  if (str.includes("/room/")) {
    str = str.split("/room/").pop() || "";
  } else if (str.includes("/invite/")) {
    str = str.split("/invite/").pop() || "";
  } else if (str.includes("room=")) {
    const match = str.match(/room=([^&]+)/);
    if (match) str = match[1] || "";
  }

  // Clean up any remaining URL slashes or domain prefixes
  if (str.includes("/")) {
    str = str.split("/").pop() || "";
  }

  // Remove trailing slashes or spaces
  str = str.replace(/\/+$/g, "").trim().toUpperCase();
  return str;
}

function generateSecureRoomId(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

import appLogo from "./assets/images/app_logo_1786022618121.jpg";

export function App() {
  const [currentUser, setCurrentUser] = useState(() => userManager.getUser());
  const [userId, setUserId] = useState(() => currentUser.userId);
  const [userName, setUserName] = useState(() => currentUser.name);
  const [userAvatar, setUserAvatar] = useState(() => currentUser.avatar);
  const [userColor, setUserColor] = useState(() => currentUser.color);
  const [userStatus, setUserStatus] = useState<UserStatus>(() => currentUser.status);
  const [userCustomStatus, setUserCustomStatus] = useState(() => currentUser.customStatus || "");
  const [userBio, setUserBio] = useState(() => currentUser.bio || "");
  const [userMicSettings, setUserMicSettings] = useState<UserAudioSettings>(() => currentUser.micSettings);
  const [userCameraSettings, setUserCameraSettings] = useState<UserVideoSettings>(() => currentUser.cameraSettings);

  useEffect(() => {
    const unsub = userManager.subscribe((u) => {
      setCurrentUser(u);
      setUserId(u.userId);
      setUserName(u.name);
      setUserAvatar(u.avatar);
      setUserColor(u.color);
      setUserStatus(u.status);
      setUserCustomStatus(u.customStatus || "");
      setUserBio(u.bio || "");
      setUserMicSettings(u.micSettings);
      setUserCameraSettings(u.cameraSettings);
    });
    return unsub;
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [recentRooms, setRecentRooms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sferium_recent_rooms");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const addRoomToHistory = (id: string) => {
    if (!id) return;
    setRecentRooms((prev) => {
      const updated = [id, ...prev.filter((r) => r !== id)].slice(0, 10);
      localStorage.setItem("sferium_recent_rooms", JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearHistory = () => {
    setRecentRooms([]);
    localStorage.removeItem("sferium_recent_rooms");
  };

  const handleAuth = (provider: string, token: string) => {
    if (token) {
      localStorage.setItem(`sferium_${provider.toLowerCase()}_token`, token);
    } else {
      localStorage.removeItem(`sferium_${provider.toLowerCase()}_token`);
    }
  };

  const [roomId, setRoomId] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Lobby rooms state
  const [lobbyRooms, setLobbyRooms] = useState<RoomSummary[]>([]);
  const [isLoadingLobby, setIsLoadingLobby] = useState(false);
  const lobbyWsRef = useRef<WebSocket | null>(null);

  const loadLobbyRooms = async () => {
    setIsLoadingLobby(true);
    try {
      const list = await fetchRoomsApi();
      if (Array.isArray(list)) {
        setLobbyRooms(list);
      }
    } catch (err) {
      console.warn("Error fetching rooms in lobby:", err);
    } finally {
      setIsLoadingLobby(false);
    }
  };

  useEffect(() => {
    if (isInRoom) {
      if (lobbyWsRef.current) {
        lobbyWsRef.current.close();
        lobbyWsRef.current = null;
      }
      return;
    }

    loadLobbyRooms();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?roomId=LOBBY&userId=${userId}&name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}&color=${encodeURIComponent(userColor)}`;

    try {
      const ws = new WebSocket(wsUrl);
      lobbyWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "rooms:list" && Array.isArray(msg.rooms)) {
            setLobbyRooms(msg.rooms);
            setIsLoadingLobby(false);
          }
        } catch (e) {}
      };
    } catch (e) {
      console.warn("Lobby WS error:", e);
    }

    return () => {
      if (lobbyWsRef.current) {
        lobbyWsRef.current.close();
        lobbyWsRef.current = null;
      }
    };
  }, [isInRoom, userId, userName, userAvatar, userColor]);

  const handleCreateRoom = async (payload: CreateRoomPayload) => {
    const result = await createRoomApi(payload);
    if (result.success && result.room) {
      handleJoinOrCreateRoom(result.room.roomId);
    } else {
      throw new Error(result.error || "Не удалось создать комнату");
    }
  };

  const handleDeleteRoom = async (targetRoomId: string) => {
    const res = await deleteRoomApi(targetRoomId, userId);
    if (res.success) {
      setLobbyRooms((prev) => prev.filter((r) => r.roomId !== targetRoomId));
    } else {
      alert(res.error || "Не удалось удалить комнату");
    }
  };

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [anyoneCanControl, setAnyoneCanControl] = useState(false);
  const [isMediaCenterOpen, setIsMediaCenterOpen] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const playerRef = useRef<any>(null);
  const roomStateRef = useRef<RoomState | null>(null);
  const lastHeartbeatSentRef = useRef<number>(0);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  // Subscribe to floating toast notifications
  useEffect(() => {
    const unsub = notificationManager.subscribeToToasts((toasts) => {
      setActiveToasts([...toasts]);
    });
    return unsub;
  }, []);

  // Sync typing manager context
  useEffect(() => {
    typingManager.initContext(
      roomId,
      userId,
      userName,
      userAvatar,
      (payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
      }
    );
  }, [roomId, userId, userName, userAvatar]);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentMember = roomState?.members[userId];
  const isHost = currentMember?.isHost || roomState?.hostId === userId || false;
  const canIControl = isHost || anyoneCanControl;

  const handleSaveProfile = (profile: Partial<UserProfile>) => {
    userManager.setUser(profile);

    // Update current local room state
    setRoomState((prev) => {
      if (!prev || !prev.members[userId]) return prev;
      return {
        ...prev,
        members: {
          ...prev.members,
          [userId]: {
            ...prev.members[userId],
            name: profile.name || prev.members[userId].name,
            avatar: profile.avatar || prev.members[userId].avatar,
            color: profile.color || prev.members[userId].color,
            status: profile.status || prev.members[userId].status,
            customStatus: profile.customStatus !== undefined ? profile.customStatus : prev.members[userId].customStatus,
            bio: profile.bio !== undefined ? profile.bio : prev.members[userId].bio,
            micSettings: profile.micSettings || prev.members[userId].micSettings,
            cameraSettings: profile.cameraSettings || prev.members[userId].cameraSettings,
          },
        },
      };
    });

    // Send WebSocket events
    const updatePayload = {
      name: profile.name || userName,
      avatar: profile.avatar || userAvatar,
      color: profile.color || userColor,
      status: profile.status || userStatus,
      customStatus: profile.customStatus !== undefined ? profile.customStatus : userCustomStatus,
      bio: profile.bio !== undefined ? profile.bio : userBio,
      micSettings: profile.micSettings || userMicSettings,
      cameraSettings: profile.cameraSettings || userCameraSettings,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "user:update",
          userId,
          ...updatePayload,
        })
      );
      if (profile.color) {
        wsRef.current.send(
          JSON.stringify({
            type: "user:color",
            userId,
            color: profile.color,
          })
        );
      }
    }

    syncSocket.sendUserUpdate(updatePayload);
    if (profile.color) {
      syncSocket.sendUserColor(profile.color);
    }
  };

  useEffect(() => {
    if (!roomState?.videoUrl) {
      setVideoDuration(0);
      return;
    }

    const provider = roomState.provider;
    const videoId = roomState.videoId;

    if (provider === "vk" && videoId) {
      const token = localStorage.getItem("sferium_vk_token") || "";
      fetch(`/api/vk/resolve?video_id=${videoId}&videoId=${videoId}&token=${encodeURIComponent(token)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.duration) {
            setVideoDuration(data.duration);
          }
        })
        .catch((err) => console.warn("Error resolving duration for VK:", err));
    } else if (provider === "direct") {
      const tempVideo = document.createElement("video");
      tempVideo.src = roomState.videoUrl;
      tempVideo.onloadedmetadata = () => {
        if (tempVideo.duration && !isNaN(tempVideo.duration) && tempVideo.duration !== Infinity) {
          setVideoDuration(tempVideo.duration);
        }
      };
    }
  }, [roomState?.videoUrl, roomState?.videoId, roomState?.provider]);

  const handleJoinOrCreateRoom = (targetRoomId: string) => {
    const cleanRoomId = parseRoomId(targetRoomId) || "CINEMA";
    setRoomId(cleanRoomId);
    setIsInRoom(true);
    addRoomToHistory(cleanRoomId);

    window.history.pushState({}, "", `/room/${cleanRoomId}`);

    // Initialize local roomState immediately so player works even without WS backend
    const initialRoomState: RoomState = {
      roomId: cleanRoomId,
      hostId: userId,
      videoUrl: "",
      provider: "unknown",
      currentTime: 0,
      playing: false,
      playbackRate: 1,
      members: {
        [userId]: {
          id: userId,
          userId: userId,
          name: userName,
          avatar: userAvatar,
          color: userColor,
          isHost: false, // Server will assign true host status in room_state
        }
      },
      chatHistory: [
        {
          id: "sys_1",
          type: "system",
          text: `Зал ${cleanRoomId} готов. Вставьте ссылку на видео или выберите из списка!`,
          timestamp: Date.now()
        }
      ],
      anyoneCanControl: false,
    };

    setRoomState((prev) => {
      if (!prev || prev.roomId !== cleanRoomId) {
        return initialRoomState;
      }
      return prev;
    });

    // Set up BroadcastChannel for local/multi-tab sync
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
    }
    try {
      const bc = new BroadcastChannel(`sferium_room_${cleanRoomId}`);
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        const message = event.data;
        if (!message) return;
        if (message.type === "change_video") {
          setRoomState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              videoUrl: message.videoUrl,
              provider: message.provider,
              videoId: message.videoId,
              currentTime: 0,
              playing: true,
            };
          });
          setLocalTime(0);
        } else if (message.type === "playback_change") {
          setRoomState((prev) => prev ? { ...prev, playing: message.playing, currentTime: message.currentTime ?? prev.currentTime } : null);
          if (message.playing) playerRef.current?.play();
          else playerRef.current?.pause();
        } else if (message.type === "sync_seek") {
          setRoomState((prev) => prev ? { ...prev, currentTime: message.currentTime } : null);
          setLocalTime(message.currentTime);
          playerRef.current?.seekTo(message.currentTime);
        } else if (message.type === "chat_message") {
          setRoomState((prev) => prev ? { ...prev, chatHistory: [...prev.chatHistory, message.message] } : null);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?roomId=${cleanRoomId}&userId=${userId}&name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(userAvatar)}&color=${encodeURIComponent(userColor)}`;

    console.log('Connecting to TV Socket:', wsUrl);
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established successfully!");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received server event:", message.type, message);

          switch (message.type) {
            case 'room_state':
              setRoomState(message.state);
              setAnyoneCanControl(message.state.anyoneCanControl !== false);
              if (message.state.currentTime !== undefined) {
                setLocalTime(message.state.currentTime);
              }
              break;
            case 'player:state':
            case 'playback_change': {
              const newPlaying = Boolean(message.playing ?? (message.state === 'playing'));
              const newTime = message.currentTime !== undefined ? message.currentTime : message.time;

              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  playing: newPlaying,
                  isPlaying: newPlaying,
                  ...(newTime !== undefined ? { currentTime: newTime } : {}),
                };
              });

              if (newTime !== undefined) {
                setLocalTime(newTime);
              }

              if (message.senderId !== userId && playerRef.current) {
                if (newTime !== undefined) {
                  const cur = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
                  if (Math.abs(cur - newTime) > 0.2) {
                    playerRef.current.seekTo(newTime);
                  }
                }
                if (newPlaying) {
                  playerRef.current.play();
                } else {
                  playerRef.current.pause();
                }
              }
              break;
            }
            case 'player:seek':
            case 'sync_seek': {
              const targetTime = message.currentTime !== undefined ? message.currentTime : message.time;
              if (targetTime !== undefined) {
                setLocalTime(targetTime);
                setRoomState((prev) => prev ? { ...prev, currentTime: targetTime } : null);
                if (message.senderId !== userId && playerRef.current) {
                  playerRef.current.seekTo(targetTime);
                }
              }
              break;
            }
            case 'player:heartbeat':
            case 'heartbeat_sync': {
              const currentRoomState = roomStateRef.current;
              const isMeHost = currentRoomState?.members[userId]?.isHost || false;
              
              const serverTime = Number(message.currentTime !== undefined ? message.currentTime : message.time);
              const serverPlaying = Boolean(message.playing ?? message.isPlaying ?? (message.state === 'playing'));

              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  currentTime: serverTime,
                  playing: serverPlaying,
                  isPlaying: serverPlaying,
                };
              });

              setLocalTime(serverTime);

              // Hard Sync Drift Correction (< 0.2s) for Slave Player
              if (message.senderId !== userId && playerRef.current) {
                const localT = playerRef.current.getCurrentTime ? (playerRef.current.getCurrentTime() || 0) : 0;
                const diff = Math.abs(serverTime - localT);
                
                if (diff > 0.2) {
                  playerRef.current.seekTo(serverTime);
                }
                
                if (serverPlaying) {
                  playerRef.current.play();
                } else {
                  playerRef.current.pause();
                }
              }
              break;
            }
            case "apply_force_sync": {
              if (message.currentTime !== undefined) {
                setLocalTime(message.currentTime);
                playerRef.current?.seekTo(message.currentTime);
              }
              break;
            }
            case "error":
              alert(message.message);
              break;
            case "voice:peers_list":
              if (Array.isArray(message.peers)) {
                rtcManager.handlePeersList(message.peers);
              }
              break;
            case "voice:user_joined":
              if (message.peer) {
                rtcManager.handleUserJoined(message.peer);
              }
              break;
            case "voice:user_left":
              if (message.userId) {
                rtcManager.handleUserLeft(message.userId);
              }
              break;
            case "voice:offer":
              if (message.fromUserId && message.offer) {
                rtcManager.handleOffer(message.fromUserId, message.offer, {
                  name: message.name,
                  avatar: message.avatar,
                  color: message.color,
                });
              }
              break;
            case "voice:answer":
              if (message.fromUserId && message.answer) {
                rtcManager.handleAnswer(message.fromUserId, message.answer);
              }
              break;
            case "voice:ice_candidate":
            case "voice:ice":
              if (message.fromUserId && (message.candidate || message.ice)) {
                rtcManager.handleIceCandidate(message.fromUserId, message.candidate || message.ice);
              }
              break;
            case "voice:state":
              if (message.userId) {
                rtcManager.handlePeerState(message.userId, message.isMuted, message.isDeafened);
              }
              break;
            case "chat_broadcast":
            case "chat:newMessage":
              setRoomState((prev) => {
                if (!prev) return null;
                const newMessage = message.message;
                if (newMessage.type === "system") {
                  const isDuplicate = prev.chatHistory.slice(-5).some((m) => {
                    return (
                      m.type === "system" &&
                      m.text === newMessage.text &&
                      Math.abs(newMessage.timestamp - m.timestamp) < 3000
                    );
                  });
                  if (isDuplicate) {
                    return prev;
                  }
                }
                return {
                  ...prev,
                  chatHistory: [...prev.chatHistory, newMessage],
                };
              });

              // Dispatch notification & sound if message is from another user
              if (message.message && message.message.userId !== userId && message.message.type !== "system") {
                notificationManager.pushNotification({
                  type: 'chat',
                  title: message.message.name || 'Сообщение в чате',
                  message: message.message.text || '',
                  category: 'chat',
                });
              }
              break;

            case "chat:typing":
            case "typing":
              if (message.userId && message.userId !== userId) {
                typingManager.handleUserTyping(
                  message.userId,
                  message.name || 'Участник',
                  message.avatar || '🍿',
                  message.isTyping !== false
                );
              }
              break;

            case "room:userJoined":
              if (message.userId !== userId) {
                notificationManager.pushNotification({
                  type: 'user_join',
                  title: 'Новый зритель',
                  message: `${message.name || 'Участник'} вошел в комнату`,
                  category: 'participants',
                });
              }
              break;

            case "room:userLeft":
              if (message.userId !== userId) {
                notificationManager.pushNotification({
                  type: 'user_leave',
                  title: 'Зритель вышел',
                  message: `${message.name || 'Участник'} покинул комнату`,
                  category: 'participants',
                });
              }
              break;

            case "members_update":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  members: message.members,
                };
              });
              break;
            case "voice:active":
            case "voice:speaking":
            case "voice_speaking":
              setRoomState((prev) => {
                if (!prev || !message.userId || !prev.members[message.userId]) return prev;
                return {
                  ...prev,
                  members: {
                    ...prev.members,
                    [message.userId]: {
                      ...prev.members[message.userId],
                      isSpeaking: Boolean(message.isSpeaking),
                      audioLevel: typeof message.volume === "number" ? message.volume : message.audioLevel ?? 0,
                    },
                  },
                };
              });
              break;
            case "user:update":
            case "user:profile":
              setRoomState((prev) => {
                if (!prev || !message.userId || !prev.members[message.userId]) return prev;
                return {
                  ...prev,
                  members: {
                    ...prev.members,
                    [message.userId]: {
                      ...prev.members[message.userId],
                      ...(message.name ? { name: message.name } : {}),
                      ...(message.avatar ? { avatar: message.avatar } : {}),
                      ...(message.color ? { color: message.color } : {}),
                      ...(message.status ? { status: message.status } : {}),
                      ...(message.customStatus !== undefined ? { customStatus: message.customStatus } : {}),
                      ...(message.bio !== undefined ? { bio: message.bio } : {}),
                    },
                  },
                };
              });
              break;
            case "user:color":
              setRoomState((prev) => {
                if (!prev || !message.userId || !prev.members[message.userId]) return prev;
                return {
                  ...prev,
                  members: {
                    ...prev.members,
                    [message.userId]: {
                      ...prev.members[message.userId],
                      color: message.color,
                    },
                  },
                };
              });
              break;
            case "room:newHost":
              notificationManager.pushNotification({
                type: 'host_change',
                title: 'Смена хоста',
                message: `${message.newHostName || 'Участник'} стал создателем комнаты`,
                category: 'host',
              });
              setRoomState((prev) => {
                if (!prev) return null;
                const updatedMembers = { ...prev.members };
                Object.keys(updatedMembers).forEach((uid) => {
                  updatedMembers[uid] = {
                    ...updatedMembers[uid],
                    isHost: uid === message.newHostId,
                    role: uid === message.newHostId ? "host" : (updatedMembers[uid].role === "host" ? "member" : updatedMembers[uid].role),
                  };
                });
                return {
                  ...prev,
                  hostId: message.newHostId,
                  hostName: message.newHostName || prev.hostName,
                  hostAvatar: message.newHostAvatar || prev.hostAvatar,
                  members: updatedMembers,
                };
              });
              break;

            case "room:userKicked":
            case "kicked":
              if (message.targetUserId === userId || message.userId === userId) {
                notificationManager.pushNotification({
                  type: 'mod_kick',
                  title: 'Исключение',
                  message: `Вы были исключены из комнаты создателем: ${message.reason || "Без объяснения причин"}`,
                  category: 'host',
                });
                alert(`Вы были исключены из комнаты создателем: ${message.reason || "Без объяснения причин"}`);
                handleExitRoom();
              } else if (message.targetUserId) {
                notificationManager.pushNotification({
                  type: 'mod_kick',
                  title: 'Исключение',
                  message: `Участник был исключен из комнаты создателем`,
                  category: 'host',
                });
                setRoomState((prev) => {
                  if (!prev) return null;
                  const newMembers = { ...prev.members };
                  delete newMembers[message.targetUserId];
                  return { ...prev, members: newMembers };
                });
              }
              break;

            case "room:userMuted":
            case "voice:force_mute":
              if (message.targetUserId === userId) {
                if (message.isMuted) {
                  rtcManager.setLocalMute(true);
                }
                notificationManager.pushNotification({
                  type: 'mod_mute',
                  title: 'Микрофон',
                  message: message.isMuted ? 'Создатель выключил ваш микрофон' : 'Создатель включил ваш микрофон',
                  category: 'participants',
                });
              } else {
                notificationManager.pushNotification({
                  type: 'mod_mute',
                  title: 'Модерация',
                  message: `Микрофон участника был ${message.isMuted ? 'отключен' : 'включен'} создателем`,
                  category: 'participants',
                });
              }
              setRoomState((prev) => {
                if (!prev || !prev.members[message.targetUserId]) return prev;
                return {
                  ...prev,
                  members: {
                    ...prev.members,
                    [message.targetUserId]: {
                      ...prev.members[message.targetUserId],
                      isMutedByMod: Boolean(message.isMuted),
                    },
                  },
                };
              });
              break;

            case "room:closed":
            case "room_closed":
            case "room_closed_notification":
              notificationManager.pushNotification({
                type: 'room_close',
                title: 'Комната закрыта',
                message: message.reason || message.message || "Все участники покинули комнату. Комната закрыта.",
                category: 'host',
              });
              alert(message.reason || message.message || "Все участники покинули комнату. Комната закрыта.");
              handleExitRoom();
              break;

            case "room:updateParticipants":
              if (Array.isArray(message.members)) {
                const memberMap: Record<string, any> = {};
                message.members.forEach((m: any) => {
                  memberMap[m.userId] = m;
                });
                setRoomState((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    members: memberMap,
                    hostId: message.hostId || prev.hostId,
                  };
                });
              }
              break;
            default:
              break;
          }
        } catch (err) {
          console.error("Error processing websocket message", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected.");
      };

      ws.onerror = (err) => {
        console.warn("WebSocket unavailable:", err);
      };
    } catch (e) {
      console.warn("Could not connect to WebSocket:", e);
    }
  };

  const handleExitRoom = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "exit_room" }));
      wsRef.current.close();
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setRoomState(null);
    setIsInRoom(false);
    window.history.pushState({}, "", "/");
  };

  const handleCopyLink = () => {
    const cleanId = parseRoomId(roomId) || roomId;
    const inviteLink = `${window.location.origin}/room/${cleanId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    const checkAndJoinFromUrl = () => {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      const targetRoomId = parseRoomId(fullPath);

      if (targetRoomId) {
        setRoomId(targetRoomId);
        handleJoinOrCreateRoom(targetRoomId);
      }
    };

    checkAndJoinFromUrl();

    window.addEventListener("popstate", checkAndJoinFromUrl);
    window.addEventListener("hashchange", checkAndJoinFromUrl);

    return () => {
      window.removeEventListener("popstate", checkAndJoinFromUrl);
      window.removeEventListener("hashchange", checkAndJoinFromUrl);
    };
  }, []);


  const handleSelectVideo = (videoUrl: string) => {
    if (!videoUrl || !videoUrl.trim()) return;
    if (!canIControl) {
      alert("Управление заблокировано создателем комнаты");
      return;
    }

    const cleanUrl = videoUrl.trim();
    const provider = detectProvider(cleanUrl);
    const videoId = extractVideoId(cleanUrl, provider);

    // 1. Always update local state immediately
    setRoomState((prev) => {
      const baseState = prev || {
        roomId: roomId || "CINEMA",
        hostId: userId,
        videoUrl: cleanUrl,
        provider: provider,
        videoId: videoId,
        currentTime: 0,
        playing: true,
        playbackRate: 1,
        members: {
          [userId]: {
            id: userId,
            userId: userId,
            name: userName,
            avatar: userAvatar,
            color: userColor,
            isHost: true,
          }
        },
        chatHistory: [],
        anyoneCanControl: anyoneCanControl,
      };

      return {
        ...baseState,
        videoUrl: cleanUrl,
        provider: provider,
        videoId: videoId,
        currentTime: 0,
        playing: true,
      };
    });

    setLocalTime(0);
    setVideoDuration(0);
    setIsMediaCenterOpen(false);

    // 2. Broadcast via BroadcastChannel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "change_video",
        videoUrl: cleanUrl,
        provider: provider,
        videoId: videoId,
      });
    }

    // 3. Send over WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "change_video",
          videoUrl: cleanUrl,
        })
      );
    }
  };

  const sendVideoSync = (action: 'play' | 'pause' | 'seek', currentTime: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isHost) {
      wsRef.current.send(
        JSON.stringify({
          type: 'VIDEO_SYNC',
          action: action,
          currentTime: currentTime,
          roomId: roomId,
        })
      );
    }
  };

  const handleRemotePlay = () => {
    if (!canIControl) return;
    const currentT = localTime || playerRef.current?.getCurrentTime() || 0;

    setRoomState((prev) => prev ? { ...prev, playing: true, isPlaying: true, currentTime: currentT } : null);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "playback_change",
        playing: true,
        currentTime: currentT,
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "player:state",
          playing: true,
          isPlaying: true,
          state: "playing",
          currentTime: currentT,
          time: currentT,
          playbackRate: 1,
        })
      );
      wsRef.current.send(
        JSON.stringify({
          type: "sync_play",
          currentTime: currentT,
        })
      );
    }
  };

  const handleRemotePause = () => {
    if (!canIControl) return;
    const currentT = localTime || playerRef.current?.getCurrentTime() || 0;

    setRoomState((prev) => prev ? { ...prev, playing: false, isPlaying: false, currentTime: currentT } : null);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "playback_change",
        playing: false,
        currentTime: currentT,
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "player:state",
          playing: false,
          isPlaying: false,
          state: "paused",
          currentTime: currentT,
          time: currentT,
          playbackRate: 1,
        })
      );
      wsRef.current.send(
        JSON.stringify({
          type: "sync_pause",
          currentTime: currentT,
        })
      );
    }
  };

  const handleRemoteSeek = (time: number) => {
    if (!canIControl) return;

    setLocalTime(time);
    setRoomState((prev) => prev ? { ...prev, currentTime: time } : null);

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "sync_seek",
        currentTime: time,
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "player:seek",
          currentTime: time,
          time: time,
          playing: roomState?.playing ?? true,
        })
      );
      wsRef.current.send(
        JSON.stringify({
          type: "sync_seek",
          currentTime: time,
        })
      );
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === null || secs === undefined || secs < 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    const mStr = m < 10 ? `0${m}` : `${m}`;
    const sStr = s < 10 ? `0${s}` : `${s}`;

    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  const handleSkipTime = (seconds: number) => {
    if (!canIControl) return;
    const currentT = localTime || playerRef.current?.getCurrentTime() || 0;
    const targetT = Math.max(0, currentT + seconds);
    playerRef.current?.seekTo(targetT, true);
    handleRemoteSeek(targetT);
  };

  const handleForceSyncAll = () => {
    if (!isHost) return;
    const currentT = localTime || playerRef.current?.getCurrentTime() || 0;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "player:seek",
          currentTime: currentT,
          time: currentT,
          playing: roomState?.playing ?? true,
        })
      );
      wsRef.current.send(
        JSON.stringify({
          type: "force_sync",
          currentTime: currentT,
        })
      );
    }
  };

  const handleRemoteTimeUpdate = (time: number) => {
    setLocalTime(time);

    const currentRoomState = roomStateRef.current;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !currentRoomState) return;
    const isMeHost = currentRoomState.members[userId]?.isHost || currentRoomState.anyoneCanControl;
    if (isMeHost) {
      const now = Date.now();
      if (now - lastHeartbeatSentRef.current >= 750) {
        lastHeartbeatSentRef.current = now;
        wsRef.current.send(
          JSON.stringify({
            type: "player:heartbeat",
            currentTime: time,
            time: time,
            playing: currentRoomState.playing || false,
            isPlaying: currentRoomState.playing || false,
            state: currentRoomState.playing ? "playing" : "paused",
            playbackRate: 1,
          })
        );
        wsRef.current.send(
          JSON.stringify({
            type: "heartbeat_update",
            currentTime: time,
            playing: currentRoomState.playing || false,
          })
        );
      }
    }
  };

  const handleKickUser = (targetUserId: string, reason?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "room:kick",
          targetUserId,
          reason: reason || "Исключен создателем комнаты",
        })
      );
    }
    syncSocket.kickUser(targetUserId, reason);
  };

  const handleMuteUser = (targetUserId: string, isMuted: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "room:mute",
          targetUserId,
          isMuted,
        })
      );
    }
    syncSocket.muteUser(targetUserId, isMuted);
  };

  const handleCloseRoom = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "room:close",
          roomId,
          userId,
        })
      );
    }
    syncSocket.closeRoom();
    handleExitRoom();
  };

  const handleStartBroadcast = (options: { mic?: boolean; videoUrl?: string; playing?: boolean }) => {
    if (options.mic === false) {
      rtcManager.setLocalMute(true);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "room:hostAction",
          action: "startBroadcast",
          roomId,
          ...options,
        })
      );
    }
    syncSocket.startBroadcast(options);
  };

  const handleTransferHost = (targetUserId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "room:hostAction",
          action: "transferHost",
          roomId,
          newHostId: targetUserId,
        })
      );
    }
    syncSocket.sendHostAction("transferHost", { newHostId: targetUserId });
  };

  const handleSendChatMessage = (text: string) => {
    const cleanMsg = text.trim();
    if (!cleanMsg) return;

    const newMsgObj: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substring(2, 9),
      type: "user",
      userId: userId,
      name: userName,
      avatar: userAvatar,
      text: cleanMsg,
      timestamp: Date.now(),
      reactions: {},
    };

    setRoomState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        chatHistory: [...prev.chatHistory, newMsgObj],
      };
    });

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "chat_message",
        message: newMsgObj,
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat_message",
          text: cleanMsg,
        })
      );
    }
  };

  const handleToggleControlMode = () => {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "toggle_control",
      })
    );
  };

  const handleSendReaction = (messageId: string, emoji: string) => {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "react_message",
        messageId,
        emoji,
      })
    );
  };

  useEffect(() => {
    if (!isHost || !wsRef.current) return;
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const now = Date.now();
        // Резервная отправка хертбита только если за последние 2.5 секунды не было сообщений
        if (now - lastHeartbeatSentRef.current >= 2500) {
          lastHeartbeatSentRef.current = now;
          const currentT = playerRef.current?.getCurrentTime() || 0;
          wsRef.current.send(JSON.stringify({
            type: "heartbeat_update",
            currentTime: currentT,
            playing: roomState?.playing || false,
          }));
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isHost, roomState?.playing]);
  const membersList = roomState ? Object.values(roomState.members) : [];

  const sendWebSocketMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  return (
    <AIProvider
      roomId={isInRoom ? roomId : undefined}
      roomState={roomState}
      currentUserId={userId}
      isHost={isHost}
      sendWebSocketMessage={sendWebSocketMessage}
    >
      <div className="min-h-screen bg-[#0d0b18] text-zinc-100 flex flex-col selection:bg-fuchsia-500/30 relative overflow-x-hidden">
        
        {/* Background Ambient Gradient Lights */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/20 via-purple-600/15 to-transparent rounded-full blur-[120px]" />
          <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] bg-gradient-to-bl from-fuchsia-600/20 via-pink-600/15 to-transparent rounded-full blur-[120px]" />
          <div className="absolute -bottom-32 left-1/3 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-transparent rounded-full blur-[140px]" />
        </div>

        {/* Global Hamburger Navigation Drawer */}
        <HamburgerMenu
          roomId={isInRoom ? roomId : undefined}
          isHost={isHost}
          members={roomState?.members || {}}
          currentUserId={userId}
          currentUser={currentUser}
          anyoneCanControl={anyoneCanControl}
          currentTime={localTime || roomState?.currentTime || 0}
          videoTitle={roomState?.currentVideoTitle || roomState?.name}
          videoUrl={roomState?.videoUrl}
          onCloseRoom={handleCloseRoom}
          onKickUser={handleKickUser}
          onMuteUser={handleMuteUser}
          onStartBroadcast={handleStartBroadcast}
          onTransferHost={handleTransferHost}
          onToggleControl={handleToggleControlMode}
          onExitRoom={handleExitRoom}
          onSaveProfile={(profile) => handleSaveProfile(profile)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />

      {/* Floating Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto bg-zinc-950/95 border border-purple-500/40 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl shadow-black/80 flex items-start justify-between gap-3 text-white"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-xl shrink-0 mt-0.5">{toast.icon || '🔔'}</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-wide truncate">{toast.title}</h4>
                  <p className="text-[11px] text-zinc-300 line-clamp-2 mt-0.5">{toast.message}</p>
                  <span className="text-[9px] text-zinc-500 font-mono mt-1 block">
                    {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => notificationManager.dismissToast(toast.id)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                title="Закрыть уведомление"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!isInRoom ? (
        <Lobby
          rooms={lobbyRooms}
          recentRooms={recentRooms}
          currentUserId={userId}
          currentUserName={userName}
          currentUserAvatar={userAvatar}
          currentUserColor={userColor}
          isGuest={currentUser.isGuest}
          authProvider={currentUser.authProvider}
          onJoinRoom={handleJoinOrCreateRoom}
          onCreateRoom={handleCreateRoom}
          onDeleteRoom={handleDeleteRoom}
          onClearRecentRooms={handleClearHistory}
          onChangeProfile={(name, avatar, color) => handleSaveProfile({ name, avatar, color })}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          isLoading={isLoadingLobby}
          onRefreshRooms={loadLobbyRooms}
        />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row h-screen overflow-hidden relative z-10">
          <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4">
            
            {/* Room Header with Gradient Border */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-900/70 border border-zinc-800/80 p-4 pl-16 rounded-2xl gap-4 backdrop-blur-md shadow-lg shadow-black/40 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExitRoom}
                  className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-fuchsia-500 p-0.5 shadow-md flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                  title="Вернуться в лобби"
                >
                  <div className="w-full h-full bg-zinc-950 rounded-[9px] flex items-center justify-center overflow-hidden">
                    <img src={appLogo} alt="Sferium Logo" className="w-full h-full object-cover rounded-[9px]" referrerPolicy="no-referrer" />
                  </div>
                </button>
                <div>
                  <h2 className="font-display font-bold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-white font-bold">Зал:</span>
                    <span className="text-white font-black tracking-widest bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 px-3 py-0.5 rounded-lg border border-purple-400/50 font-mono text-xs shadow-inner">
                      {roomId}
                    </span>
                    {roomState?.name && (
                      <span className="text-xs text-zinc-300 font-semibold truncate max-w-xs hidden sm:inline">
                        — {roomState.name}
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-white font-bold opacity-90">
                    Sferium Homes • Совместный кинозал
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleExitRoom}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Вернуться к списку комнат в лобби"
                >
                  <Tv className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">В Лобби</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-zinc-900 via-indigo-950/40 to-zinc-900 border border-zinc-800 hover:border-indigo-400/80 rounded-2xl text-zinc-200 hover:text-white font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  title="Личный кабинет и настройки профиля"
                >
                  <UserAvatar
                    avatar={userAvatar}
                    name={userName}
                    color={userColor}
                    size="xs"
                    status={userStatus}
                    showStatus
                  />
                  <span className="hidden sm:inline font-bold text-white truncate max-w-[120px]">{userName}</span>
                  {currentUser.isGuest ? (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-lg font-mono font-bold">
                      Гость
                    </span>
                  ) : (
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-lg font-mono font-bold uppercase">
                      {currentUser.authProvider || 'VK'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 rounded-xl text-indigo-400 hover:text-indigo-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Авторизовать VK, YouTube, Rutube"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Доступы</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                  title="Скопировать ссылку-приглашение"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Готово!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Пригласить</span>
                    </>
                  )}
                </button>

                <button
                  style={{
                    background: '#ff4d4d',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(255, 77, 77, 0.4)'
                  }}
                  onClick={() => import('./tests/autoTestSuite').then(m => m.runAllTests())}
                >
                  Run Auto Tests
                </button>

                <button
                  type="button"
                  onClick={handleExitRoom}
                  className="p-2 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-900/30 hover:border-rose-700/50 rounded-xl text-rose-400 transition-all cursor-pointer"
                  title="Покинуть кинозал"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isHost && (
              <HostPanel
                roomId={roomId}
                isHost={isHost}
                members={roomState?.members || {}}
                currentUserId={userId}
                anyoneCanControl={anyoneCanControl}
                onCloseRoom={handleCloseRoom}
                onKickUser={handleKickUser}
                onMuteUser={handleMuteUser}
                onStartBroadcast={handleStartBroadcast}
                onTransferHost={handleTransferHost}
                onToggleControl={handleToggleControlMode}
              />
            )}

            <div className="bg-zinc-900/40 border border-zinc-850/60 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                Панель управления видеофайлами
              </span>
              <button
                type="button"
                onClick={() => setIsMediaCenterOpen(!isMediaCenterOpen)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  isMediaCenterOpen 
                    ? "bg-indigo-600/10 text-indigo-400 border-indigo-500/20" 
                    : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-white"
                }`}
                title="Открыть панель"
              >
                {isMediaCenterOpen ? "Свернуть панель" : "Открыть панель"}
              </button>
            </div>

            {isMediaCenterOpen && (
              <div className="animate-fade-in">
                <VideoSelector
                  onSelectVideo={handleSelectVideo}
                  currentVideoUrl={roomState?.videoUrl}
                  detectProvider={detectProvider}
                />
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center min-h-[300px] gap-2">
              {/* VIDEO PLAYER */}
              <div className="w-full h-full min-h-[300px]">
                <UniversalPlayer
                  ref={playerRef}
                  roomId={roomId}
                  userId={userId}
                  videoUrl={roomState?.videoUrl || ""}
                  provider={roomState?.provider || "unknown"}
                  videoId={roomState?.videoId}
                  playing={roomState?.playing || false}
                  currentTime={roomState?.currentTime || 0}
                  isHost={isHost}
                  anyoneCanControl={anyoneCanControl}
                  ws={wsRef.current}
                  onPlay={handleRemotePlay}
                  onPause={handleRemotePause}
                  onSeek={handleRemoteSeek}
                  onTimeUpdate={handleRemoteTimeUpdate}
                  onDurationChange={(dur) => setVideoDuration(dur)}
                  onStreamRequest={(streamUrl) => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(
                        JSON.stringify({
                          type: "change_video",
                          videoUrl: streamUrl,
                        })
                      );
                    }
                  }}
                />
              </div>

              {/* REMOTE CONTROL PANEL: IMMEDIATELY UNDER PLAYER (COLLAPSIBLE DROPDOWN) */}
              <div className="w-full">
                <RemoteControlPanel
                  roomState={roomState}
                  localTime={localTime}
                  videoDuration={videoDuration}
                  isHost={isHost}
                  canIControl={canIControl}
                  anyoneCanControl={anyoneCanControl}
                  formatTime={formatTime}
                  onPlay={handleRemotePlay}
                  onPause={handleRemotePause}
                  onSeek={handleRemoteSeek}
                  onSkipTime={handleSkipTime}
                  onForceSyncAll={handleForceSyncAll}
                  onToggleControlMode={handleToggleControlMode}
                />
              </div>
            </div>

            <ChatPanel
              chatHistory={roomState?.chatHistory || []}
              currentUserId={userId}
              onSendMessage={handleSendChatMessage}
              onSendReaction={handleSendReaction}
            />
          </div>

          <div className="w-full lg:w-96 bg-zinc-900/30 border-t lg:border-t-0 lg:border-l border-zinc-850 flex flex-col h-[450px] lg:h-full shrink-0 overflow-y-auto p-4 space-y-4">
            
            {/* Voice Chat Component */}
            <VoicePanel
              currentUserId={userId}
              currentUserName={userName}
              currentUserAvatar={userAvatar}
              currentUserColor={userColor}
              roomId={roomId}
              sendWebSocketMessage={(msg) => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify(msg));
                }
              }}
            />

            {/* Interactive Participant List with Host Actions */}
            <div className="h-80 shrink-0">
              <ParticipantList
                members={roomState?.members || {}}
                currentUserId={userId}
                isHost={isHost}
                onKickUser={handleKickUser}
                onMuteUser={handleMuteUser}
                onTransferHost={handleTransferHost}
              />
            </div>

            {roomState && (
              <div className="bg-zinc-950/70 border border-zinc-850/65 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900/80 pb-2">
                  <div className="flex items-center gap-1 opacity-45">
                    <span className="w-6 h-1 bg-zinc-600 rounded-full"></span>
                    <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
                    <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">
                      STATUS:
                    </span>
                    <span className={`w-2 h-2 rounded-full shadow-lg ${
                      roomState.playing 
                        ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" 
                        : "bg-amber-500 shadow-amber-500/50"
                    }`} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-display font-black text-[10px] tracking-widest uppercase text-zinc-300">
                      SFERIUM COMMANDER
                    </span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded-md uppercase">
                    v2.5
                  </span>
                </div>

                <RoomDashboard
                  anyoneCanControl={anyoneCanControl}
                  isHost={isHost}
                  toggleControl={handleToggleControlMode}
                />

                <div className="bg-zinc-900/50 border border-zinc-850/40 p-2.5 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-zinc-550 text-[9px] font-mono uppercase tracking-wider">Режим комнаты</span>
                  <div className="flex items-center gap-1.5">
                    {anyoneCanControl ? (
                      <>
                        <LockOpen className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400">Свободный доступ</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-rose-400" />
                        <span className="text-[10px] font-bold text-rose-400">Пульт у Создателя</span>
                      </>
                    )}
                  </div>
                </div>

                {canIControl ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-black border border-zinc-800/80 rounded-2xl p-3 flex flex-col justify-between h-28 relative shadow-inner overflow-hidden font-mono text-zinc-300 select-none">
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none opacity-20" />
                      
                      <div className="flex items-center justify-between text-[9px] text-zinc-400 uppercase tracking-widest relative z-10">
                        <span className="flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />
                          {roomState.provider}
                        </span>
                        <span>
                          {roomState.playing ? "PLAYING" : "PAUSED"}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-center gap-1.5 py-1 text-center relative z-10">
                        <span className="text-xl font-bold font-mono tracking-wider text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                          {formatTime(localTime || 0)}
                        </span>
                        <span className="text-[10px] text-zinc-600">/</span>
                        <span className="text-xs text-zinc-500">
                          {formatTime(videoDuration > 0 ? videoDuration : Math.max((localTime || 0) + 300, 3600))}
                        </span>
                      </div>

                      <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden relative border border-zinc-900 z-10">
                        <div 
                          className="bg-indigo-500 h-full rounded-full shadow-[0_0_6px_rgba(99,102,241,0.8)]"
                          style={{ width: `${Math.min(100, ((localTime || 0) / (videoDuration > 0 ? videoDuration : Math.max((localTime || 0) + 300, 3600))) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[8px] font-mono text-zinc-500">
                        <span>00:00</span>
                        <span>ТАЙМЛАЙН ПЛЕЕРА</span>
                        <span>{formatTime(videoDuration > 0 ? videoDuration : Math.max((localTime || 0) + 300, 3600))}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={videoDuration > 0 ? videoDuration : Math.max((localTime || 0) + 300, 3600)}
                        value={localTime || 0}
                        onChange={(e) => handleRemoteSeek(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none border border-zinc-850 shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSkipTime(-10)}
                        className="py-3 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                        title="Назад на 10 секунд"
                      >
                        <span className="text-[10px] font-black font-mono">-10с</span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-wider mt-0.5 uppercase">SEEK BACK</span>
                      </button>

                      <button
                        type="button"
                        onClick={roomState.playing ? handleRemotePause : handleRemotePlay}
                        className={`py-3 rounded-2xl border flex flex-col items-center justify-center text-white transition-all cursor-pointer shadow-lg active:translate-y-0.5 ${
                          roomState.playing 
                            ? "bg-amber-950/20 hover:bg-amber-950/45 border-amber-500/40 text-amber-400 shadow-amber-950/30" 
                            : "bg-indigo-950/30 hover:bg-indigo-950/50 border-indigo-500/50 text-indigo-400 shadow-indigo-950/30"
                        }`}
                        title={roomState.playing ? "Пауза" : "Воспроизведение"}
                      >
                        {roomState.playing ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                        <span className="text-[7px] font-mono tracking-widest mt-1 uppercase">
                          {roomState.playing ? "PAUSE" : "PLAY"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSkipTime(10)}
                        className="py-3 bg-zinc-900 hover:bg-zinc-850 active:bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                        title="Вперед на 10 секунд"
                      >
                        <span className="text-[10px] font-black font-mono">+10с</span>
                        <span className="text-[7px] text-zinc-500 font-mono tracking-wider mt-0.5 uppercase">SEEK FWD</span>
                      </button>
                    </div>

                    {isHost && (
                      <button
                        type="button"
                        onClick={handleForceSyncAll}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-550 active:bg-indigo-700 text-white font-bold text-xs rounded-2xl border border-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/10 active:translate-y-0.5 uppercase tracking-widest"
                        title="Принудительно переместить всех участников на вашу минуту"
                      >
                        <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
                        Синхронизировать всех
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-950/95 border border-zinc-900 rounded-3xl flex flex-col items-center justify-center space-y-4 relative overflow-hidden text-center min-h-[220px]">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none opacity-20" />
                    
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl w-14 h-14 -translate-x-1.5 -translate-y-1.5 animate-pulse" />
                      <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg relative z-10">
                        <Lock className="w-5 h-5 text-amber-500" />
                      </div>
                    </div>

                    <div className="space-y-1.5 relative z-10">
                      <h4 className="text-xs font-black tracking-widest text-zinc-300 uppercase">
                        Управление Заблокировано
                      </h4>
                      <p className="text-[10px] text-zinc-500 max-w-[200px]">
                        Создатель заблокировал пульт. Вы смотрите прямой эфир на {formatTime(localTime || 0)}
                      </p>
                    </div>

                    <div className="w-full bg-black border border-zinc-900 rounded-xl p-2.5 font-mono text-[10px] text-zinc-400 flex items-center justify-between relative z-10 shadow-inner select-none">
                      <span className="flex items-center gap-1.5 text-[9px] tracking-wider text-zinc-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                        ЭФИР:
                      </span>
                      <span className="font-bold text-indigo-400 tracking-widest">
                        {formatTime(localTime || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuth={handleAuth}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userName={userName}
        userAvatar={userAvatar}
        userColor={userColor}
        userId={userId}
        userStatus={userStatus}
        userCustomStatus={userCustomStatus}
        userBio={userBio}
        userMicSettings={userMicSettings}
        userCameraSettings={userCameraSettings}
        recentRooms={recentRooms}
        onSaveProfile={handleSaveProfile}
        onJoinRoomFromHistory={(targetRoom: string) => {
          setIsProfileModalOpen(false);
          handleJoinOrCreateRoom(targetRoom);
        }}
        onClearHistory={handleClearHistory}
      />
    </div>
  </AIProvider>
  );
}

export default App;
