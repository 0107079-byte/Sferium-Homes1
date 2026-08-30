import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { VideoProvider } from '../types';
import { extractVideoId } from '../utils/extractVideoId';
import { YouTubePlayer, YouTubePlayerRef } from './YouTubePlayer';
import { VkPlayer, VkPlayerRef } from './VkPlayer';
import { RutubePlayer, RutubePlayerRef } from './RutubePlayer';
import { UniversalPlayer, UniversalPlayerRef } from './UniversalPlayer';
import { createIframeAdapter, IframePlayerAdapter } from '../utils/iframeAdapter';

export interface VideoPlayerRef {
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  setVolume?: (vol: number) => void;
  getIframeAdapter?: () => IframePlayerAdapter | null;
}

export interface VideoPlayerProps {
  provider: VideoProvider;
  url: string;
  playing: boolean;
  currentTime?: number;
  isHost?: boolean;
  canControl?: boolean;
  roomId?: string;
  userId?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: (playing: boolean) => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      provider,
      url,
      playing,
      currentTime = 0,
      isHost = false,
      canControl = true,
      roomId = 'CINEMA',
      userId,
      onTimeUpdate,
      onStateChange,
      onError,
    },
    ref
  ) => {
    const ytRef = useRef<YouTubePlayerRef>(null);
    const vkRef = useRef<VkPlayerRef>(null);
    const rutubeRef = useRef<RutubePlayerRef>(null);
    const universalRef = useRef<UniversalPlayerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const parsed = extractVideoId(url);
    const videoId = parsed?.id || '';

    const getActivePlayer = (): any => {
      switch (provider) {
        case 'youtube':
          return ytRef.current;
        case 'vk':
          return vkRef.current;
        case 'rutube':
          return rutubeRef.current;
        default:
          return universalRef.current;
      }
    };

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        const player = getActivePlayer();
        if (player?.getCurrentTime) return player.getCurrentTime();
        if (typeof player?.currentTime === 'number') return player.currentTime;
        return 0;
      },
      isPlaying: () => {
        const player = getActivePlayer();
        if (player?.isPlaying) return player.isPlaying();
        if (typeof player?.paused === 'boolean') return !player.paused;
        return playing;
      },
      play: () => {
        const player = getActivePlayer();
        player?.play?.();
      },
      pause: () => {
        const player = getActivePlayer();
        player?.pause?.();
      },
      seekTo: (time: number) => {
        const player = getActivePlayer();
        player?.seekTo?.(time);
      },
      getIframeAdapter: () => {
        const iframe = containerRef.current?.querySelector('iframe') || null;
        return iframe ? createIframeAdapter(iframe) : null;
      },
    }));

    return (
      <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
        {provider === 'youtube' && (
          <YouTubePlayer
            ref={ytRef}
            videoId={videoId}
            isPlaying={playing}
            targetTime={currentTime}
            onTimeUpdate={onTimeUpdate}
            onStateChange={(state) => onStateChange?.(state === 1)}
            onError={onError}
          />
        )}

        {provider === 'vk' && (
          <VkPlayer
            ref={vkRef}
            videoUrl={url}
            videoId={videoId}
            isPlaying={playing}
            targetTime={currentTime}
            onTimeUpdate={onTimeUpdate}
            onError={onError}
          />
        )}

        {provider === 'rutube' && (
          <RutubePlayer
            ref={rutubeRef}
            videoUrl={url}
            videoId={videoId}
            isPlaying={playing}
            targetTime={currentTime}
            onTimeUpdate={onTimeUpdate}
            onError={onError}
          />
        )}

        {provider !== 'youtube' && provider !== 'vk' && provider !== 'rutube' && (
          <UniversalPlayer
            ref={universalRef}
            videoUrl={url}
            provider={provider}
            videoId={videoId}
            playing={playing}
            currentTime={currentTime}
            isHost={isHost}
            roomId={roomId}
            userId={userId}
            anyoneCanControl={canControl}
            onTimeUpdate={(t) => onTimeUpdate?.(t, 0)}
            onPlay={() => onStateChange?.(true)}
            onPause={() => onStateChange?.(false)}
          />
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
