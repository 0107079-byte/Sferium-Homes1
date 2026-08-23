import React, { useState } from 'react';
import { Send, Smile, Sparkles } from 'lucide-react';
import ChatMicButton from './ChatMicButton';
import { typingManager } from '../utils/typingIndicator';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Напишите сообщение или нажмите 🎤...',
  className = '',
}) => {
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);

  const quickEmojis = ['🔥', '😂', '❤️', '👍', '🍿', '😮', '🎉', '👏'];

  const handleInputChange = (text: string) => {
    onChange(text);
    if (text.trim().length > 0) {
      typingManager.reportLocalTyping();
    }
  };

  const handleTranscript = (transcriptText: string, isFinal?: boolean) => {
    if (!transcriptText) return;
    onChange(transcriptText);
    typingManager.reportLocalTyping();
  };

  const handleAddEmoji = (emoji: string) => {
    onChange(value ? `${value} ${emoji}` : emoji);
    setShowQuickEmojis(false);
    typingManager.reportLocalTyping();
  };

  return (
    <div className={`p-3 border-t border-purple-500/30 bg-zinc-950/90 shrink-0 relative ${className}`}>
      {/* Quick Emoji Bar Popup */}
      {showQuickEmojis && (
        <div className="absolute bottom-full mb-2 left-3 z-30 flex items-center gap-1.5 p-1.5 bg-zinc-900 border border-purple-500/50 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in">
          {quickEmojis.map((emoji) => (
            <button
              type="button"
              key={emoji}
              onClick={() => handleAddEmoji(emoji)}
              className="p-1.5 hover:bg-zinc-800 rounded-xl text-base cursor-pointer transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        {/* Emoji Toggle Button */}
        <button
          type="button"
          onClick={() => setShowQuickEmojis(!showQuickEmojis)}
          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
            showQuickEmojis
              ? 'bg-purple-900/60 border-purple-400 text-purple-200 shadow-sm'
              : 'bg-zinc-900 border-purple-500/40 text-zinc-400 hover:text-white hover:border-purple-400'
          }`}
          title="Быстрые эмодзи"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Text Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-zinc-900 text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 outline-none focus:border-indigo-500 text-white font-medium placeholder-zinc-500 shadow-inner transition-colors"
            title="Сообщение чата"
          />
        </div>

        {/* Voice Speech-to-Text Button */}
        <ChatMicButton
          onTranscript={handleTranscript}
          disabled={disabled}
          lang="ru-RU"
        />

        {/* Submit / Send Button */}
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 rounded-xl text-white font-bold flex items-center justify-center transition-all cursor-pointer shadow-md shadow-purple-600/30 active:scale-95"
          title="Отправить сообщение"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
