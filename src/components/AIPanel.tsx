import React, { useState } from 'react';
import { Bot, Sparkles, Send, HelpCircle, Subtitles, Languages } from 'lucide-react';
import { AIMessage } from '../types';

export const AIPanel: React.FC = () => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Привет! Я AI-Ассистент Sferium. Могу кратко пересказать сцену, ответить на вопросы по видео или помочь с модерацией.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = (presetQuery?: string) => {
    const q = presetQuery || input;
    if (!q.trim()) return;

    const userMsg: AIMessage = {
      id: `ai_${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!presetQuery) setInput('');
    setLoading(true);

    // AI simulation / assistant response
    setTimeout(() => {
      let reply = 'Отличный вопрос! Видео воспроизводится в режиме синхронизации с авто-дрифтом.';
      if (q.includes('переведи') || q.includes('перевод')) {
        reply = 'Перевод фрагмента: "Мы никогда не сдадимся и продолжим двигаться вперед вместе."';
      } else if (q.includes('что происходит') || q.includes('сцена')) {
        reply = 'В текущем фрагменте идет динамичная музыкальная сцена с танцевальной хореографией.';
      } else if (q.includes('помоги') || q.includes('как')) {
        reply = 'Хост комнаты может управлять воспроизведением, а участники автоматически синхронизируются через единый канонический протокол SYNC_COMMAND/SYNC_STATE.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_rep_${Date.now()}`,
          sender: 'assistant',
          text: reply,
          timestamp: Date.now(),
        },
      ]);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-200">AI-Ассистент (Gemini)</h3>
        </div>
        <span className="text-[10px] bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40">
          Онлайн
        </span>
      </div>

      <div className="p-2 border-b border-slate-800 bg-slate-950/40 flex gap-1.5 overflow-x-auto">
        <button
          onClick={() => handleSend('О чем это видео?')}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition flex items-center gap-1"
        >
          <HelpCircle className="w-3 h-3 text-purple-400" /> О чем видео?
        </button>
        <button
          onClick={() => handleSend('Что происходит в этой сцене?')}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition flex items-center gap-1"
        >
          <Subtitles className="w-3 h-3 text-purple-400" /> Анализ сцены
        </button>
        <button
          onClick={() => handleSend('Сделай перевод текущей фразы')}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition flex items-center gap-1"
        >
          <Languages className="w-3 h-3 text-purple-400" /> Перевод
        </button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 min-h-[140px] max-h-[220px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-2.5 rounded-xl text-xs flex gap-2 ${
              m.sender === 'assistant'
                ? 'bg-slate-950/80 border border-slate-800 text-slate-200'
                : 'bg-purple-600/30 border border-purple-500/30 text-purple-100 ml-4'
            }`}
          >
            {m.sender === 'assistant' && <Bot className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />}
            <span>{m.text}</span>
          </div>
        ))}
        {loading && (
          <div className="text-[11px] text-purple-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-spin" /> Анализирую...
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-800 flex gap-1.5 bg-slate-950/60">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросить AI-ассистента..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim()}
          className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
