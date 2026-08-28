import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { RoomState, ChatMessage, Member, VideoProvider, UserRole, RolePermissions, DEFAULT_ROLE_PERMISSIONS } from "./src/types";
import { loadRoomFromDb, saveRoomToDb, deleteRoomFromDb, getAllRoomsFromDb } from "./src/db";
import { rooms, clientConnections, lastActionTimes, getUserEffectivePermissions, canActorManageTarget, ROLE_HIERARCHY } from "./backend/modules/sync";
import { roomsRouter } from "./backend/routes/rooms";
import {
  listRooms,
  createRoom,
  deleteRoom,
  seedInitialRoomsIfEmpty,
  registerLobbySubscriber,
  unregisterLobbySubscriber,
  broadcastLobbyUpdate
} from "./backend/modules/rooms";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);
const appDir = process.cwd();

// Import SFU Mediasoup and streamer services
import {
  createSFURoom,
  getSFURoom,
  deleteSFURoom,
  createWebRtcTransport,
  createPlainTransports,
  isMediasoupSupported
} from "./src/services/mediasoup";

import {
  startStreamSession,
  stopStreamSession,
  getCurrentTime as getStreamerTime
} from "./src/services/streamer";

import { videoRouter } from "./backend/routes/video";
import { handleSyncMessage } from "./backend/syncVideoServer";
import { publishRoomEvent, subscribeToRoomEvents, INSTANCE_ID } from "./src/services/redisPubSub";
import { AccessToken } from "livekit-server-sdk";
import {
  serverAnalyzeScene,
  serverSummarizeMoment,
  serverTranslateLines,
  serverAskAI,
  serverModerateChatMessage,
  serverGetHostHelp,
  serverGetGuestHelp,
  serverGetActivityReport
} from "./backend/modules/ai";

// Setup server environment
const PORT = 3000;
const app = express();
const server = http.createServer(app);

let systemMessageIdCounter = 0;

// Serve public static directory if needed
app.use(express.json());
app.use("/api/rooms", roomsRouter);
app.use("/api/video", videoRouter);

// AI Assistant REST Endpoints (Powered by Gemini API / @google/genai)
app.post("/api/ai/analyze-scene", async (req, res) => {
  try {
    const data = await serverAnalyzeScene(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/summary", async (req, res) => {
  try {
    const data = await serverSummarizeMoment(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/translate", async (req, res) => {
  try {
    const data = await serverTranslateLines(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/ask", async (req, res) => {
  try {
    const answer = await serverAskAI(req.body);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/moderate", async (req, res) => {
  try {
    const data = await serverModerateChatMessage(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/host-help", async (req, res) => {
  try {
    const data = await serverGetHostHelp(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/guest-help", async (req, res) => {
  try {
    const data = await serverGetGuestHelp(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/activity-report", async (req, res) => {
  try {
    const data = await serverGetActivityReport(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy YouTube to bypass CORS / SameSite
app.use("/yt", async (req, res) => {
  try {
    const targetUrl = `https://www.youtube.com${req.url}`;
    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== "host" && key.toLowerCase() !== "origin" && key.toLowerCase() !== "referer") {
        headers[key] = val as string;
      }
    }
    
    headers["referer"] = "https://www.youtube.com";
    headers["origin"] = "https://www.youtube.com";

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        const cookies = response.headers.getSetCookie();
        const modifiedCookies = cookies.map(cookie => 
          cookie.replace(/SameSite=(Lax|Strict)/gi, "SameSite=None") + "; Secure; SameSite=None"
        );
        res.setHeader("set-cookie", modifiedCookies);
      } else {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error("[YT Proxy Error]:", err);
    res.status(500).send(err.message);
  }
});

// Express endpoints for OAuth flow in AI Studio preview
app.get("/api/auth/url/:provider", (req, res) => {
  const provider = req.params.provider.toLowerCase();
  const redirectUri = (req.query.redirect_uri || req.query.redirectUri) as string;

  if (provider === "vk") {
    const clientId = process.env.VK_CLIENT_ID || "54637865";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "video,offline",
      v: "5.131"
    });
    return res.json({ url: `https://oauth.vk.com/authorize?${params.toString()}` });
  } else if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID || "84931823901-placeholder.apps.googleusercontent.com";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent"
    });
    return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  } else if (provider === "rutube") {
    const clientId = process.env.RUTUBE_CLIENT_ID || "rutube-placeholder-id";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code"
    });
    return res.json({ url: `https://rutube.ru/accounts/oauth/authorize/?${params.toString()}` });
  } else {
    return res.status(400).json({ error: `Unsupported OAuth provider: ${provider}` });
  }
});

const renderExpressCallbackHtml = (provider: string, token: string | null, error: string | null) => {
  const payload = error 
    ? JSON.stringify({ type: "OAUTH_AUTH_FAILURE", provider, error })
    : JSON.stringify({ type: "OAUTH_AUTH_SUCCESS", provider, token });
  
  const messageElement = error
    ? `<p style='color: #ef4444; font-family: sans-serif; font-weight: 600;'>Ошибка авторизации: ${error}</p>`
    : "<p style='color: #10b981; font-family: sans-serif; font-weight: 600;'>Авторизация прошла успешно! Это окно закроется автоматически...</p>";

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>Sferium Homes - Авторизация</title>
        <style>
            body {
                background-color: #09090b;
                color: #f4f4f5;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                padding: 20px;
            }
            .loader {
                border: 4px solid #18181b;
                border-top: 4px solid #6366f1;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="loader"></div>
        ${messageElement}
        <script>
            try {
                if (window.opener) {
                    window.opener.postMessage(${payload}, '*');
                    setTimeout(function() {
                        window.close();
                    }, 1500);
                } else {
                    document.body.innerHTML = "<h3>Окно-родитель не найдено. Токен авторизации скопирован в буфер обмена.</h3>";
                    navigator.clipboard.writeText("${token || ''}");
                }
            } catch (err) {
                console.error("Ошибка передачи сообщения:", err);
                document.body.innerHTML += "<p style='color: #a1a1aa;'>Пожалуйста, закройте это окно вручную.</p>";
            }
        </script>
    </body>
    </html>
  `;
};

app.get(["/api/auth/:provider/callback", "/api/auth/:provider/callback/"], async (req, res) => {
  const provider = String(req.params.provider || "").toLowerCase();
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error || !code) {
    return res.send(renderExpressCallbackHtml(provider, null, error || "No authorization code returned."));
  }

  // Sandbox fallback token if credentials aren't set yet
  const vkClientId = process.env.VK_CLIENT_ID || "54637865";
  const vkClientSecret = process.env.VK_CLIENT_SECRET || "";

  const isConfigured = 
    (provider === "vk" && vkClientId && vkClientSecret) ||
    (provider === "google" && process.env.GOOGLE_CLIENT_ID) ||
    (provider === "rutube" && process.env.RUTUBE_CLIENT_ID);

  if (!isConfigured) {
    const mockToken = `${provider}_sandbox_token_${code.substring(0, 10)}`;
    return res.send(renderExpressCallbackHtml(provider, mockToken, null));
  }

  try {
    let exchangeUrl = "";
    let bodyParams: Record<string, string> = {};

    if (provider === "vk") {
      exchangeUrl = "https://oauth.vk.com/access_token";
      bodyParams = {
        client_id: vkClientId,
        client_secret: vkClientSecret,
        redirect_uri: `${req.protocol}://${req.get("host")}/api/auth/vk/callback`,
        code
      };
    } else if (provider === "google") {
      exchangeUrl = "https://oauth2.googleapis.com/token";
      bodyParams = {
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${req.protocol}://${req.get("host")}/api/auth/google/callback`,
        code,
        grant_type: "authorization_code"
      };
    } else if (provider === "rutube") {
      exchangeUrl = "https://rutube.ru/oauth/token/";
      bodyParams = {
        client_id: process.env.RUTUBE_CLIENT_ID!,
        client_secret: process.env.RUTUBE_CLIENT_SECRET!,
        redirect_uri: `${req.protocol}://${req.get("host")}/api/auth/rutube/callback`,
        code,
        grant_type: "authorization_code"
      };
    }

    const response = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(bodyParams).toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.send(renderExpressCallbackHtml(provider, null, `Exchange failed: ${errorText}`));
    }

    const data: any = await response.json();
    const token = data.access_token || data.accessToken;
    if (!token) {
      return res.send(renderExpressCallbackHtml(provider, null, "No access token found in response."));
    }

    return res.send(renderExpressCallbackHtml(provider, token, null));
  } catch (err: any) {
    return res.send(renderExpressCallbackHtml(provider, null, err.message || "Network exchange failed"));
  }
});

async function resolveVkWithYtdlp(videoId: string): Promise<any> {
  try {
    const videoUrl = `https://vk.com/video${videoId}`;
    console.log(`[YT-DLP VK RESOLVER] Attempting to resolve via yt-dlp: ${videoUrl}`);
    let cmd = `yt-dlp -j --no-playlist "${videoUrl}"`;
    
    if (process.env.VK_COOKIES_PATH) {
      cmd += ` --cookies "${process.env.VK_COOKIES_PATH}"`;
    } else {
      const cookiesTxtPath = path.join(process.cwd(), "cookies.txt");
      if (fs.existsSync(cookiesTxtPath)) {
        cmd += ` --cookies "${cookiesTxtPath}"`;
      }
    }

    const { stdout } = await execAsync(cmd);
    const info = JSON.parse(stdout);
    
    const formats = info.formats || [];
    const hlsFormat = formats.find((f: any) => f.url && (f.url.includes(".m3u8") || f.protocol === "m3u8_native" || f.protocol === "m3u8"));
    const hlsUrl = hlsFormat ? hlsFormat.url : null;
    
    const mp4Format = formats.find((f: any) => f.url && f.ext === "mp4" && !f.url.includes(".m3u8"));
    const mp4Url = mp4Format ? mp4Format.url : (info.url || null);

    return {
      title: info.title || "VK Video via yt-dlp",
      duration: info.duration || 0,
      hls: hlsUrl,
      mp4: mp4Url,
      files: {
        hls: hlsUrl,
        mp4: mp4Url
      }
    };
  } catch (err) {
    console.error("[YT-DLP VK RESOLVER] failed:", err);
    return null;
  }
}

// VK Video Resolver Endpoint
app.get("/api/vk/resolve", async (req, res) => {
  let videoId = (req.query.video_id || req.query.videoId) as string;
  const token = (req.query.token as string) || (req.query.accessToken as string) || process.env.VK_SERVICE_KEY || "";
  const fallbackKey = process.env.VK_SERVICE_KEY || "vk_sandbox_service_token";

  if (!videoId) {
    return res.status(400).json({ error: "video_id or videoId query param is required" });
  }

  const cleanUrl = videoId.trim();
  if (cleanUrl.includes("vk.com") || cleanUrl.includes("vkvideo.ru") || cleanUrl.startsWith("http")) {
    const extracted = serverExtractVideoId(cleanUrl, "vk");
    if (extracted && extracted !== "456239149") {
      console.log(`[VK API RESOLVER] Extracted video ID ${extracted} from URL: ${cleanUrl}`);
      videoId = extracted;
    }
  }

  try {
    const parts = videoId.split("_");
    const owner_id = parts[0];
    const id = parts[1];
    const hash = parts[2];

    if (!owner_id || !id) {
      console.warn(`[VK API RESOLVER] Could not parse owner_id and id from video ID: ${videoId}`);
    }

    let videoParam = `${owner_id}_${id}`;
    if (hash) {
      videoParam = `${owner_id}_${id}_${hash}`;
    }

    const params = new URLSearchParams({
      videos: videoParam,
      v: "5.131",
    });

    if (token && token.trim().length > 0) {
      params.append("access_token", token);
    } else {
      params.append("access_token", fallbackKey);
    }

    const vkApiUrl = `https://api.vk.com/method/video.get?${params.toString()}`;
    const response = await fetch(vkApiUrl);

    let finalResult = null;

    if (response.ok) {
      const data: any = await response.json();
      if (!data.error) {
        const videoInfo = data.response?.items?.[0];
        if (videoInfo) {
          const files = videoInfo.files || {};
          const hlsUrl = files.hls || null;
          const mp4Url = files.mp4_1080 || files.mp4_720 || files.mp4_480 || files.mp4_360 || files.mp4_240 || null;
          let playerUrl = videoInfo.player || null;
          if (playerUrl && playerUrl.startsWith("//")) {
            playerUrl = `https:${playerUrl}`;
          }
          
          if (hlsUrl || mp4Url || playerUrl) {
            finalResult = {
              title: videoInfo.title || "VK Video",
              duration: videoInfo.duration || 0,
              hls: hlsUrl,
              mp4: mp4Url,
              player: playerUrl,
              files: files
            };
          }
        }
      } else if (token === "vk_sandbox_service_token") {
        return res.json({
          title: "Sferium Homes VK Direct Test Stream",
          duration: 354,
          hls: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
          mp4: null,
          player: "https://vk.com/video_ext.php?oid=-220550000&id=456239149",
          files: {
            hls: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
          }
        });
      }
    }

    if (!finalResult) {
      console.log("[VK API RESOLVER] VK API did not return playable files. Trying yt-dlp fallback...");
      finalResult = await resolveVkWithYtdlp(videoId);
    }

    if (finalResult) {
      return res.json(finalResult);
    }

    return res.status(404).json({ error: "Could not resolve VK video via API or yt-dlp." });
  } catch (err: any) {
    console.error("[VK API RESOLVER] Failed to resolve video:", err);
    return res.status(500).json({ error: err.message || "Internal VK resolution error" });
  }
});

// LiveKit Token generation endpoint for WebRTC Voice & Video
app.get(["/api/livekit/token", "/api/livekit/token/", "/api/livekit-token", "/api/livekit-token/"], async (req, res) => {
  const roomId = (req.query.roomId as string) || "CINEMA";
  const userId = (req.query.userId as string) || `user_${Math.random().toString(36).substring(2, 9)}`;
  const userName = (req.query.userName as string) || "Гость";

  const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "secret_must_be_32_characters_long_123";
  const livekitUrl = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || "wss://livekit.example.com";

  console.log(`[LiveKit Token] Generating token for user="${userName}" (${userId}) in room="${roomId}"`);
  console.log(`[LiveKit Token] Config: URL="${livekitUrl}", API_KEY="${apiKey ? 'Set' : 'Missing'}", API_SECRET="${apiSecret ? 'Set (' + apiSecret.length + ' chars)' : 'Missing'}"`);

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: userName,
    });
    at.addGrant({ roomJoin: true, room: roomId, canPublish: true, canSubscribe: true });
    
    // In livekit-server-sdk v2, toJwt() returns Promise<string> or string
    const jwt = await at.toJwt();
    const tokenString = typeof jwt === "string" ? jwt : String(jwt);
    console.log(`[LiveKit Token] Successfully generated JWT token (length=${tokenString.length})`);
    
    return res.json({
      token: tokenString,
      url: livekitUrl,
      roomId,
      userId,
    });
  } catch (err: any) {
    console.error("[LiveKit Token] Error generating token:", err);
    return res.status(500).json({
      token: "",
      url: livekitUrl,
      roomId,
      userId,
      error: err.message || "Failed to generate LiveKit access token",
    });
  }
});

// Helper provider detector
function serverDetectProvider(url: string): VideoProvider {
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

// Helper ID extractor
function serverExtractVideoId(url: string, provider: VideoProvider): string {
  if (!url) return "";
  const cleanUrl = url.trim();

  try {
    if (provider === "youtube") {
      const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = cleanUrl.match(ytRegExp);
      if (match && match[2].length === 11) {
        return match[2];
      }
      const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) {
        return shortsMatch[1];
      }
      return "dQw4w9WgXcQ";
    }

    if (provider === "vk") {
      const oidMatch = cleanUrl.match(/[\?&]oid=(-?\d+)/);
      const idMatch = cleanUrl.match(/[\?&]id=(\d+)/);
      const hashMatch = cleanUrl.match(/[\?&]hash=([a-zA-Z0-9]+)/);
      const hashId = hashMatch ? `_${hashMatch[1]}` : "";
      
      if (oidMatch && idMatch) {
        return `${oidMatch[1]}_${idMatch[1]}${hashId}`;
      }

      const simpleMatch = cleanUrl.match(/(?:video|clip)(-?\d+)_(\d+)/);
      if (simpleMatch) {
        return `${simpleMatch[1]}_${simpleMatch[2]}${hashId}`;
      }
      return "456239149";
    }

    if (provider === "rutube") {
      const videoMatch = cleanUrl.match(/rutube\.ru\/video\/([a-zA-Z0-9_-]+)/);
      if (videoMatch) return videoMatch[1];
      const embedMatch = cleanUrl.match(/rutube\.ru\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) return embedMatch[1];
      return "";
    }

    if (provider === "direct") return cleanUrl;
    
    if (provider === "yandex") {
      const dzenEmbedMatch = cleanUrl.match(/dzen\.ru\/embed\/([a-zA-Z0-9_-]+)/);
      if (dzenEmbedMatch) return dzenEmbedMatch[1];
      const dzenVideoMatch = cleanUrl.match(/dzen\.ru\/video\/watch\/([a-zA-Z0-9_-]+)/);
      if (dzenVideoMatch) return dzenVideoMatch[1];
      return "";
    }
  } catch (e) {
    console.error("Error extracting video ID on server:", e);
  }
  return cleanUrl;
}

// Broadcast helper - local instance delivery
function broadcastToRoomLocal(roomId: string, message: any) {
  if (message && message.type === "room_state" && message.state) {
    updateRoomCurrentTime(roomId);
    message.state = rooms[roomId];
  }
  const payload = JSON.stringify(message);
  for (const [ws, conn] of clientConnections.entries()) {
    if (conn.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Broadcast helper - distributed delivery across server instances via Redis Pub/Sub
function broadcastToRoom(roomId: string, message: any) {
  broadcastToRoomLocal(roomId, message);
  publishRoomEvent(roomId, message).catch((err) => {
    console.warn(`[Redis PubSub] Failed to publish event for room ${roomId}:`, err);
  });
}

// Send direct message to a specific user in a room
function sendToUserInRoom(roomId: string, targetUserId: string, message: any) {
  const payload = JSON.stringify(message);
  for (const [ws, conn] of clientConnections.entries()) {
    if (conn.roomId === roomId && conn.userId === targetUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Broadcast updated participant list to room
function broadcastParticipantsUpdate(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  const participants = Object.values(room.members || {});
  broadcastToRoom(roomId, {
    type: "room:updateParticipants",
    roomId,
    members: participants,
    hostId: room.hostId,
    count: participants.length,
  });
}

// Active voice chat peers per room
const voiceRooms = new Map<string, Map<string, {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}>>();

const roomPolls = new Map<string, any>();

function getVoiceRoom(roomId: string) {
  if (!voiceRooms.has(roomId)) {
    voiceRooms.set(roomId, new Map());
  }
  return voiceRooms.get(roomId)!;
}

function updateRoomCurrentTime(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  const streamerTime = getStreamerTime(roomId);
  if (streamerTime !== null && streamerTime !== undefined) {
    room.currentTime = streamerTime;
    room.lastUpdated = Date.now();
  } else {
    getAndUpdateRoomTime(room);
  }
}

function getAndUpdateRoomTime(room: any) {
  return room ? room.currentTime : 0;
}

function addSystemMessage(room: RoomState, text: string, prefix: string, userId?: string) {
  const now = Date.now();
  const uId = userId || "unknown";

  const isDuplicate = room.chatHistory.slice(-10).some((m: ChatMessage) => {
    if (m.type !== "system") return false;
    if (now - m.timestamp >= 5000) return false;
    if (m.text === text) return true;

    const parts = m.id.split("_");
    if (parts.length >= 3) {
      const prevPrefix = parts[1];
      const prevUserId = parts[2];
      if (prevPrefix === prefix && prevUserId === uId) {
        return true;
      }
    }
    return false;
  });

  if (isDuplicate) {
    console.log(`[DEDUPLICATE SYSTEM] Ignored duplicate system msg within 5s threshold for action "${prefix}" (User: ${uId}): "${text}"`);
    return;
  }

  room.chatHistory.push({
    id: `sys_${prefix}_${uId}_${systemMessageIdCounter++}_${now}`,
    type: "system",
    text,
    timestamp: now,
  });
}

function parseRoomId(input: string): string {
  if (!input) return "";
  let str = input.trim();
  str = str.replace(/[?#].*$/, "");
  str = str.replace(/^\/+|\/+$/g, "");

  if (str.includes("/room/")) {
    str = str.split("/room/").pop() || "";
  } else if (str.includes("/invite/")) {
    str = str.split("/invite/").pop() || "";
  } else if (str.includes("room=")) {
    const match = str.match(/room=([^&]+)/);
    if (match) str = match[1] || "";
  }

  if (str.includes("/")) {
    str = str.split("/").pop() || "";
  }

  return str.replace(/\/+$/g, "").trim().toUpperCase();
}

// Attach WebSocket Upgrade Server
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (ws: WebSocket, req) => {
  const urlParams = new URL(req.url || "", `http://${req.headers.host || "localhost"}`).searchParams;
  const rawRoomId = urlParams.get("roomId") || "CINEMA";
  const isLobby = rawRoomId.toUpperCase() === "LOBBY";
  const roomId = isLobby ? "LOBBY" : parseRoomId(rawRoomId) || "CINEMA";
  const userId = urlParams.get("userId") || `user_${Math.random().toString(36).substring(2, 9)}`;
  const name = urlParams.get("name") || "Киноман";
  const avatar = urlParams.get("avatar") || "🍿";
  const color = urlParams.get("color") || "text-indigo-400";

  console.log(`[WS CONNECT] User: ${name} (${userId}) connected (Target: ${roomId})`);

  clientConnections.set(ws, { ws, roomId, userId });

  if (isLobby) {
    registerLobbySubscriber(ws);
    try {
      const roomList = await listRooms();
      ws.send(JSON.stringify({
        type: "rooms:list",
        rooms: roomList,
      }));
    } catch (e) {
      console.warn("[LOBBY] Failed to send initial room list:", e);
    }
  } else {
    if (!rooms[roomId]) {
      try {
        const dbRoom = await loadRoomFromDb(roomId);
        if (dbRoom) {
          rooms[roomId] = dbRoom;
          rooms[roomId].members = rooms[roomId].members || {};
          console.log(`[DB RESTORE] Loaded room #${roomId} from persistent DB.`);
        }
      } catch (e) {
        console.warn(`[DB RESTORE ERROR] Could not load room #${roomId}:`, e);
      }
    }

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        hostId: userId,
        videoUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        videoId: "jfKfPfyJRdk",
        provider: "youtube",
        playing: false,
        isPlaying: false,
        currentTime: 0.0,
        lastUpdated: Date.now(),
        anyoneCanControl: false,
        members: {},
        chatHistory: [
          {
            id: `sys_init_${Date.now()}`,
            type: "system",
            text: `🍿 Зал Sferium Homes #${roomId} был успешно открыт.`,
            timestamp: Date.now(),
          }
        ],
      };

      if (isMediasoupSupported()) {
        createSFURoom(roomId).catch((err) => {
          console.error(`[SFU] Failed to create SFU Room #${roomId}:`, err.message);
        });
      }
    }

    const room = rooms[roomId];
    getAndUpdateRoomTime(room);

    // Check if banned
    if (room.bannedUserIds?.includes(userId)) {
      console.warn(`[BAN REJECT] User ${userId} is banned from room #${roomId}`);
      ws.send(JSON.stringify({
        type: "error",
        message: "Вы заблокированы в этом зале"
      }));
      ws.close();
      return;
    }

    const isFirstMember = Object.keys(room.members).length === 0;
    const isExisting = !!room.members[userId];
    const originalHostStatus = isExisting ? room.members[userId].isHost : isFirstMember;

    if (originalHostStatus) {
      room.hostId = userId;
    }

    const existingRole = room.members[userId]?.role;
    const userRole: UserRole = originalHostStatus ? 'host' : (existingRole || room.defaultRole || 'member');

    const joinedMember: Member = {
      userId,
      name,
      avatar,
      color,
      isHost: originalHostStatus,
      role: userRole,
    };

    room.members[userId] = joinedMember;

    addSystemMessage(room, `👋 ${avatar} ${name} присоединился к залу.`, "join", userId);

    broadcastToRoom(roomId, {
      type: "room_state",
      state: room,
    });

    saveRoomToDb(room);
    broadcastLobbyUpdate();
  }

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const conn = clientConnections.get(ws);
      if (!conn) return;

      // Handle Rooms Management & Lobby Events directly
      if (msg.type === "rooms:list" || msg.type === "rooms:subscribe_lobby") {
        registerLobbySubscriber(ws);
        const roomList = await listRooms(msg.options);
        ws.send(JSON.stringify({
          type: "rooms:list",
          rooms: roomList,
        }));
        return;
      }

      if (msg.type === "rooms:create") {
        try {
          const payload = {
            ...msg.payload,
            hostId: msg.payload?.hostId || conn.userId,
            hostName: msg.payload?.hostName || name,
            hostAvatar: msg.payload?.hostAvatar || avatar,
            hostColor: msg.payload?.hostColor || color,
          };
          const newRoom = await createRoom(payload);
          ws.send(JSON.stringify({
            type: "rooms:created",
            success: true,
            room: newRoom,
            roomId: newRoom.roomId,
          }));
        } catch (err: any) {
          ws.send(JSON.stringify({
            type: "rooms:create_error",
            error: err.message || "Ошибка создания комнаты",
          }));
        }
        return;
      }

      if (msg.type === "rooms:delete") {
        try {
          const result = await deleteRoom(msg.roomId, msg.userId || conn.userId);
          ws.send(JSON.stringify({
            type: "rooms:deleted",
            roomId: msg.roomId,
            success: result.success,
            error: result.error,
          }));
        } catch (err: any) {
          ws.send(JSON.stringify({
            type: "rooms:delete_error",
            error: err.message || "Ошибка удаления комнаты",
          }));
        }
        return;
      }

      const currentRoom = rooms[conn.roomId];
      if (!currentRoom) return;

      const member = currentRoom.members[conn.userId];
      if (!member) return;

      const effectivePerms = getUserEffectivePermissions(currentRoom, conn.userId);
      const isHost = member.isHost || currentRoom.hostId === conn.userId;
      const canControl = effectivePerms.manageVideo;

      if (!currentRoom.mediaType) {
        const isLiveUrl = currentRoom.videoUrl && (
          currentRoom.videoUrl.includes(".m3u8") ||
          currentRoom.videoUrl.includes(".mpd") ||
          currentRoom.videoUrl.includes("live")
        );
        currentRoom.mediaType = isLiveUrl ? "live" : "vod";
      }

      const rateLimitedTypes = [
        "sync_play",
        "sync_pause",
        "sync_seek",
        "VIDEO_SYNC",
        "video_state_change",
        "seek",
        "seek_back",
        "seek_fwd",
        "force_sync_all"
      ];

      if (rateLimitedTypes.includes(msg.type)) {
        const now = Date.now();
        const actionTypeKey = `${conn.roomId}:${conn.userId}:${msg.type}`;
        const lastActionTypeTime = lastActionTimes.get(actionTypeKey) || 0;
        
        if (now - lastActionTypeTime < 5000) {
          console.warn(`[RATE LIMIT] Ignored repeated event '${msg.type}' from user: ${member.name} (${conn.userId}) within 5s`);
          return;
        }
        lastActionTimes.set(actionTypeKey, now);
      }

      const isSeekCommand = 
        msg.type === "sync_seek" ||
        msg.type === "seek" ||
        msg.type === "seek_back" ||
        msg.type === "seek_fwd" ||
        (msg.type === "VIDEO_SYNC" && (
          msg.action === "seek" ||
          msg.action === "seek_back" ||
          msg.action === "seek_fwd" ||
          msg.action === "SEEK_PLAY"
        ));

      if (currentRoom.mediaType === "live" && isSeekCommand) {
        console.warn(`[LIVE LOCK] Blocked seek command '${msg.type}' from user ${conn.userId} in room #${conn.roomId} (mediaType is live)`);
        ws.send(JSON.stringify({
          type: "error",
          message: "Перемотка эфира невозможна"
        }));
        return;
      }

      const isControlLocked = !currentRoom.anyoneCanControl || currentRoom.isLocked === true;
      if (isControlLocked && !isHost && rateLimitedTypes.includes(msg.type)) {
        console.warn(`[HOST VALIDATION] Denied control event '${msg.type}' from non-host ${conn.userId} in room #${conn.roomId}`);
        ws.send(JSON.stringify({
          type: "error",
          message: "Управление заблокировано создателем зала"
        }));
        return;
      }

      // Plugin sync handler for video synchronization
      if (typeof msg.type === "string" && msg.type.startsWith("sync:")) {
        handleSyncMessage(
          msg,
          { id: conn.userId, userId: conn.userId, isHost },
          currentRoom,
          (targetRoomId, payload) => {
            broadcastToRoom(targetRoomId, payload);
          }
        );
      }

      switch (msg.type) {
        case "join_room": {
          const rawTargetId = msg.roomId || conn.roomId || "CINEMA";
          const targetRoomId = parseRoomId(rawTargetId) || "CINEMA";
          const targetUserId = msg.userId || conn.userId;
          
          conn.roomId = targetRoomId;
          conn.userId = targetUserId;
          clientConnections.set(ws, conn);
          
          if (!rooms[targetRoomId]) {
            try {
              const dbRoom = await loadRoomFromDb(targetRoomId);
              if (dbRoom) {
                rooms[targetRoomId] = dbRoom;
                rooms[targetRoomId].members = rooms[targetRoomId].members || {};
              }
            } catch (e) {
              console.warn(`[DB RESTORE ERROR in join_room] Room #${targetRoomId}:`, e);
            }
          }

          if (!rooms[targetRoomId]) {
            rooms[targetRoomId] = {
              roomId: targetRoomId,
              hostId: targetUserId,
              videoUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
              videoId: "jfKfPfyJRdk",
              provider: "youtube",
              playing: false,
              isPlaying: false,
              currentTime: 0.0,
              lastUpdated: Date.now(),
              anyoneCanControl: false,
              members: {},
              chatHistory: [
                {
                  id: `sys_init_${Date.now()}`,
                  type: "system",
                  text: `🍿 Зал Sferium Homes #${targetRoomId} был успешно открыт.`,
                  timestamp: Date.now(),
                }
              ],
            };
            
            if (isMediasoupSupported()) {
              createSFURoom(targetRoomId).catch((err) => {
                console.error(`[SFU] Failed to create SFU Room #${targetRoomId}:`, err.message);
              });
            }
          }
          
          const currentRoomObj = rooms[targetRoomId];
          updateRoomCurrentTime(targetRoomId);
          
          const isFirst = Object.keys(currentRoomObj.members).length === 0;
          const isExist = !!currentRoomObj.members[targetUserId];
          const isRecognizedHost = currentRoomObj.hostId === targetUserId;
          const hostStatus = isExist
            ? currentRoomObj.members[targetUserId].isHost
            : (isFirst || isRecognizedHost);
          
          if (hostStatus) {
            currentRoomObj.hostId = targetUserId;
          }
          
          currentRoomObj.members[targetUserId] = {
            userId: targetUserId,
            name: msg.name || "Киноман",
            avatar: msg.avatar || "🍿",
            color: msg.color || "text-indigo-400",
            isHost: hostStatus,
          };
          
          addSystemMessage(currentRoomObj, `👋 ${msg.avatar || "🍿"} ${msg.name || "Киноман"} присоединился к залу.`, "join", targetUserId);
          
          ws.send(JSON.stringify({
            type: "room_state",
            state: currentRoomObj,
          }));
          
          broadcastToRoom(targetRoomId, {
            type: "room_state",
            state: currentRoomObj,
          });

          saveRoomToDb(currentRoomObj);
          break;
        }

        case "sync:video_url":
        case "change_video":
          if (!canControl) return;
          const provider = serverDetectProvider(msg.videoUrl);
          const extractedId = serverExtractVideoId(msg.videoUrl, provider);
          
          currentRoom.videoUrl = msg.videoUrl;
          currentRoom.videoId = extractedId;
          currentRoom.provider = provider;
          currentRoom.playing = false;
          currentRoom.isPlaying = false;
          currentRoom.currentTime = 0.0;
          currentRoom.lastUpdated = Date.now();

          const isLiveUrl = msg.videoUrl && (
            msg.videoUrl.includes(".m3u8") ||
            msg.videoUrl.includes(".mpd") ||
            msg.videoUrl.includes("live") ||
            msg.mediaType === "live"
          );
          currentRoom.mediaType = isLiveUrl ? "live" : "vod";

          addSystemMessage(currentRoom, `📺 ${member.avatar} ${member.name} запустил эфир: ${provider.toUpperCase()}`, "chg", conn.userId);

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);

          if (isMediasoupSupported()) {
            createPlainTransports(conn.roomId).then((ports) => {
              startStreamSession(conn.roomId, msg.videoUrl, ports, 0);
            }).catch((err) => {
              console.error("[SFU STREAM] Failed to initialize video stream plain ports:", err);
            });
          }
          break;

        case "video:play":
        case "sync:play":
        case "play_video":
        case "sync_play": {
          if (!canControl) return;
          currentRoom.playing = true;
          currentRoom.isPlaying = true;
          if (msg.currentTime !== undefined) {
            currentRoom.currentTime = parseFloat(msg.currentTime);
          } else if (msg.time !== undefined) {
            currentRoom.currentTime = parseFloat(msg.time);
          }
          const playRate = typeof msg.rate === "number" ? msg.rate : 1.0;
          const playUpdatedAt = msg.updatedAt || Date.now();
          currentRoom.lastUpdated = playUpdatedAt;

          addSystemMessage(currentRoom, `▶ ${member.avatar} ${member.name} включил воспроизведение.`, "play", conn.userId);

          broadcastToRoom(conn.roomId, {
            type: "video:play",
            roomId: conn.roomId,
            time: currentRoom.currentTime,
            playing: true,
            rate: playRate,
            updatedAt: playUpdatedAt,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "sync:play",
            roomId: conn.roomId,
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "playback_change",
            playing: true,
            currentTime: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          break;
        }

        case "video:pause":
        case "sync:pause":
        case "pause_video":
        case "sync_pause": {
          if (!canControl) return;
          currentRoom.playing = false;
          currentRoom.isPlaying = false;
          if (msg.currentTime !== undefined) {
            currentRoom.currentTime = parseFloat(msg.currentTime);
          } else if (msg.time !== undefined) {
            currentRoom.currentTime = parseFloat(msg.time);
          }
          const pauseRate = typeof msg.rate === "number" ? msg.rate : 1.0;
          const pauseUpdatedAt = msg.updatedAt || Date.now();
          currentRoom.lastUpdated = pauseUpdatedAt;

          addSystemMessage(currentRoom, `⏸ ${member.avatar} ${member.name} поставил на паузу.`, "pause", conn.userId);

          broadcastToRoom(conn.roomId, {
            type: "video:pause",
            roomId: conn.roomId,
            time: currentRoom.currentTime,
            playing: false,
            rate: pauseRate,
            updatedAt: pauseUpdatedAt,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "sync:pause",
            roomId: conn.roomId,
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "playback_change",
            playing: false,
            currentTime: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          break;
        }

        case "force_sync":
        case "force_sync_all":
          if (!canControl) return;
          if (msg.currentTime !== undefined) {
            currentRoom.currentTime = parseFloat(msg.currentTime);
          }
          currentRoom.lastUpdated = Date.now();
          const masterTime = currentRoom.currentTime;

          currentRoom.chatHistory = currentRoom.chatHistory.filter(
            (m: ChatMessage) => !(m.type === "system" && m.text.includes("перемотал"))
          );

          addSystemMessage(currentRoom, `⚡ Синхронизация: Все участники выровнены на ${Math.floor(masterTime)} сек.`, "sync", "system");

          broadcastToRoom(conn.roomId, {
            type: "apply_force_sync",
            currentTime: masterTime,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          break;

        case "player:state":
          if (!canControl) return;
          const isPlayCommand = Boolean(msg.playing ?? (msg.state === 'playing'));

          currentRoom.playing = isPlayCommand;
          currentRoom.isPlaying = isPlayCommand;
          if (msg.currentTime !== undefined) {
            currentRoom.currentTime = parseFloat(msg.currentTime);
          } else if (msg.time !== undefined) {
            currentRoom.currentTime = parseFloat(msg.time);
          }
          currentRoom.lastUpdated = Date.now();

          addSystemMessage(
            currentRoom,
            currentRoom.playing
              ? `▶️ ${member.avatar} ${member.name} включил воспроизведение.`
              : `⏸️ ${member.avatar} ${member.name} поставил на паузу.`,
            "playpause",
            conn.userId
          );

          // Broadcast both new hard sync event and backward-compatible events
          broadcastToRoom(conn.roomId, {
            type: "player:state",
            playing: currentRoom.playing,
            isPlaying: currentRoom.isPlaying,
            state: currentRoom.playing ? 'playing' : 'paused',
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "playback_change",
            playing: currentRoom.playing,
            currentTime: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          break;

        case "video:seek":
        case "player:seek":
        case "sync:seek":
        case "seek_video":
        case "sync_seek": {
          if (!canControl) return;
          if (msg.currentTime !== undefined) {
            currentRoom.currentTime = parseFloat(msg.currentTime);
          } else if (msg.time !== undefined) {
            currentRoom.currentTime = parseFloat(msg.time);
          }
          if (msg.playing !== undefined) {
            currentRoom.playing = Boolean(msg.playing);
            currentRoom.isPlaying = Boolean(msg.playing);
          }
          const seekRate = typeof msg.rate === "number" ? msg.rate : 1.0;
          const seekUpdatedAt = msg.updatedAt || Date.now();
          currentRoom.lastUpdated = seekUpdatedAt;

          addSystemMessage(currentRoom, `⏩ ${member.avatar} ${member.name} перемотал эфир.`, "seek", conn.userId);

          broadcastToRoom(conn.roomId, {
            type: "video:seek",
            roomId: conn.roomId,
            time: currentRoom.currentTime,
            currentTime: currentRoom.currentTime,
            playing: currentRoom.playing,
            rate: seekRate,
            updatedAt: seekUpdatedAt,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "player:seek",
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            playing: currentRoom.playing,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "sync:seek",
            roomId: conn.roomId,
            time: currentRoom.currentTime,
            currentTime: currentRoom.currentTime,
            payload: { time: currentRoom.currentTime },
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "playback_change",
            playing: currentRoom.playing,
            currentTime: currentRoom.currentTime,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);

          if (isMediasoupSupported()) {
            createPlainTransports(conn.roomId).then((ports) => {
              startStreamSession(conn.roomId, currentRoom.videoUrl, ports, Number(msg.currentTime));
            }).catch((err) => {
              console.error("[SFU STREAM] Failed to seek video stream plain ports:", err);
            });
          }
          break;
        }

        case "video:sync":
        case "sync:state":
        case "video_sync":
        case "player:heartbeat":
        case "sync_time_update":
        case "heartbeat":
        case "heartbeat_update": {
          const isActualHost = (currentRoom.hostId === conn.userId) || isHost || currentRoom.anyoneCanControl;
          if (!isActualHost) {
            break;
          }

          const rawTime = msg.hostTime !== undefined
            ? msg.hostTime
            : (msg.currentTime !== undefined
              ? msg.currentTime
              : (msg.time !== undefined
                ? msg.time
                : (msg.payload?.time !== undefined ? msg.payload.time : undefined)));
          const newTime = parseFloat(rawTime);
          if (!isNaN(newTime)) {
            currentRoom.currentTime = newTime;
            currentRoom.hostTime = newTime;
          }

          const rawPlaying = msg.hostPlaying !== undefined
            ? msg.hostPlaying
            : (msg.playing !== undefined
              ? msg.playing
              : (msg.isPlaying !== undefined
                ? msg.isPlaying
                : (msg.payload?.playing !== undefined ? msg.payload.playing : undefined)));
          if (rawPlaying !== undefined) {
            currentRoom.playing = Boolean(rawPlaying);
            currentRoom.isPlaying = Boolean(rawPlaying);
            currentRoom.hostPlaying = Boolean(rawPlaying);
          }

          if (msg.hostProvider) {
            currentRoom.provider = msg.hostProvider;
            currentRoom.hostProvider = msg.hostProvider;
          }

          const rate = typeof msg.rate === "number" ? msg.rate : (typeof msg.playbackRate === "number" ? msg.playbackRate : 1.0);
          const now = typeof msg.updatedAt === "number" ? msg.updatedAt : Date.now();
          currentRoom.lastUpdated = now;
          currentRoom.lastHeartbeatSyncTime = now;

          // 0. Primary video:sync broadcast for sub-second sync plugins
          broadcastToRoom(conn.roomId, {
            type: "video:sync",
            roomId: currentRoom.roomId,
            time: currentRoom.currentTime,
            playing: currentRoom.playing,
            rate: rate,
            updatedAt: now,
            senderId: conn.userId,
          });

          // 1. sync:state broadcast with structured payload
          broadcastToRoom(conn.roomId, {
            type: "sync:state",
            roomId: currentRoom.roomId,
            time: currentRoom.currentTime,
            currentTime: currentRoom.currentTime,
            playing: currentRoom.playing,
            isPlaying: currentRoom.playing,
            payload: {
              time: currentRoom.currentTime,
              playing: currentRoom.playing,
              rate: rate,
              ts: now,
            },
            senderId: conn.userId,
          });

          // 2. Full video sync broadcast (Host = source of truth)
          broadcastToRoom(conn.roomId, {
            type: "video_sync",
            roomId: currentRoom.roomId,
            hostTime: currentRoom.currentTime,
            hostPlaying: currentRoom.playing,
            hostProvider: currentRoom.provider || "youtube",
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            playing: currentRoom.playing,
            isPlaying: currentRoom.isPlaying,
            rate: rate,
            updatedAt: now,
            senderId: conn.userId,
          });

          // 2. Broadcast hard heartbeat to all room listeners
          broadcastToRoom(conn.roomId, {
            type: "player:heartbeat",
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            playing: currentRoom.playing,
            isPlaying: currentRoom.isPlaying,
            state: currentRoom.playing ? 'playing' : 'paused',
            playbackRate: msg.playbackRate || 1,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "heartbeat_sync",
            currentTime: currentRoom.currentTime,
            playing: currentRoom.playing,
            isPlaying: currentRoom.isPlaying,
            senderId: conn.userId,
          });
          break;
        }

        case "video_command":
        case "cmd": {
          if (!canControl) return;
          const cmd = msg.cmd || msg;
          if (cmd.type === "play") {
            currentRoom.playing = true;
            currentRoom.isPlaying = true;
            currentRoom.hostPlaying = true;
            if (cmd.time !== undefined) {
              currentRoom.currentTime = parseFloat(cmd.time);
              currentRoom.hostTime = currentRoom.currentTime;
            }
          } else if (cmd.type === "pause") {
            currentRoom.playing = false;
            currentRoom.isPlaying = false;
            currentRoom.hostPlaying = false;
            if (cmd.time !== undefined) {
              currentRoom.currentTime = parseFloat(cmd.time);
              currentRoom.hostTime = currentRoom.currentTime;
            }
          } else if (cmd.type === "seek" && cmd.time !== undefined) {
            currentRoom.currentTime = parseFloat(cmd.time);
            currentRoom.hostTime = currentRoom.currentTime;
          }
          currentRoom.lastUpdated = Date.now();

          broadcastToRoom(conn.roomId, {
            type: "video_sync",
            roomId: currentRoom.roomId,
            hostTime: currentRoom.currentTime,
            hostPlaying: currentRoom.playing,
            hostProvider: currentRoom.provider || "youtube",
            currentTime: currentRoom.currentTime,
            playing: currentRoom.playing,
            senderId: conn.userId,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          break;
        }

        case "toggle_control":
          if (!isHost) return;
          currentRoom.anyoneCanControl = !currentRoom.anyoneCanControl;
          
          addSystemMessage(
            currentRoom,
            currentRoom.anyoneCanControl
              ? `🔓 ${member.name} разрешил управление всем участникам.`
              : `🔒 ${member.name} ограничил управление только создателю.`,
            "ctrl",
            conn.userId
          );

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          break;

        case "chat_message":
          const userChatMsg: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: "user",
            userId: conn.userId,
            name: member.name,
            avatar: member.avatar,
            color: member.color,
            text: msg.text,
            timestamp: Date.now(),
            reactions: {},
          };

          currentRoom.chatHistory.push(userChatMsg);
          broadcastToRoom(conn.roomId, {
            type: "chat_broadcast",
            message: userChatMsg,
          });

          // Run asynchronous real-time AI moderation
          serverModerateChatMessage({
            text: msg.text,
            userId: conn.userId,
            userName: member.name,
            messageId: userChatMsg.id
          }).then((modResult) => {
            if (modResult.isToxic) {
              broadcastToRoom(conn.roomId, {
                type: "ai:moderationWarning",
                moderation: modResult
              });
              if (currentRoom.hostId) {
                sendToUserInRoom(conn.roomId, currentRoom.hostId, {
                  type: "ai:moderationAction",
                  moderation: modResult,
                  suggestedAction: modResult.suggestedAction
                });
              }
            }
          }).catch((err) => console.warn("[AI Moderation BG Error]:", err));

          saveRoomToDb(currentRoom);
          break;

        case "react_message":
          const { messageId, emoji } = msg;
          const foundMsg = currentRoom.chatHistory.find((m: ChatMessage) => m.id === messageId);
          if (foundMsg) {
            foundMsg.reactions = foundMsg.reactions || {};
            const userList = foundMsg.reactions[emoji] || [];

            if (userList.includes(conn.userId)) {
              foundMsg.reactions[emoji] = userList.filter((id) => id !== conn.userId);
            } else {
              foundMsg.reactions[emoji] = [...userList, conn.userId];
            }

            if (foundMsg.reactions[emoji].length === 0) {
              delete foundMsg.reactions[emoji];
            }

            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: currentRoom,
            });

            saveRoomToDb(currentRoom);
          }
          break;

        case "voice:join":
        case "voice_join":
        case "join-voice": {
          const vRoom = getVoiceRoom(conn.roomId);
          const voiceUser = {
            userId: conn.userId,
            name: (msg.name || member.name || "Гость"),
            avatar: (msg.avatar || member.avatar || "🍿"),
            color: (msg.color || member.color || "#a855f7"),
            isMuted: Boolean(msg.isMuted),
            isDeafened: Boolean(msg.isDeafened),
            isSpeaking: false,
          };
          vRoom.set(conn.userId, voiceUser);

          // Send current peers list to joining participant
          const otherPeers = Array.from(vRoom.values()).filter((p) => p.userId !== conn.userId);
          const peersPacket = {
            type: "voice:peers_list",
            peers: otherPeers,
            roomId: conn.roomId,
          };
          ws.send(JSON.stringify(peersPacket));
          ws.send(JSON.stringify({
            type: "peers",
            peers: otherPeers,
            roomId: conn.roomId,
          }));

          // Notify everyone else in the room
          broadcastToRoom(conn.roomId, {
            type: "voice:user_joined",
            peer: voiceUser,
            userId: conn.userId,
          });
          broadcastToRoom(conn.roomId, {
            type: "user-joined",
            peer: voiceUser,
            userId: conn.userId,
          });
          break;
        }

        case "voice:leave":
        case "voice_leave":
        case "leave-voice": {
          const vRoom = getVoiceRoom(conn.roomId);
          if (vRoom.has(conn.userId)) {
            vRoom.delete(conn.userId);
            broadcastToRoom(conn.roomId, {
              type: "voice:user_left",
              userId: conn.userId,
            });
            broadcastToRoom(conn.roomId, {
              type: "user-left",
              userId: conn.userId,
            });
          }
          break;
        }

        case "voice:offer":
        case "voice_offer":
        case "offer": {
          const targetId = msg.toUserId || msg.to;
          if (targetId && msg.offer) {
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:offer",
              fromUserId: conn.userId,
              from: conn.userId,
              offer: msg.offer,
              name: member.name,
              avatar: member.avatar,
              color: member.color,
            });
            sendToUserInRoom(conn.roomId, targetId, {
              type: "offer",
              fromUserId: conn.userId,
              from: conn.userId,
              offer: msg.offer,
              name: member.name,
              avatar: member.avatar,
              color: member.color,
            });
          }
          break;
        }

        case "voice:answer":
        case "voice_answer":
        case "answer": {
          const targetId = msg.toUserId || msg.to;
          if (targetId && msg.answer) {
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:answer",
              fromUserId: conn.userId,
              from: conn.userId,
              answer: msg.answer,
            });
            sendToUserInRoom(conn.roomId, targetId, {
              type: "answer",
              fromUserId: conn.userId,
              from: conn.userId,
              answer: msg.answer,
            });
          }
          break;
        }

        case "voice:ice_candidate":
        case "voice_ice_candidate":
        case "voice:ice":
        case "voice_ice":
        case "ice": {
          const targetId = msg.toUserId || msg.to;
          const cand = msg.candidate || msg.ice;
          if (targetId && cand) {
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:ice",
              fromUserId: conn.userId,
              from: conn.userId,
              candidate: cand,
              ice: cand,
            });
            sendToUserInRoom(conn.roomId, targetId, {
              type: "ice",
              fromUserId: conn.userId,
              from: conn.userId,
              candidate: cand,
              ice: cand,
            });
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:ice_candidate",
              fromUserId: conn.userId,
              from: conn.userId,
              candidate: cand,
            });
          }
          break;
        }

        case "voice:state":
        case "voice_state":
        case "peer-update": {
          const vRoom = getVoiceRoom(conn.roomId);
          const targetId = msg.userId || conn.userId;
          const currentVoice = vRoom.get(targetId);
          if (currentVoice) {
            if (typeof msg.isMuted === "boolean") currentVoice.isMuted = msg.isMuted;
            if (typeof msg.isDeafened === "boolean") currentVoice.isDeafened = msg.isDeafened;
          }
          broadcastToRoom(conn.roomId, {
            type: "voice:state",
            userId: targetId,
            isMuted: msg.isMuted,
            isDeafened: msg.isDeafened,
          });
          broadcastToRoom(conn.roomId, {
            type: "peer-update",
            userId: targetId,
            isMuted: msg.isMuted,
            isDeafened: msg.isDeafened,
          });
          break;
        }

        case "voice:active":
        case "voice:speaking":
        case "voice_speaking": {
          const vRoom = getVoiceRoom(conn.roomId);
          const currentVoice = vRoom.get(conn.userId);
          const isSpeaking = typeof msg.isSpeaking === "boolean" ? msg.isSpeaking : Boolean(msg.active);
          const volume = typeof msg.volume === "number" ? msg.volume : (msg.audioLevel ?? 0);
          
          if (currentVoice) {
            currentVoice.isSpeaking = isSpeaking;
          }
          if (member) {
            member.isSpeaking = isSpeaking;
            member.audioLevel = volume;
          }

          broadcastToRoom(conn.roomId, {
            type: "voice:active",
            userId: conn.userId,
            isSpeaking,
            volume,
            audioLevel: volume,
          });

          broadcastToRoom(conn.roomId, {
            type: "voice:speaking",
            userId: conn.userId,
            isSpeaking,
            volume,
            audioLevel: volume,
          });
          break;
        }

        case "role:grant":
        case "role:update": {
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!actorPerms.manageRoles) {
            ws.send(JSON.stringify({ type: "error", message: "У вас нет прав на управление ролями" }));
            return;
          }
          const targetId = msg.targetUserId;
          const targetMember = currentRoom.members[targetId];
          if (!targetMember) return;
          if (!canActorManageTarget(currentRoom, conn.userId, targetId)) {
            ws.send(JSON.stringify({ type: "error", message: "Нельзя изменить роль пользователя выше или равного по рангу" }));
            return;
          }
          const newRole: UserRole = msg.role;
          if (newRole === "host" && currentRoom.hostId !== conn.userId) {
            ws.send(JSON.stringify({ type: "error", message: "Только Создатель может передать роль Хоста" }));
            return;
          }
          targetMember.role = newRole;
          if (msg.customPermissions) {
            targetMember.customPermissions = { ...targetMember.customPermissions, ...msg.customPermissions };
          }
          const roleNames: Record<UserRole, string> = {
            host: "👑 Хост",
            moderator: "🛡️ Модератор",
            member: "👤 Участник",
            viewer: "👁️ Зритель",
          };
          addSystemMessage(
            currentRoom,
            `🎖️ ${member.avatar} ${member.name} назначил ${targetMember.avatar} ${targetMember.name} ролью ${roleNames[newRole] || newRole}.`,
            "role",
            targetId
          );
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "role:revoke": {
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!actorPerms.manageRoles) return;
          const targetId = msg.targetUserId;
          const targetMember = currentRoom.members[targetId];
          if (!targetMember || !canActorManageTarget(currentRoom, conn.userId, targetId)) return;
          targetMember.role = currentRoom.defaultRole || "member";
          targetMember.customPermissions = undefined;
          addSystemMessage(
            currentRoom,
            `🎖️ Роль ${targetMember.avatar} ${targetMember.name} была сброшена до участника.`,
            "role",
            targetId
          );
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "room:kick":
        case "kick_user":
        case "member:kick": {
          const isActualHost = currentRoom.hostId === conn.userId;
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!isActualHost && !actorPerms.manageMembers) {
            ws.send(JSON.stringify({ type: "error", message: "У вас нет прав на исключение участников" }));
            return;
          }
          const targetId = msg.targetUserId || msg.userId;
          const targetMember = currentRoom.members[targetId];
          if (!targetMember) return;
          if (!isActualHost && !canActorManageTarget(currentRoom, conn.userId, targetId)) {
            ws.send(JSON.stringify({ type: "error", message: "Нельзя исключить участника с равным или более высоким рангом" }));
            return;
          }
          const reason = msg.reason || "Исключен создателем комнаты";
          addSystemMessage(
            currentRoom,
            `👢 ${member.avatar} ${member.name} исключил ${targetMember.avatar} ${targetMember.name} (${reason}).`,
            "kick",
            targetId
          );

          // Direct kick notification to target
          sendToUserInRoom(conn.roomId, targetId, {
            type: "room:userKicked",
            targetUserId: targetId,
            kickedBy: member.name,
            reason,
          });

          clientConnections.forEach((c, socket) => {
            if (c.roomId === conn.roomId && c.userId === targetId && socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: "kicked", reason }));
                socket.close(4001, "Kicked by host");
              } catch (e) {
                console.error("[KICK ERROR]", e);
              }
            }
          });
          delete currentRoom.members[targetId];

          broadcastToRoom(conn.roomId, {
            type: "room:userKicked",
            targetUserId: targetId,
            kickedBy: member.name,
            reason,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          broadcastParticipantsUpdate(conn.roomId);
          saveRoomToDb(currentRoom);
          break;
        }

        case "room:mute":
        case "voice:mod_mute": {
          const isActualHost = currentRoom.hostId === conn.userId;
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!isActualHost && !actorPerms.manageVoice) return;
          const targetId = msg.targetUserId || msg.userId;
          const targetMember = currentRoom.members[targetId];
          const isMuted = msg.isMuted !== undefined ? Boolean(msg.isMuted) : true;
          if (targetMember && (isActualHost || canActorManageTarget(currentRoom, conn.userId, targetId))) {
            targetMember.isMutedByMod = isMuted;
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:force_mute",
              isMuted,
              by: member.name,
            });
            sendToUserInRoom(conn.roomId, targetId, {
              type: "room:userMuted",
              targetUserId: targetId,
              isMuted,
              by: member.name,
            });
            broadcastToRoom(conn.roomId, {
              type: "room:userMuted",
              targetUserId: targetId,
              isMuted,
              by: member.name,
            });
            addSystemMessage(
              currentRoom,
              isMuted
                ? `🔇 ${member.avatar} ${member.name} выключил микрофон ${targetMember.avatar} ${targetMember.name}.`
                : `🔊 ${member.avatar} ${member.name} разрешил микрофон для ${targetMember.avatar} ${targetMember.name}.`,
              "mute",
              targetId
            );
            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: currentRoom,
            });
            broadcastParticipantsUpdate(conn.roomId);
            saveRoomToDb(currentRoom);
          }
          break;
        }

        case "room:close":
        case "close_room": {
          if (currentRoom.hostId !== conn.userId) {
            ws.send(JSON.stringify({ type: "error", message: "Только создатель комнаты может закрыть её" }));
            return;
          }

          broadcastToRoom(conn.roomId, {
            type: "room:closed",
            roomId: conn.roomId,
            reason: "Комната закрыта создателем.",
          });

          // Disconnect all sockets in this room
          clientConnections.forEach((c, socket) => {
            if (c.roomId === conn.roomId && socket.readyState === WebSocket.OPEN) {
              try {
                socket.close(4000, "Room Closed");
              } catch {}
            }
          });

          // Purge room from memory and database
          delete rooms[conn.roomId];
          try {
            await deleteRoomFromDb(conn.roomId);
          } catch (e) {
            console.error("Error deleting room DB:", e);
          }
          broadcastLobbyUpdate();
          break;
        }

        case "room:muteBroadcast": {
          if (currentRoom.hostId !== conn.userId && !isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Только хост может управлять режимом эфира" }));
            return;
          }
          const isMuted = msg.isMuted !== undefined ? Boolean(msg.isMuted) : true;
          addSystemMessage(
            currentRoom,
            isMuted
              ? `🎙️ ${member.avatar} ${member.name} включил режим эфира без микрофона.`
              : `🎙️ ${member.avatar} ${member.name} включил микрофон в эфире.`,
            "broadcast",
            conn.userId
          );
          broadcastToRoom(conn.roomId, {
            type: "room:muteBroadcast",
            isMuted,
            by: member.name,
          });
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "video:restrictControls": {
          if (currentRoom.hostId !== conn.userId && !isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Только хост может ограничивать управление плеером" }));
            return;
          }
          const restricted = msg.restricted !== undefined ? Boolean(msg.restricted) : currentRoom.anyoneCanControl;
          currentRoom.anyoneCanControl = !restricted;
          addSystemMessage(
            currentRoom,
            restricted
              ? `🔒 ${member.avatar} ${member.name} ограничил управление плеером (только создатель).`
              : `🔓 ${member.avatar} ${member.name} разрешил управление плеером всем участникам.`,
            "ctrl",
            conn.userId
          );
          broadcastToRoom(conn.roomId, {
            type: "video:restrictControls",
            restricted,
            anyoneCanControl: currentRoom.anyoneCanControl,
            by: member.name,
          });
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "room:guestAction": {
          if (currentRoom.hostId !== conn.userId && !isHost) {
            ws.send(JSON.stringify({ type: "error", message: "Только хост может выполнять действия с гостями" }));
            return;
          }
          const action = msg.action;
          const targetId = msg.targetUserId;
          const targetMember = currentRoom.members[targetId];

          if (action === "mute" && targetMember) {
            const isMuted = msg.isMuted !== undefined ? Boolean(msg.isMuted) : !targetMember.isMutedByMod;
            targetMember.isMutedByMod = isMuted;
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:force_mute",
              isMuted,
              by: member.name,
            });
            broadcastToRoom(conn.roomId, {
              type: "room:guestAction",
              action: "mute",
              targetUserId: targetId,
              isMuted,
              by: member.name,
            });
            addSystemMessage(
              currentRoom,
              isMuted
                ? `🔇 ${member.avatar} ${member.name} выключил микрофон ${targetMember.avatar} ${targetMember.name}.`
                : `🔊 ${member.avatar} ${member.name} разрешил микрофон для ${targetMember.avatar} ${targetMember.name}.`,
              "mute",
              targetId
            );
          } else if (action === "kick" && targetMember) {
            const reason = msg.reason || "Исключен создателем комнаты";
            addSystemMessage(
              currentRoom,
              `👢 ${member.avatar} ${member.name} исключил ${targetMember.avatar} ${targetMember.name} (${reason}).`,
              "kick",
              targetId
            );
            sendToUserInRoom(conn.roomId, targetId, {
              type: "room:userKicked",
              targetUserId: targetId,
              kickedBy: member.name,
              reason,
            });
            clientConnections.forEach((c, socket) => {
              if (c.roomId === conn.roomId && c.userId === targetId && socket.readyState === WebSocket.OPEN) {
                try {
                  socket.send(JSON.stringify({ type: "kicked", reason }));
                  socket.close(4001, "Kicked by host");
                } catch (e) {}
              }
            });
            delete currentRoom.members[targetId];
            broadcastToRoom(conn.roomId, {
              type: "room:guestAction",
              action: "kick",
              targetUserId: targetId,
              reason,
            });
          } else if (action === "transferHost" && targetMember) {
            member.isHost = false;
            member.role = "member";
            targetMember.isHost = true;
            targetMember.role = "host";
            currentRoom.hostId = targetId;
            currentRoom.hostName = targetMember.name;
            currentRoom.hostAvatar = targetMember.avatar;
            addSystemMessage(
              currentRoom,
              `👑 ${member.avatar} ${member.name} передал роль Создателя зала ${targetMember.avatar} ${targetMember.name}!`,
              "host",
              targetId
            );
            broadcastToRoom(conn.roomId, {
              type: "room:newHost",
              newHostId: targetId,
              newHostName: targetMember.name,
              newHostAvatar: targetMember.avatar,
            });
            broadcastToRoom(conn.roomId, {
              type: "room:guestAction",
              action: "transferHost",
              targetUserId: targetId,
            });
          }

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "room:hostAction": {
          if (currentRoom.hostId !== conn.userId) {
            ws.send(JSON.stringify({ type: "error", message: "Только хост может выполнять действия управления" }));
            return;
          }
          const action = msg.action;
          if (action === "startBroadcast") {
            if (msg.videoUrl) {
              currentRoom.videoUrl = msg.videoUrl;
              currentRoom.provider = serverDetectProvider(msg.videoUrl);
              currentRoom.videoId = serverExtractVideoId(msg.videoUrl, currentRoom.provider);
            }
            if (msg.playing !== undefined) {
              currentRoom.playing = Boolean(msg.playing);
              currentRoom.isPlaying = Boolean(msg.playing);
            }
            addSystemMessage(
              currentRoom,
              `📡 ${member.avatar} ${member.name} запустил эфир ${msg.mic === false ? '(без микрофона)' : '(с голосовым чатом)'}.`,
              "broadcast",
              conn.userId
            );
            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: currentRoom,
            });
            saveRoomToDb(currentRoom);
          } else if (action === "transferHost" && msg.newHostId) {
            const targetId = msg.newHostId;
            const targetMember = currentRoom.members[targetId];
            if (targetMember) {
              member.isHost = false;
              member.role = "member";
              targetMember.isHost = true;
              targetMember.role = "host";
              currentRoom.hostId = targetId;
              currentRoom.hostName = targetMember.name;
              currentRoom.hostAvatar = targetMember.avatar;
              addSystemMessage(
                currentRoom,
                `👑 ${member.avatar} ${member.name} передал роль Создателя зала ${targetMember.avatar} ${targetMember.name}!`,
                "host",
                targetId
              );
              broadcastToRoom(conn.roomId, {
                type: "room:newHost",
                newHostId: targetId,
                newHostName: targetMember.name,
                newHostAvatar: targetMember.avatar,
              });
              broadcastToRoom(conn.roomId, {
                type: "room_state",
                state: currentRoom,
              });
              broadcastParticipantsUpdate(conn.roomId);
              saveRoomToDb(currentRoom);
            }
          }
          break;
        }

        case "member:ban": {
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!actorPerms.manageMembers) {
            ws.send(JSON.stringify({ type: "error", message: "У вас нет прав на бан участников" }));
            return;
          }
          const targetId = msg.targetUserId;
          const targetMember = currentRoom.members[targetId];
          if (!targetMember || !canActorManageTarget(currentRoom, conn.userId, targetId)) {
            ws.send(JSON.stringify({ type: "error", message: "Нельзя забанить участника с равным или более высоким рангом" }));
            return;
          }
          currentRoom.bannedUserIds = currentRoom.bannedUserIds || [];
          if (!currentRoom.bannedUserIds.includes(targetId)) {
            currentRoom.bannedUserIds.push(targetId);
          }
          const reason = msg.reason || "Заблокирован в комнате";
          addSystemMessage(
            currentRoom,
            `🔨 ${member.avatar} ${member.name} забанил ${targetMember.avatar} ${targetMember.name} (${reason}).`,
            "ban",
            targetId
          );
          clientConnections.forEach((c, socket) => {
            if (c.roomId === conn.roomId && c.userId === targetId && socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: "banned", reason }));
                socket.close();
              } catch (e) {
                console.error("[BAN ERROR]", e);
              }
            }
          });
          delete currentRoom.members[targetId];
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "host:transfer": {
          if (currentRoom.hostId !== conn.userId) {
            ws.send(JSON.stringify({ type: "error", message: "Только создатель комнаты может передать права" }));
            return;
          }
          const targetId = msg.targetUserId;
          const targetMember = currentRoom.members[targetId];
          if (!targetMember) return;
          member.isHost = false;
          member.role = "moderator";
          targetMember.isHost = true;
          targetMember.role = "host";
          currentRoom.hostId = targetId;
          addSystemMessage(
            currentRoom,
            `👑 ${member.avatar} ${member.name} передал роль Создателя зала ${targetMember.avatar} ${targetMember.name}!`,
            "host",
            targetId
          );
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "voice:mod_mute": {
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!actorPerms.manageVoice) return;
          const targetId = msg.targetUserId;
          const targetMember = currentRoom.members[targetId];
          if (targetMember && canActorManageTarget(currentRoom, conn.userId, targetId)) {
            targetMember.isMutedByMod = Boolean(msg.isMuted);
            sendToUserInRoom(conn.roomId, targetId, {
              type: "voice:force_mute",
              isMuted: Boolean(msg.isMuted),
              by: member.name,
            });
            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: currentRoom,
            });
            saveRoomToDb(currentRoom);
          }
          break;
        }

        case "room:settings_update": {
          const actorPerms = getUserEffectivePermissions(currentRoom, conn.userId);
          if (!actorPerms.manageRoles && currentRoom.hostId !== conn.userId) {
            ws.send(JSON.stringify({ type: "error", message: "Нет прав для изменения настроек комнаты" }));
            return;
          }
          if (typeof msg.anyoneCanControl === "boolean") {
            currentRoom.anyoneCanControl = msg.anyoneCanControl;
          }
          if (msg.defaultRole) {
            currentRoom.defaultRole = msg.defaultRole;
          }
          if (msg.rolePermissionsOverride) {
            currentRoom.rolePermissionsOverride = msg.rolePermissionsOverride;
          }
          addSystemMessage(
            currentRoom,
            `⚙️ ${member.avatar} ${member.name} обновил параметры доступа и роли в зале.`,
            "settings",
            conn.userId
          );
          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });
          saveRoomToDb(currentRoom);
          break;
        }

        case "user:update":
        case "user:profile": {
          const updatedProfile = msg.profile || msg;
          const oldName = member.name;
          const oldAvatar = member.avatar;

          if (updatedProfile.name) {
            member.name = String(updatedProfile.name).trim();
            conn.name = member.name;
          }
          if (updatedProfile.avatar) {
            member.avatar = String(updatedProfile.avatar);
            conn.avatar = member.avatar;
          }
          if (updatedProfile.color) {
            member.color = String(updatedProfile.color);
            conn.color = member.color;
          }
          if (updatedProfile.status) {
            member.status = updatedProfile.status;
          }
          if (updatedProfile.customStatus !== undefined) {
            member.customStatus = updatedProfile.customStatus;
          }
          if (updatedProfile.bio !== undefined) {
            member.bio = updatedProfile.bio;
          }
          if (updatedProfile.micSettings) {
            member.micSettings = updatedProfile.micSettings;
          }
          if (updatedProfile.cameraSettings) {
            member.cameraSettings = updatedProfile.cameraSettings;
          }

          // If this user is host, update room summary host cache
          if (currentRoom.hostId === conn.userId) {
            currentRoom.hostName = member.name;
            currentRoom.hostAvatar = member.avatar;
          }

          // Update voice room peer if in voice chat
          const vRoom = getVoiceRoom(conn.roomId);
          if (vRoom.has(conn.userId)) {
            const vPeer = vRoom.get(conn.userId)!;
            vPeer.name = member.name;
            vPeer.avatar = member.avatar;
            vPeer.color = member.color;
          }

          // System notification if name or avatar changed
          if (oldName !== member.name || oldAvatar !== member.avatar) {
            addSystemMessage(
              currentRoom,
              `✨ ${member.avatar} ${member.name} обновил свой профиль.`,
              "profile",
              conn.userId
            );
          }

          broadcastToRoom(conn.roomId, {
            type: "user:updated",
            userId: conn.userId,
            user: member,
          });

          broadcastToRoom(conn.roomId, {
            type: "room_state",
            state: currentRoom,
          });

          saveRoomToDb(currentRoom);
          broadcastLobbyUpdate();
          break;
        }

        case "user:color": {
          if (msg.color) {
            member.color = String(msg.color);
            conn.color = member.color;

            const vRoom = getVoiceRoom(conn.roomId);
            if (vRoom.has(conn.userId)) {
              const vPeer = vRoom.get(conn.userId)!;
              vPeer.color = member.color;
            }

            broadcastToRoom(conn.roomId, {
              type: "user:color_updated",
              userId: conn.userId,
              color: member.color,
            });

            broadcastToRoom(conn.roomId, {
              type: "room_state",
              state: currentRoom,
            });

            saveRoomToDb(currentRoom);
          }
          break;
        }

        case "exit_room":
        case "leave_room":
        case "leave":
          handleCleanLeave(ws);
          break;

        case "get_sfu_capabilities":
          {
            const sfuSupported = isMediasoupSupported();
            const sfuRoom = sfuSupported ? getSFURoom(conn.roomId) : null;
            ws.send(JSON.stringify({
              type: "sfu_supported",
              supported: sfuSupported,
              routerRtpCapabilities: sfuRoom ? sfuRoom.router.rtpCapabilities : null
            }));
          }
          break;

        case "create_sfu_transport":
          if (isMediasoupSupported()) {
            createWebRtcTransport(conn.roomId).then(({ params }) => {
              ws.send(JSON.stringify({
                type: "sfu_transport_created",
                params
              }));
            }).catch((err: any) => console.error("Error creating SFU transport", err));
          }
          break;

        case "connect_sfu_transport":
          if (isMediasoupSupported()) {
            const sfuRoom = getSFURoom(conn.roomId);
            const transport = sfuRoom?.transports.get(msg.transportId);
            if (transport) {
              transport.connect({ dtlsParameters: msg.dtlsParameters }).then(() => {
                ws.send(JSON.stringify({
                  type: "sfu_transport_connected",
                  transportId: msg.transportId
                }));
              }).catch((err: any) => console.error("Error connecting transport", err));
            }
          }
          break;

        case "consume_sfu_stream":
          if (isMediasoupSupported()) {
            const sfuRoom = getSFURoom(conn.roomId);
            const transport = sfuRoom?.transports.get(msg.transportId);
            if (transport && sfuRoom?.videoProducer && sfuRoom?.audioProducer) {
              Promise.all([
                transport.consume({
                  producerId: sfuRoom.videoProducer.id,
                  rtpCapabilities: msg.rtpCapabilities,
                  paused: false
                }),
                transport.consume({
                  producerId: sfuRoom.audioProducer.id,
                  rtpCapabilities: msg.rtpCapabilities,
                  paused: false
                })
              ]).then(([videoConsumer, audioConsumer]) => {
                sfuRoom.consumers.set(videoConsumer.id, videoConsumer);
                sfuRoom.consumers.set(audioConsumer.id, audioConsumer);
                ws.send(JSON.stringify({
                  type: "sfu_consumed",
                  videoParams: {
                    id: videoConsumer.id,
                    producerId: sfuRoom.videoProducer!.id,
                    kind: "video",
                    rtpParameters: videoConsumer.rtpParameters
                  },
                  audioParams: {
                    id: audioConsumer.id,
                    producerId: sfuRoom.audioProducer!.id,
                    kind: "audio",
                    rtpParameters: audioConsumer.rtpParameters
                  }
                }));
              }).catch(err => console.error("Error creating WebRTC consumers", err));
            }
          }
          break;

        case "ai:sceneAnalysis": {
          serverAnalyzeScene({
            currentTime: typeof msg.currentTime === "number" ? msg.currentTime : currentRoom.currentTime,
            videoUrl: msg.videoUrl || currentRoom.videoUrl,
            videoTitle: msg.videoTitle || currentRoom.currentVideoTitle,
            prompt: msg.prompt
          }).then((analysis) => {
            ws.send(JSON.stringify({
              type: "ai:sceneAnalysis",
              analysis
            }));
          }).catch((err) => console.error("ai:sceneAnalysis error", err));
          break;
        }

        case "ai:summary": {
          serverSummarizeMoment({
            currentTime: typeof msg.currentTime === "number" ? msg.currentTime : currentRoom.currentTime,
            videoUrl: msg.videoUrl || currentRoom.videoUrl,
            videoTitle: msg.videoTitle || currentRoom.currentVideoTitle,
            windowSeconds: msg.windowSeconds || 15
          }).then((summary) => {
            ws.send(JSON.stringify({
              type: "ai:summary",
              summary
            }));
          }).catch((err) => console.error("ai:summary error", err));
          break;
        }

        case "ai:translation": {
          serverTranslateLines({
            currentTime: typeof msg.currentTime === "number" ? msg.currentTime : currentRoom.currentTime,
            textToTranslate: msg.textToTranslate,
            targetLang: msg.targetLang || "Русский",
            videoTitle: msg.videoTitle || currentRoom.currentVideoTitle
          }).then((translation) => {
            ws.send(JSON.stringify({
              type: "ai:translation",
              translation
            }));
          }).catch((err) => console.error("ai:translation error", err));
          break;
        }

        case "ai:ask":
        case "ai:chat": {
          serverAskAI({
            question: msg.question || msg.text || "",
            videoUrl: msg.videoUrl || currentRoom.videoUrl,
            videoTitle: msg.videoTitle || currentRoom.currentVideoTitle,
            currentTime: typeof msg.currentTime === "number" ? msg.currentTime : currentRoom.currentTime
          }).then((answer) => {
            ws.send(JSON.stringify({
              type: "ai:answer",
              answer
            }));
          }).catch((err) => console.error("ai:ask error", err));
          break;
        }

        case "ai:hostHelp": {
          serverGetHostHelp({
            roomId: conn.roomId,
            members: currentRoom.members,
            chatHistory: currentRoom.chatHistory,
            anyoneCanControl: Boolean(currentRoom.anyoneCanControl),
            videoUrl: currentRoom.videoUrl
          }).then((hostHelp) => {
            ws.send(JSON.stringify({
              type: "ai:hostHelp",
              hostHelp
            }));
          }).catch((err) => console.error("ai:hostHelp error", err));
          break;
        }

        case "ai:guestHelp": {
          serverGetGuestHelp({
            question: msg.question,
            category: msg.category
          }).then((guestHelp) => {
            ws.send(JSON.stringify({
              type: "ai:guestHelp",
              guestHelp
            }));
          }).catch((err) => console.error("ai:guestHelp error", err));
          break;
        }

        case "ai:activityReport": {
          serverGetActivityReport({
            roomId: conn.roomId,
            members: currentRoom.members,
            chatHistory: currentRoom.chatHistory
          }).then((activityReport) => {
            ws.send(JSON.stringify({
              type: "ai:activityReport",
              activityReport
            }));
          }).catch((err) => console.error("ai:activityReport error", err));
          break;
        }

        case "video:reaction": {
          const reactionPayload = {
            id: `react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            emoji: msg.emoji || "❤️",
            userId: conn.userId,
            userName: member.name,
            userAvatar: member.avatar,
            userColor: member.color,
            timestamp: Date.now(),
            xPercent: typeof msg.xPercent === "number" ? msg.xPercent : (15 + Math.random() * 70),
            yPercent: typeof msg.yPercent === "number" ? msg.yPercent : (20 + Math.random() * 60)
          };
          broadcastToRoom(conn.roomId, {
            type: "video:reaction",
            reaction: reactionPayload
          });
          break;
        }

        case "video:sync": {
          broadcastToRoom(conn.roomId, {
            type: "video:sync",
            senderId: conn.userId,
            currentTime: msg.currentTime,
            playing: msg.playing,
            driftSeconds: msg.driftSeconds || 0,
            timestamp: Date.now()
          });
          break;
        }

        case "poll:create": {
          if (!isHost && !effectivePerms.manageVideo) {
            ws.send(JSON.stringify({ type: "error", message: "Только создатель комнаты может запускать голосования" }));
            return;
          }
          const pollId = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const options = Array.isArray(msg.options) ? msg.options.map((opt: any, idx: number) => ({
            id: `opt_${idx}`,
            text: typeof opt === "string" ? opt : (opt.text || `Вариант ${idx + 1}`),
            votes: []
          })) : [];
          
          const poll = {
            id: pollId,
            roomId: conn.roomId,
            question: String(msg.question || "Голосование"),
            options,
            createdBy: conn.userId,
            createdByName: member.name,
            createdAt: Date.now(),
            expiresAt: msg.durationSeconds ? Date.now() + msg.durationSeconds * 1000 : undefined,
            isClosed: false,
            totalVotes: 0
          };

          roomPolls.set(pollId, poll);
          broadcastToRoom(conn.roomId, {
            type: "poll:created",
            poll
          });
          addSystemMessage(
            currentRoom,
            `📊 ${member.avatar} ${member.name} запустил опрос: "${poll.question}"`,
            "poll",
            conn.userId
          );
          break;
        }

        case "poll:vote": {
          const { pollId, optionId } = msg;
          const poll = roomPolls.get(pollId);
          if (poll && !poll.isClosed) {
            poll.options.forEach((opt: any) => {
              opt.votes = opt.votes.filter((uid: string) => uid !== conn.userId);
            });
            const targetOpt = poll.options.find((opt: any) => opt.id === optionId);
            if (targetOpt) {
              targetOpt.votes.push(conn.userId);
            }
            poll.totalVotes = poll.options.reduce((sum: number, opt: any) => sum + opt.votes.length, 0);
            broadcastToRoom(conn.roomId, {
              type: "poll:updated",
              poll
            });
          }
          break;
        }

        case "poll:close": {
          if (!isHost) return;
          const { pollId } = msg;
          const poll = roomPolls.get(pollId);
          if (poll) {
            poll.isClosed = true;
            broadcastToRoom(conn.roomId, {
              type: "poll:closed",
              poll
            });
          }
          break;
        }

        case "poll:list": {
          const polls = Array.from(roomPolls.values()).filter((p: any) => p.roomId === conn.roomId);
          ws.send(JSON.stringify({
            type: "poll:list",
            polls
          }));
          break;
        }

        case "force_sync":
        case "request_sync": {
          // Immediately respond with the authoritative room playback status
          ws.send(JSON.stringify({
            type: "video_sync",
            roomId: currentRoom.roomId,
            hostTime: currentRoom.currentTime,
            hostPlaying: currentRoom.playing,
            hostProvider: currentRoom.provider || "youtube",
            currentTime: currentRoom.currentTime,
            time: currentRoom.currentTime,
            playing: currentRoom.playing,
            isPlaying: currentRoom.isPlaying,
            senderId: currentRoom.hostId || conn.userId,
            timestamp: Date.now(),
          }));
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error("Error processing websocket message:", e);
    }
  });

  ws.on("close", () => {
    handleCleanLeave(ws);
  });
});

function handleCleanLeave(ws: WebSocket) {
  unregisterLobbySubscriber(ws);
  const conn = clientConnections.get(ws);
  if (!conn) return;

  clientConnections.delete(ws);
  lastActionTimes.delete(`${conn.roomId}:${conn.userId}`);
  const room = rooms[conn.roomId];
  if (!room) return;

  const hasOtherConnections = Array.from(clientConnections.values()).some(
    (c) => c.roomId === conn.roomId && c.userId === conn.userId
  );

  if (hasOtherConnections) {
    console.log(`[WS LEAVE] User ${conn.userId} disconnected one of their connections, but still has others active. Skipping room departure cleanup.`);
    return;
  }

  const leavingMember = room.members[conn.userId];
  if (!leavingMember) return;

  const vRoom = voiceRooms.get(conn.roomId);
  if (vRoom && vRoom.has(conn.userId)) {
    vRoom.delete(conn.userId);
    broadcastToRoom(conn.roomId, {
      type: "voice:user_left",
      userId: conn.userId,
    });
  }

  addSystemMessage(room, `🚪 ${leavingMember.avatar} ${leavingMember.name} покинул кинозал.`, "leave", conn.userId);

  delete room.members[conn.userId];
  broadcastLobbyUpdate();

  const activeMembersList = Object.values(room.members || {});
  const activeWsCount = Array.from(clientConnections.values()).filter((c) => c.roomId === conn.roomId).length;

  if (activeMembersList.length === 0 || activeWsCount === 0) {
    console.log(`[AUTO-DELETE ROOM] Room #${conn.roomId} has 0 participants left. Purging immediately from memory and database.`);
    
    // Broadcast room_closed event so all client instances clean their view
    broadcastToRoom(conn.roomId, {
      type: "room_closed",
      roomId: conn.roomId,
      reason: "Все участники покинули комнату. Комната закрыта.",
      message: "Все участники покинули комнату. Комната закрыта.",
    });

    broadcastToRoom(conn.roomId, {
      type: "room:closed",
      roomId: conn.roomId,
      reason: "Все участники покинули комнату. Комната закрыта.",
    });

    delete rooms[conn.roomId];
    try {
      deleteRoomFromDb(conn.roomId);
    } catch (e) {
      console.warn("[AUTO-DELETE ROOM] Error deleting room from DB:", e);
    }
    broadcastLobbyUpdate();
    if (isMediasoupSupported()) {
      stopStreamSession(conn.roomId);
      deleteSFURoom(conn.roomId);
    }
  } else {
    if (leavingMember.isHost || room.hostId === conn.userId) {
      if (activeMembersList.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeMembersList.length);
        const hostMember = activeMembersList[randomIndex] as Member;
        hostMember.isHost = true;
        hostMember.role = "host";
        room.hostId = hostMember.userId;
        room.hostName = hostMember.name;
        room.hostAvatar = hostMember.avatar;
        addSystemMessage(
          room,
          `👑 Создатель покинул кинозал. Пульт управления передан случайному участнику ${hostMember.avatar} ${hostMember.name}.`,
          "host",
          hostMember.userId
        );
        broadcastToRoom(conn.roomId, {
          type: "room:newHost",
          newHostId: hostMember.userId,
          newHostName: hostMember.name,
          newHostAvatar: hostMember.avatar,
        });
      }
    }

    broadcastToRoom(conn.roomId, {
      type: "room_state",
      state: room,
    });

    broadcastParticipantsUpdate(conn.roomId);
    saveRoomToDb(room);
  }
}

server.on("upgrade", (req, socket, head) => {
  const pathname = (req.url || "").split("?")[0];
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

async function startFullStackServer() {
  try {
    const storedRooms = await getAllRoomsFromDb();
    let restoredCount = 0;
    for (const [id, r] of Object.entries(storedRooms)) {
      const memberCount = r.members ? Object.keys(r.members).length : 0;
      if (memberCount > 0) {
        rooms[id] = r;
        restoredCount++;
      } else {
        // Prune empty rooms from database on server startup
        await deleteRoomFromDb(id);
      }
    }
    console.log(`[DB] Successfully restored ${restoredCount} active room(s) from persistent database.`);
    await seedInitialRoomsIfEmpty();
  } catch (err) {
    console.error("[DB] Failed to restore room database:", err);
  }
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(appDir, "dist");
    console.log(`[SERVER] Serving static production assets from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*all", (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Sync TV Server running at http://0.0.0.0:${PORT} (Instance ID: ${INSTANCE_ID})`);

    // Subscribe to multi-instance room events from Redis Pub/Sub
    subscribeToRoomEvents((incomingRoomId, incomingMessage) => {
      broadcastToRoomLocal(incomingRoomId, incomingMessage);
    });
  });
}

startFullStackServer();
