import React, { useState } from 'react';
import { Link2, Play, CheckCircle2, AlertCircle, Youtube, Film, Sparkles } from 'lucide-react';
import { extractVideoId } from '../utils/extractVideoId';
import { normalizeUrl } from '../utils/normalizeUrl';

interface LinkInputProps {
  currentUrl?: string;
  onUrlSubmit: (url: string) => void;
  disabled?: boolean;
}

const PRESET_DEMOS = [
  {
    title: 'YouTube (Lo-Fi)',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    platform: 'youtube',
    label: 'YouTube',
  },
  {
    title: 'VK Video (Природа)',
    url: 'https://vk.com/video-220754053_456241857',
    platform: 'vk',
    label: 'VK Video',
  },
  {
    title: 'Rutube (Трейлер)',
    url: 'https://rutube.ru/video/e9d249f87498c61fa25d304f4cbbdb50/',
    platform: 'rutube',
    label: 'Rutube',
  },
];

export const LinkInput: React.FC<LinkInputProps> = ({
  currentUrl = '',
  onUrlSubmit,
  disabled = false,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState(false);

  // Live detection of typed link
  const detected = inputUrl.trim() ? extractVideoId(inputUrl.trim()) : null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const raw = inputUrl.trim();
    if (!raw) {
      setErrorMsg('Пожалуйста, вставьте ссылку на видео');
      return;
    }

    const normalized = normalizeUrl(raw);
    const parsed = extractVideoId(normalized);

    if (!parsed) {
      setErrorMsg('Не удалось распознать ссылку. Поддерживаются: YouTube, VK Video, Rutube');
      return;
    }

    onUrlSubmit(normalized);
    setInputUrl('');
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 2500);
  };

  const handleSelectPreset = (url: string) => {
    setInputUrl(url);
    const normalized = normalizeUrl(url);
    onUrlSubmit(normalized);
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 2500);
  };

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/30">
            <Link2 className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-white tracking-wide">
            Источник Видео
          </span>
        </div>

        {/* Supported Platforms Badges */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-950/80 text-red-300 border border-red-800/50 flex items-center gap-1 font-medium">
            <Youtube className="w-3 h-3 text-red-400" /> YouTube
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/50 flex items-center gap-1 font-medium">
            <Film className="w-3 h-3 text-blue-400" /> VK Video
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-purple-400" /> Rutube
          </span>
        </div>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Вставьте ссылку YouTube (youtu.be / watch?v=), VK Video или Rutube..."
            disabled={disabled}
            className="w-full bg-zinc-950/90 border border-zinc-700/80 text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-24"
          />

          {/* Platform Tag Preview */}
          {detected && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                detected.platform === 'youtube'
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : detected.platform === 'vk'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              }`}>
                {detected.platform}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled || !inputUrl.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Запустить в зал</span>
        </button>
      </form>

      {/* Error or Success feedback */}
      {errorMsg && (
        <div className="mt-2 text-xs text-red-400 flex items-center space-x-1.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successNotice && (
        <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1.5 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Видео отправлено и синхронизировано для всех участников!</span>
        </div>
      )}

      {/* Quick preset demos */}
      <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-zinc-400 font-medium">Быстрые примеры:</span>
        {PRESET_DEMOS.map((p) => (
          <button
            key={p.url}
            type="button"
            onClick={() => handleSelectPreset(p.url)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800/70 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkInput;
