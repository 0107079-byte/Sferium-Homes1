import React, { useEffect, useState } from 'react';
import { Room, User, ChatMessage, VideoInfo, Role } from '../types';
import { fetchRoom, updateRoomVideo } from '../services/rooms';
import { useVideoSync } from '../hooks/useVideoSync';
import { socketClient } from '../ws/socket';
import { UniversalPlayer } from './UniversalPlayer';
import { RemoteControlPanel } from './RemoteControlPanel';
import { ParticipantList } from './ParticipantList';
import { ChatPanel } from './ChatPanel';
import { VoicePanel } from './VoicePanel';
import { AIPanel } from './AIPanel';
import { VideoSelector } from './VideoSelector';
import { HostFloatingPanel } from './HostFloatingPanel';
import { ArrowLeft, Share2, Copy, Check, Tv } from 'lucide-react';

interface RoomDashboardProps {
  roomId: string;
  currentUser: User;
  onLeaveRoom: () => void;
}

export const RoomDashboard: React.FC<RoomDashboardProps> = ({
  roomId,
  currentUser,
  onLeaveRoom,
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const [unlockedControl, setUnlockedControl] = useState(false);

  const isHost = room?.hostId === currentUser.id;
  const canControl = isHost || unlockedControl || currentUser.role === 'moderator';

  // 1. Single Canonical Sync Controller Hook
  const { syncController, currentSyncState, lastDriftInfo } = useVideoSync({
    roomId,
    userId: currentUser.id,
    isHost,
    canControl,
  });

  // 2. Fetch room data and connect WebSocket
  useEffect(() => {
    let mounted = true;

    fetchRoom(roomId)
      .then((data) => {
        if (mounted) setRoom(data);
      })
      .catch((e) => console.error('Error fetching room:', e));

    socketClient.connect();

    // Send JOIN_ROOM message
    socketClient.send({
      type: 'JOIN_ROOM',
      roomId,
      user: {
        ...currentUser,
        role: isHost ? 'host' : currentUser.role,
      },
    });

    // Subscribe to room-level WebSocket events (Chat, Video change, Participant updates)
    const unsubscribe = socketClient.subscribe((data) => {
      if (!data) return;

      if (data.type === 'CHAT_MESSAGE' && data.message?.roomId === roomId) {
        setMessages((prev) => [...prev, data.message]);
      } else if (data.type === 'ROOM_VIDEO_CHANGED' && data.roomId === roomId) {
        setRoom((prev) => (prev ? { ...prev, currentVideo: data.video } : prev));
      } else if (data.type === 'USER_JOINED' && data.roomId === roomId) {
        setRoom((prev) => {
          if (!prev) return prev;
          const exists = prev.users.some((u) => u.id === data.user.id);
          const users = exists ? prev.users : [...prev.users, data.user];
          return { ...prev, users };
        });
      } else if (data.type === 'USER_LEFT' && data.roomId === roomId) {
        setRoom((prev) => {
          if (!prev) return prev;
          return { ...prev, users: prev.users.filter((u) => u.id !== data.userId) };
        });
      } else if (data.type === 'USER_ROLE_UPDATED') {
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) => (u.id === data.userId ? { ...u, role: data.role } : u)),
          };
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [roomId, currentUser.id, isHost]);

  const handleSelectVideo = async (video: VideoInfo) => {
    try {
      await updateRoomVideo(roomId, video);
      setRoom((prev) => (prev ? { ...prev, currentVideo: video } : prev));
    } catch (e) {
      console.error('Failed to update video:', e);
    }
  };

  const handleSendMessage = (text: string) => {
    const chatMsg: ChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
      text,
      timestamp: Date.now(),
    };
    socketClient.send({
      type: 'CHAT_MESSAGE',
      message: chatMsg,
    });
  };

  const handleStatusChange = (status: any) => {
    socketClient.send({
      type: 'USER_STATUS',
      status,
    });
  };

  const handleUpdateRole = (targetUserId: string, newRole: Role) => {
    socketClient.send({
      type: 'UPDATE_ROLE',
      targetUserId,
      role: newRole,
    });
  };

  const copyRoomLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeaveRoom}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Вернуться в лобби"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" /> {room.name}
            </h1>
            <span className="text-[11px] text-slate-400 font-mono">ID: {room.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={copyRoomLink}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Ссылка скопирована' : 'Поделиться'}</span>
          </button>
        </div>
      </div>

      {/* Host Banner */}
      <HostFloatingPanel
        room={room}
        isHost={isHost}
        canControl={unlockedControl}
        onToggleControl={() => setUnlockedControl(!unlockedControl)}
      />

      {/* Main Grid: Player on Left, Side Panels on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Player, Video Selector, Remote Controls */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Universal Player */}
          <UniversalPlayer
            video={room.currentVideo}
            syncController={syncController}
            canControl={canControl}
            isHost={isHost}
          />

          {/* Remote Control Panel for SYNC_COMMAND */}
          <RemoteControlPanel
            syncController={syncController}
            syncState={currentSyncState}
            lastDriftInfo={lastDriftInfo}
            isHost={isHost}
          />

          {/* Video Selector */}
          <VideoSelector
            currentVideo={room.currentVideo}
            onSelectVideo={handleSelectVideo}
            disabled={!canControl}
          />
        </div>

        {/* Right Column: Voice, Participants, Chat, AI */}
        <div className="flex flex-col gap-4">
          <VoicePanel onStatusChange={handleStatusChange} />

          <ParticipantList
            users={room.users.length > 0 ? room.users : [currentUser]}
            currentUserId={currentUser.id}
            isHost={isHost}
            onUpdateRole={handleUpdateRole}
          />

          <ChatPanel
            messages={messages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
          />

          <AIPanel />
        </div>
      </div>
    </div>
  );
};
