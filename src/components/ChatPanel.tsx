import React, { useRef, useState, useEffect } from 'react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';
import ChatInput from './ChatInput';

export interface ChatPanelProps {
  chatHistory: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (messageId: string, emoji: string) => void;
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  chatHistory = [],
  currentUserId,
  onSendMessage,
  onSendReaction,
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive if user is near bottom
  useEffect(() => {
    if (!showScrollButton) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, showScrollButton]);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setShowScrollButton(!isNearBottom);
  };

  const handleScrollToBottom = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
    setShowScrollButton(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;
    onSendMessage(clean);
    setInputText('');
  };

  return (
    <div
      className={`bg-zinc-950/80 border border-purple-500/40 rounded-2xl flex flex-col h-[420px] overflow-hidden relative shadow-2xl shadow-purple-950/30 backdrop-blur-md ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-500/30 bg-gradient-to-r from-indigo-950/90 via-purple-950/90 to-pink-950/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-lg text-white shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Чат Совместного Просмотра
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full font-bold font-mono">
            {chatHistory.length} сообщ.
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold font-mono">
            LIVE
          </span>
        </div>
      </div>

      {/* Messages List */}
      <div
        ref={chatContainerRef}
        onScroll={handleChatScroll}
        className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-gradient-to-b from-zinc-950/60 to-zinc-950/90 custom-scrollbar"
      >
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 opacity-30 text-purple-400" />
            <p className="text-xs font-semibold text-zinc-400">В чате пока тихо</p>
            <p className="text-[11px] text-zinc-600 max-w-xs">
              Напишите первое сообщение или нажмите 🎤 для голосового ввода!
            </p>
          </div>
        ) : (
          chatHistory.map((msg: ChatMessage) => {
            if (msg.type === 'system') {
              return (
                <div
                  key={msg.id}
                  className="text-center text-[11px] text-white font-bold select-none bg-indigo-950/60 py-1.5 px-3 rounded-xl border border-indigo-500/40 max-w-xs mx-auto animate-fade-in shadow-sm"
                >
                  {msg.text}
                </div>
              );
            }

            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1 ${
                  isMe ? 'items-end' : 'items-start'
                } animate-fade-in`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-white font-bold">
                  <span className="text-sm">{msg.avatar || '👤'}</span>
                  <span className="text-white font-extrabold">{msg.name || 'Аноним'}</span>
                  <span className="text-purple-300">•</span>
                  <span className="text-zinc-300 font-mono text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div
                  className={`relative group px-4 py-2.5 rounded-2xl text-xs max-w-[85%] font-bold break-words border shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white border-purple-300/40 rounded-tr-none shadow-purple-900/40'
                      : 'bg-zinc-900/95 text-white border-indigo-500/40 rounded-tl-none shadow-black/50'
                  }`}
                >
                  <p className="text-white leading-relaxed">{msg.text}</p>

                  {/* Reaction chips */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-white/20">
                      {Object.entries(msg.reactions).map(([emoji, uids]) => {
                        const hasIReacted = uids.includes(currentUserId);
                        return (
                          <button
                            type="button"
                            key={emoji}
                            onClick={() => onSendReaction(msg.id, emoji)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer select-none transition-all ${
                              hasIReacted
                                ? 'bg-pink-500 text-white border border-pink-300/50 shadow-sm'
                                : 'bg-zinc-950/80 text-white border border-zinc-700 hover:border-purple-400'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-black text-white">{uids.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Reaction Hover Menu */}
                  <div
                    className={`absolute bottom-full mb-1 ${
                      isMe ? 'right-0' : 'left-0'
                    } hidden group-hover:flex items-center gap-1 p-1 bg-zinc-900 border border-purple-500/40 rounded-xl shadow-2xl z-20`}
                  >
                    {['❤️', '🔥', '😂', '👍', '😮', '🍿'].map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => onSendReaction(msg.id, em)}
                        className="p-1 hover:bg-zinc-800 rounded-lg text-xs cursor-pointer transition-transform hover:scale-125"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Floating "Scroll down for new messages" button */}
      {showScrollButton && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="absolute bottom-18 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-pink-600 hover:brightness-110 border border-pink-400/50 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xl shadow-purple-600/30 transition-all cursor-pointer z-20 animate-fade-in flex items-center gap-1.5"
        >
          <span>Новые сообщения ↓</span>
        </button>
      )}

      {/* Input component with Voice Mic */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSubmit={handleSubmit}
        placeholder="Напишите сообщение или нажмите 🎤..."
      />
    </div>
  );
};

export default ChatPanel;
