import { useEffect, useState, useCallback, useRef } from 'react';
import { RoomState, VideoProvider } from '../types';
import { syncSocket } from '../ws/socket';
import { autoSyncEngine, AutoSyncState } from '../utils/AutoSync';
import { SyncVideoClient } from '../sync/syncVideoClient';

export interface UseVideoSyncOptions {
  roomId: string;
  userId?: string;
  isHost: boolean;
  canControl?: boolean;
  provider?: VideoProvider;
  currentTime?: number;
  playing?: boolean;
  driftThreshold?: number; // default 0.6s
  sendWebSocketMessage?: (msg: any) => void;
  onSyncSeek?: (time: number) => void;
  onSyncPlay?: () => void;
  onSyncPause?: () => void;
}

export interface UseVideoSyncReturn {
  currentTime: number;
  isPlaying: boolean;
  effectiveTime: number;
  effectivePlaying: boolean;
  drift: number;
  isSynced: boolean;
  syncStatus: 'synced' | 'catching_up' | 'buffering' | 'drift_detected';
  autoSyncStats: AutoSyncState;
  sendPlay: () => void;
  sendPause: () => void;
  sendSeek: (time: number) => void;
  sendState: (time: number, isPlaying: boolean) => void;
  setVideoStateFromServer: (payload: any, player: any) => void;
  sendSyncPulse: (currentTime: number, isPlaying: boolean) => void;
  sendSeekCommand: (time: number) => void;
  sendPlayCommand: (time?: number) => void;
  sendPauseCommand: (time?: number) => void;
  sendStateCommand: (time: number, isPlaying: boolean) => void;
  sendForceSync: () => void;
}

/**
 * useVideoSync Hook
 * Handles robust multi-participant synchronization with drift correction,
 * network jitter smoothing, provider-specific execution, and dual WebSocket/P2P channel support.
 */
export function useVideoSync({
  roomId,
  userId,
  isHost,
  canControl = true,
  provider = 'youtube',
  currentTime = 0,
  playing = false,
  driftThreshold = 0.6,
  sendWebSocketMessage,
  onSyncSeek,
  onSyncPlay,
  onSyncPause,
}: UseVideoSyncOptions): UseVideoSyncReturn {
  const clientRef = useRef<SyncVideoClient | null>(null);

  const [currentTimelineTime, setCurrentTimelineTime] = useState<number>(currentTime);
  const [currentIsPlaying, setCurrentIsPlaying] = useState<boolean>(playing);

  const [syncedState, setSyncedState] = useState<{
    hostTime: number;
    hostPlaying: boolean;
    lastUpdated: number;
  }>({
    hostTime: currentTime,
    hostPlaying: playing,
    lastUpdated: Date.now(),
  });

  const [autoSyncStats, setAutoSyncStats] = useState<AutoSyncState>(autoSyncEngine.getStatus());

  // Initialize SyncVideoClient instance
  useEffect(() => {
    clientRef.current = new SyncVideoClient({
      roomId,
      userId,
      isHost,
      send: sendWebSocketMessage || ((msg) => syncSocket.send(msg)),
    });
  }, [roomId, userId, isHost, sendWebSocketMessage]);

  // Subscribe to AutoSync status updates
  useEffect(() => {
    const unsub = autoSyncEngine.subscribe((status) => {
      setAutoSyncStats(status);
    });
    return unsub;
  }, []);

  // Sync WebSocket listeners
  useEffect(() => {
    const handleSyncPacket = (data: any) => {
      if (!data) return;
      if (data.roomId && data.roomId !== roomId) return;

      const rawTime = Number(
        data.hostTime !== undefined
          ? data.hostTime
          : data.time !== undefined
          ? data.time
          : data.currentTime ?? 0
      );
      const isPlay = Boolean(
        data.hostPlaying !== undefined
          ? data.hostPlaying
          : data.isPlaying !== undefined
          ? data.isPlaying
          : data.playing
      );
      const now = Date.now();
      const transitSec = data.timestamp ? Math.min(1.5, Math.max(0, (now - data.timestamp) / 1000)) : 0;
      const computedHostTime = isPlay ? rawTime + transitSec : rawTime;

      setSyncedState({
        hostTime: computedHostTime,
        hostPlaying: isPlay,
        lastUpdated: now,
      });
      setCurrentTimelineTime(computedHostTime);
      setCurrentIsPlaying(isPlay);

      if (!isHost) {
        autoSyncEngine.reportPlaybackTime(currentTime, computedHostTime, isPlay);
      }
    };

    const unsubVideoSync = syncSocket.on('video_sync', handleSyncPacket);
    const unsubSyncState = syncSocket.on('sync:state', handleSyncPacket);
    const unsubPlayerState = syncSocket.on('player:state', handleSyncPacket);
    
    const unsubSyncPlay = syncSocket.on('sync:play', (data) => {
      handleSyncPacket({ ...data, isPlaying: true });
      if (!isHost) onSyncPlay?.();
    });

    const unsubSyncPause = syncSocket.on('sync:pause', (data) => {
      handleSyncPacket({ ...data, isPlaying: false });
      if (!isHost) onSyncPause?.();
    });

    const unsubSyncSeek = syncSocket.on('sync:seek', (data) => {
      const seekTime = Number(data?.time ?? data?.currentTime ?? data?.payload?.time ?? 0);
      handleSyncPacket({ ...data, hostTime: seekTime, time: seekTime });
      if (!isHost) onSyncSeek?.(seekTime);
    });

    return () => {
      unsubVideoSync();
      unsubSyncState();
      unsubPlayerState();
      unsubSyncPlay();
      unsubSyncPause();
      unsubSyncSeek();
    };
  }, [roomId, isHost, currentTime, onSyncPlay, onSyncPause, onSyncSeek]);

  // Compute calculated drift
  const localTarget = isHost ? currentTime : syncedState.hostTime;
  const drift = Math.abs(currentTime - localTarget);
  const isSynced = drift <= driftThreshold;

  let syncStatus: 'synced' | 'catching_up' | 'buffering' | 'drift_detected' = 'synced';
  if (autoSyncStats.isSyncing) {
    syncStatus = 'catching_up';
  } else if (!isSynced) {
    syncStatus = 'drift_detected';
  }

  // Host Pulse Sender (750ms interval optimal for real-time rooms)
  const sendSyncPulse = useCallback(
    (currTime: number, isPlay: boolean) => {
      if (!isHost && !canControl) return;
      clientRef.current?.hostBroadcast(currTime, isPlay);
      syncSocket.sendVideoSync({
        hostTime: currTime,
        hostPlaying: isPlay,
        hostProvider: provider,
        roomId,
      });
      syncSocket.send('sync:state', {
        roomId,
        time: currTime,
        currentTime: currTime,
        isPlaying: isPlay,
        playing: isPlay,
      });
    },
    [isHost, canControl, provider, roomId]
  );

  const sendSeekCommand = useCallback(
    (time: number) => {
      if (!canControl) return;
      clientRef.current?.sendSeek(time);
      autoSyncEngine.markManualSync(time);
      syncSocket.sendSyncCommand({ type: 'seek', time });
      syncSocket.send('sync:seek', { roomId, time, currentTime: time });
    },
    [canControl, roomId]
  );

  const sendPlayCommand = useCallback(
    (time?: number) => {
      if (!canControl) return;
      clientRef.current?.sendPlay();
      syncSocket.sendSyncCommand({ type: 'play' });
      syncSocket.send('sync:play', { roomId, currentTime: time });
    },
    [canControl, roomId]
  );

  const sendPauseCommand = useCallback(
    (time?: number) => {
      if (!canControl) return;
      clientRef.current?.sendPause();
      syncSocket.sendSyncCommand({ type: 'pause' });
      syncSocket.send('sync:pause', { roomId, currentTime: time });
    },
    [canControl, roomId]
  );

  const sendStateCommand = useCallback(
    (time: number, isPlaying: boolean) => {
      if (!canControl) return;
      clientRef.current?.hostBroadcast(time, isPlaying);
      syncSocket.send('sync:state', {
        roomId,
        time,
        currentTime: time,
        isPlaying,
        playing: isPlaying,
      });
    },
    [canControl, roomId]
  );

  const setVideoStateFromServer = useCallback((payload: any, player: any) => {
    clientRef.current?.applyHostState(player, payload);
    if (payload?.time !== undefined) setCurrentTimelineTime(payload.time);
    if (payload?.playing !== undefined) setCurrentIsPlaying(payload.playing);
  }, []);

  const sendForceSync = useCallback(() => {
    if (isHost) {
      sendSyncPulse(currentTime, playing);
    } else {
      syncSocket.requestSync();
    }
  }, [isHost, currentTime, playing, sendSyncPulse]);

  return {
    currentTime: currentTimelineTime,
    isPlaying: currentIsPlaying,
    effectiveTime: isHost ? currentTime : syncedState.hostTime,
    effectivePlaying: isHost ? playing : syncedState.hostPlaying,
    drift,
    isSynced,
    syncStatus,
    autoSyncStats,
    sendPlay: () => (clientRef.current ? clientRef.current.sendPlay() : sendPlayCommand()),
    sendPause: () => (clientRef.current ? clientRef.current.sendPause() : sendPauseCommand()),
    sendSeek: (t: number) => (clientRef.current ? clientRef.current.sendSeek(t) : sendSeekCommand(t)),
    sendState: (t: number, p: boolean) => (clientRef.current ? clientRef.current.hostBroadcast(t, p) : sendStateCommand(t, p)),
    setVideoStateFromServer,
    sendSyncPulse,
    sendSeekCommand,
    sendPlayCommand,
    sendPauseCommand,
    sendStateCommand,
    sendForceSync,
  };
}

export default useVideoSync;

