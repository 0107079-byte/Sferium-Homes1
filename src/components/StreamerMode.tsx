import React, { useState } from 'react';
import { 
  Tv, 
  Crown, 
  ShieldAlert, 
  Sparkles, 
  Users, 
  MessageSquare, 
  Lock, 
  Radio, 
  Volume2, 
  BarChart2, 
  Send,
  X
} from 'lucide-react';
import { Member, VideoReaction, ChatMessage, AIModerationAlert } from '../types';
import { VideoReactions } from './VideoReactions';
import { VideoAvatars } from './VideoAvatars';

interface StreamerModeProps {
  videoElement: React.ReactNode;
  members: Record<string, Member>;
  chatHistory: ChatMessage[];
  reactions: VideoReaction[];
  moderationAlerts?: AIModerationAlert[];
  currentUserId: string;
  hostId: string;
  onSendReaction: (emoji: string) => void;
  onSendMessage: (text: string) => void;
  onExitStreamerMode: () => void;
  onTriggerAIHostHelp: () => void;
}

export const StreamerMode: React.FC<StreamerModeProps> = ({
  videoElement,
  members,
  chatHistory,
  reactions,
  moderationAlerts = [],
  currentUserId,
  hostId,
  onSendReaction,
  onSendMessage,
  onExitStreamerMode,
  onTriggerAIHostHelp,
}) => {
  const [chatInput, setChatInput] = useState('');
  const memberList = Object.values(members);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <div
      id="streamer-mode-container"
      className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col overflow-hidden"
    >
      {/* Top Streamer Header */}
      <div className="h-12 bg-neutral-900 border-b border-white/10 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-600/20 border border-rose-500/40 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Режим Стримера (Host Live)</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Управление аудиторией заблокировано</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerAIHostHelp}
            className="flex items-center gap-1.5 px-3 py-1 bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50 text-purple-200 text-xs rounded-xl transition-all font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>ИИ‑Копилот</span>
          </button>

          <button
            id="btn-exit-streamer"
            onClick={onExitStreamerMode}
            className="flex items-center gap-1 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-xl transition-all"
          >
            <X className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Video Area */}
        <div className="flex-1 flex flex-col justify-between p-4 bg-black relative overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl">
            {videoElement}

            {/* Reactions */}
            <VideoReactions
              reactions={reactions}
              onSendReaction={onSendReaction}
            />

            {/* Top Video Overlay for Viewers */}
            <div className="absolute top-4 left-4 z-20">
              <VideoAvatars
                members={members}
                currentUserId={currentUserId}
                hostId={hostId}
                reactions={reactions}
              />
            </div>
          </div>

          {/* Bottom Quick Reactions */}
          <div className="mt-3 flex items-center justify-between">
            <VideoReactions
              reactions={[]}
              onSendReaction={onSendReaction}
            />

            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Зрителей онлайн: {memberList.length}</span>
            </div>
          </div>
        </div>

        {/* Right Streamer HUD Sidebar */}
        <div className="w-80 lg:w-96 bg-neutral-900 border-l border-white/10 flex flex-col overflow-hidden">
          {/* AI Moderation Alerts banner */}
          {moderationAlerts.length > 0 && (
            <div className="p-3 bg-rose-950/40 border-b border-rose-500/30 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>ИИ‑Предупреждение модератора:</span>
              </div>
              <p className="text-neutral-300 line-clamp-2">
                {moderationAlerts[0].message}
              </p>
            </div>
          )}

          {/* Fixed Stream Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 bg-neutral-900/90 border-b border-white/5 flex items-center justify-between text-xs font-bold text-neutral-300">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Чат трансляции
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">LIVE</span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {chatHistory.map((msg) => (
                <div key={msg.id} className="text-xs">
                  {msg.type === 'system' ? (
                    <div className="text-neutral-500 italic text-[11px] py-0.5">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="bg-neutral-800/60 rounded-xl p-2 border border-white/5">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-indigo-300">{msg.avatar} {msg.name}</span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-neutral-200 break-words">{msg.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="p-3 bg-neutral-950 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Сообщение стример-чата..."
                className="flex-1 px-3 py-2 bg-neutral-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
