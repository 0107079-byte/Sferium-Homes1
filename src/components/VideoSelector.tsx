import React, { useState } from 'react';
import { Play, Link, Youtube, Video, Tv } from 'lucide-react';
import { VideoProvider } from '../types';

interface VideoSelectorProps {
  onSelectVideo: (url: string) => void;
  currentVideoUrl?: string;
  detectProvider?: (url: string) => VideoProvider;
}

export const VideoSelector: React.FC<VideoSelectorProps> = ({
  onSelectVideo,
  currentVideoUrl,
  detectProvider
}) => {
  const [inputUrl, setInputUrl] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    onSelectVideo(inputUrl.trim());
    setInputUrl('');
  };

  const sampleVideos = [
    {
      title: 'YouTube Demo',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      icon: <Youtube className="w-3.5 h-3.5 text-red-500" />
    },
    {
      title: 'VK Video',
      url: 'https://vk.com/video-220000000_456239001',
      icon: <Video className="w-3.5 h-3.5 text-blue-500" />
    },
    {
      title: 'Rutube Video',
      url: 'https://rutube.ru/video/e97022d4f29a28e833fbb1bfd5494f6e/',
      icon: <Tv className="w-3.5 h-3.5 text-indigo-400" />
    },
    {
      title: 'MP4 Эфир',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      icon: <Link className="w-3.5 h-3.5 text-emerald-400" />
    }
  ];

  return (
    <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden backdrop-blur-md">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-center space-x-2">
        <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shadow-md shadow-purple-500/20">
          <Play className="w-4 h-4 fill-current" />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-white">
            Вставьте ссылку на новое видео
          </h4>
          <p className="text-[10px] text-white font-bold opacity-90">
            YouTube, VK Video, Rutube, Yandex или прямое видео (MP4 / HLS)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="https://vk.com/video... или https://youtu.be/..."
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-all font-mono shadow-inner"
        />
        <button
          type="submit"
          disabled={!inputUrl.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
        >
          Запустить
        </button>
      </form>

      {/* Preset samples */}
      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-800/60">
        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
          Быстрые варианты:
        </span>
        {sampleVideos.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectVideo(sample.url)}
            className="flex items-center space-x-1.5 px-3 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 rounded-xl text-[11px] text-zinc-200 transition-all cursor-pointer shadow-sm hover:shadow-indigo-500/10"
          >
            {sample.icon}
            <span className="font-semibold">{sample.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoSelector;
