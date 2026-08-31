import React, { useState } from 'react';
import { VideoInfo, VideoProvider } from '../types';
import { Link2, Youtube, PlaySquare, Film, Search } from 'lucide-react';

interface VideoSelectorProps {
  currentVideo: VideoInfo | null;
  onSelectVideo: (video: VideoInfo) => void;
  disabled?: boolean;
}

const PRESET_VIDEOS: VideoInfo[] = [
  {
    title: 'Rick Astley - Never Gonna Give You Up',
    provider: 'youtube',
    id: 'dQw4w9WgXcQ',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  },
  {
    title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
    provider: 'youtube',
    id: 'jfKfPfyJRdk',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg',
  },
  {
    title: 'Big Buck Bunny (Open Source Movie 4K)',
    provider: 'youtube',
    id: 'aqz-KE-bpKQ',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    thumbnail: 'https://img.youtube.com/vi/aqz-KE-bpKQ/mqdefault.jpg',
  },
];

export const VideoSelector: React.FC<VideoSelectorProps> = ({
  currentVideo,
  onSelectVideo,
  disabled,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'url'>('presets');

  const parseVideoUrl = (url: string): VideoInfo | null => {
    try {
      const trimmed = url.trim();

      // YouTube
      const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch && ytMatch[1]) {
        return {
          provider: 'youtube',
          id: ytMatch[1],
          url: trimmed,
          title: `YouTube Video (${ytMatch[1]})`,
          thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`,
        };
      }

      // VK Video
      const vkMatch = trimmed.match(/video_ext\.php\?oid=(-?\d+)&id=(\d+)|vk\.com\/video(-?\d+)_(\d+)/);
      if (vkMatch) {
        const oid = vkMatch[1] || vkMatch[3];
        const vid = vkMatch[2] || vkMatch[4];
        return {
          provider: 'vk',
          id: `${oid}_${vid}`,
          url: trimmed,
          title: `VK Video (${oid}_${vid})`,
        };
      }

      // Rutube
      const rutubeMatch = trimmed.match(/rutube\.ru\/(?:video\/|play\/embed\/)([a-zA-Z0-9]+)/);
      if (rutubeMatch && rutubeMatch[1]) {
        return {
          provider: 'rutube',
          id: rutubeMatch[1],
          url: trimmed,
          title: `Rutube Video (${rutubeMatch[1]})`,
        };
      }

      // Direct MP4/WebM
      if (trimmed.match(/\.(mp4|webm|m3u8|ogv)(\?.*)?$/i)) {
        return {
          provider: 'direct',
          id: 'direct-file',
          url: trimmed,
          title: 'Прямой видеопоток',
        };
      }

      return null;
    } catch {
      return null;
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput || disabled) return;
    const parsed = parseVideoUrl(urlInput);
    if (parsed) {
      onSelectVideo(parsed);
      setUrlInput('');
    } else {
      alert('Пожалуйста, укажите корректную ссылку на YouTube, VK, Rutube или прямой .mp4 файл');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-400" /> Выбор видео
        </h3>
        <div className="flex gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-2.5 py-1 rounded-md transition ${activeTab === 'presets' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Каталог
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`px-2.5 py-1 rounded-md transition ${activeTab === 'url' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Ссылка
          </button>
        </div>
      </div>

      {activeTab === 'url' ? (
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Вставьте ссылку на YouTube, VK, Rutube или .mp4"
              disabled={disabled}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !urlInput.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
          >
            Открыть
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PRESET_VIDEOS.map((vid) => (
            <div
              key={vid.id}
              onClick={() => !disabled && onSelectVideo(vid)}
              className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 ${
                currentVideo?.id === vid.id
                  ? 'bg-purple-950/40 border-purple-600'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {vid.thumbnail && (
                <img
                  src={vid.thumbnail}
                  alt={vid.title}
                  className="w-full aspect-video object-cover rounded-md"
                />
              )}
              <span className="text-xs font-medium text-slate-200 line-clamp-1">{vid.title}</span>
              <div className="flex items-center gap-1 text-[10px] text-purple-400">
                <Youtube className="w-3 h-3" />
                <span>YouTube</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
