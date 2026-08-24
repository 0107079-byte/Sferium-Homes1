import React, { useState, useEffect } from 'react';
import { VideoGrid } from './VideoGrid';
import { VoicePanel } from './VoicePanel';
import { RoomDashboard } from './RoomDashboard';
import { HostPanel } from './HostPanel';
import { ParticipantList } from './ParticipantList';
import { RoomState, AppUser, Member } from '../types';
import UserAvatar from './UserAvatar';
import { ShieldCheck, User, Users, Mic, Settings } from 'lucide-react';
import { voiceManager } from '../modules/voice';

export interface RoomProps {
  roomId: string;
  roomName: string;
  roomState?: RoomState | null;
  isHost: boolean;
  userId: string;
  userName: string;
  userAvatar: string;
  userColor: string;
  userProfile?: AppUser;
  anyoneCanControl: boolean;
  onToggleControl: () => void;
  onOpenProfile?: () => void;
  onCloseRoom?: () => void;
  onKickUser?: (userId: string, reason?: string) => void;
  onMuteUser?: (userId: string, isMuted: boolean) => void;
  onStartBroadcast?: (options: { mic?: boolean; videoUrl?: string; playing?: boolean }) => void;
  onTransferHost?: (userId: string) => void;
  sendWebSocketMessage?: (msg: any) => void;
  children?: React.ReactNode;
}

export const Room: React.FC<RoomProps> = ({
  roomId,
  roomName,
  roomState,
  isHost,
  userId,
  userName,
  userAvatar,
  userColor,
  userProfile,
  anyoneCanControl,
  onToggleControl,
  onOpenProfile,
  onCloseRoom,
  onKickUser,
  onMuteUser,
  onStartBroadcast,
  onTransferHost,
  sendWebSocketMessage,
  children,
}) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'participants'>('voice');
  const isGuest = userProfile?.isGuest ?? (userId.startsWith('guest_') || !userProfile?.authProvider || userProfile?.authProvider === 'guest');

  const currentUser = {
    userId,
    name: userName,
    avatar: userAvatar,
    color: userColor,
  };

  useEffect(() => {
    if (!roomId || !currentUser?.userId) return;
    voiceManager
      .join(roomId, {
        userId: currentUser.userId,
        name: currentUser.name,
        avatar: currentUser.avatar,
        color: currentUser.color,
        deviceId: undefined,
      })
      .catch((e) => console.error('voice join error', e));

    return () => {
      try {
        voiceManager.leave();
      } catch (e) {}
    };
  }, [roomId, currentUser?.userId]);

  const members = roomState?.members || {};

  const handleCloseRoom = () => {
    if (onCloseRoom) {
      onCloseRoom();
    } else if (sendWebSocketMessage) {
      sendWebSocketMessage({ type: 'room:close', roomId, userId });
    }
  };

  const handleKickUser = (targetUserId: string, reason?: string) => {
    if (onKickUser) {
      onKickUser(targetUserId, reason);
    } else if (sendWebSocketMessage) {
      sendWebSocketMessage({ type: 'room:kick', targetUserId, reason });
    }
  };

  const handleMuteUser = (targetUserId: string, isMuted: boolean) => {
    if (onMuteUser) {
      onMuteUser(targetUserId, isMuted);
    } else if (sendWebSocketMessage) {
      sendWebSocketMessage({ type: 'room:mute', targetUserId, isMuted });
    }
  };

  const handleStartBroadcast = (options: { mic?: boolean; videoUrl?: string; playing?: boolean }) => {
    if (onStartBroadcast) {
      onStartBroadcast(options);
    } else if (sendWebSocketMessage) {
      sendWebSocketMessage({
        type: 'room:hostAction',
        action: 'startBroadcast',
        roomId,
        ...options,
      });
    }
  };

  const handleTransferHost = (targetUserId: string) => {
    if (onTransferHost) {
      onTransferHost(targetUserId);
    } else if (sendWebSocketMessage) {
      sendWebSocketMessage({
        type: 'room:hostAction',
        action: 'transferHost',
        roomId,
        newHostId: targetUserId,
      });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full gap-4">
      {/* Main Video & Grid Section */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Host Control Panel (Visible strictly to Host) */}
        {isHost && (
          <HostPanel
            roomId={roomId}
            isHost={isHost}
            members={members}
            currentUserId={userId}
            anyoneCanControl={anyoneCanControl}
            onCloseRoom={handleCloseRoom}
            onKickUser={handleKickUser}
            onMuteUser={handleMuteUser}
            onStartBroadcast={handleStartBroadcast}
            onTransferHost={handleTransferHost}
            onToggleControl={onToggleControl}
          />
        )}

        <VideoGrid
          currentUserName={userName}
          currentUserAvatar={userAvatar}
          currentUserColor={userColor}
          layoutMode="cinematic"
        >
          {children}
        </VideoGrid>

        <RoomDashboard
          isHost={isHost}
          anyoneCanControl={anyoneCanControl}
          toggleControl={onToggleControl}
        />
      </div>

      {/* Sidebar: WebRTC Voice Chat, Participant List & Profile Summary */}
      <div className="w-full lg:w-96 flex flex-col gap-3 shrink-0">
        {/* User Card Pill */}
        <div className="p-3 bg-zinc-950/80 border border-zinc-850 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <UserAvatar
              avatar={userAvatar}
              name={userName}
              color={userColor}
              size="sm"
              status="online"
              showStatus
            />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">{userName}</span>
                {isHost ? (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-md font-mono font-bold">
                    👑 ХОСТ
                  </span>
                ) : isGuest ? (
                  <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.2 rounded-md font-mono">
                    Гость
                  </span>
                ) : (
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded-md font-mono flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {userProfile?.authProvider?.toUpperCase() || 'VK'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">
                {userId}
              </p>
            </div>
          </div>

          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Профиль
            </button>
          )}
        </div>

        {/* Tab Switcher: Voice Chat vs Participants */}
        <div className="flex items-center p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'voice'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Голос
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'participants'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Участники ({Object.keys(members).length})
          </button>
        </div>

        {/* Content depending on active tab */}
        <div className="flex-1 min-h-[350px]">
          {activeTab === 'voice' ? (
            <VoicePanel
              roomId={roomId}
              currentUserId={userId}
              currentUserName={userName}
              currentUserAvatar={userAvatar}
              currentUserColor={userColor}
              sendWebSocketMessage={sendWebSocketMessage}
            />
          ) : (
            <ParticipantList
              members={members}
              currentUserId={userId}
              isHost={isHost}
              onKickUser={handleKickUser}
              onMuteUser={handleMuteUser}
              onTransferHost={handleTransferHost}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;
