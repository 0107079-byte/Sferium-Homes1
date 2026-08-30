import { useEffect, useState, useCallback, useRef } from 'react';
import { VideoProvider, SyncStatusInfo } from '../types';
import { syncSocket } from '../ws/socket';
import { wrapAsUnifiedPlayer, applySync } from '../plugins/videoSync';

export interface UseVideoSyncOptions {
  roomId: string;
  userId?: string;
  isHost: boolean;
  canControl?: boolean;
  provider?: VideoProvider;
  currentTime?: number;
  playing?: boolean;
  driftThreshold?: number; // default 0.35s
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
  autoSyncStats: SyncStatusInfo;
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
 * Authoritative client-side sync hook operating solely via the unified protocol:
 * SYNC_COMMAND, SYNC_STATE, SYNC_REQUEST.
 */
export function useVideoSync({
  roomId,
  userId,
  isHost,
  canControl = true,
  provider = 'youtube',
  currentTime = 0,
  playing = false,
  driftThreshold = 0.35,
  sendWebSocketMessage,
  onSyncSeek,
  onSyncPlay,
  onSyncPause,
}: UseVideoSyncOptions): UseVideoSyncReturn {
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

  const [autoSyncStats, setAutoSyncStats] = useState<SyncStatusInfo>({
    isSyncing: false,
    driftSeconds: 0,
    latencyMs: 0,
    lastSyncedAt: Date.now(),
    serverTime: Date.now(),
    localTime: currentTime,
  });

  const syncTimeoutRef = useRef<any>(null);

  // Sync WebSocket listeners
  useEffect(() => {
    const handleSyncState = (data: any) => {
      if (!data) return;
      if (data.roomId && data.roomId !== roomId) return;

      const rawTime = Number(
        data.position !== undefined
          ? data.position
          : data.time !== undefined
          ? data.time
          : data.currentTime ?? 0
      );
      const isPlay = Boolean(data.playing !== undefined ? data.playing : data.isPlaying);
      const now = Date.now();
      const transitSec = data.serverTime ? Math.min(1.5, Math.max(0, (now - data.serverTime) / 1000)) : 0;
      const computedHostTime = isPlay ? rawTime + transitSec : rawTime;

      setSyncedState({
        hostTime: computedHostTime,
        hostPlaying: isPlay,
        lastUpdated: now,
      });
      setCurrentTimelineTime(computedHostTime);
      setCurrentIsPlaying(isPlay);

      if (!isHost) {
        const driftSec = Math.abs(computedHostTime - currentTime);
        const isOutOfSync = driftSec > driftThreshold;
        setAutoSyncStats({
          isSyncing: isOutOfSync,
          driftSeconds: Math.round(driftSec * 100) / 100,
          latencyMs: Math.round(driftSec * 1000),
          lastSyncedAt: isOutOfSync ? Date.now() : now,
          serverTime: data.serverTime || now,
          localTime: currentTime,
        });

        if (isOutOfSync) {
          if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
          syncTimeoutRef.current = setTimeout(() => {
            setAutoSyncStats((prev) => ({ ...prev, isSyncing: false, lastSyncedAt: Date.now() }));
          }, 1000);
        }
      }
    };

    const handleSyncCommand = (data: any) => {
      if (!data) return;
      if (data.roomId && data.roomId !== roomId) return;

      const command = data.command || data.cmd;
      const cmdTime = Number(data.position !== undefined ? data.position : data.time ?? currentTime);

      if (command === 'play') {
        setCurrentIsPlaying(true);
        if (data.position !== undefined || data.time !== undefined) {
          setCurrentTimelineTime(cmdTime);
        }
        if (!isHost) onSyncPlay?.();
      } else if (command === 'pause') {
        setCurrentIsPlaying(false);
        if (data.position !== undefined || data.time !== undefined) {
          setCurrentTimelineTime(cmdTime);
        }
        if (!isHost) onSyncPause?.();
      } else if (command === 'seek') {
        setCurrentTimelineTime(cmdTime);
        if (!isHost) onSyncSeek?.(cmdTime);
      }
    };

    const unsubSyncState = syncSocket.on('SYNC_STATE', handleSyncState);
    const unsubSyncCommand = syncSocket.on('SYNC_COMMAND', handleSyncCommand);

    return () => {
      unsubSyncState();
      unsubSyncCommand();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [roomId, isHost, currentTime, driftThreshold, onSyncPlay, onSyncPause, onSyncSeek]);

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

  const sendSyncPulse = useCallback(
    (currTime: number, isPlay: boolean) => {
      if (!isHost && !canControl) return;
      syncSocket.sendSyncState({
        position: currTime,
        playing: isPlay,
      });
    },
    [isHost, canControl]
  );

  const sendSeekCommand = useCallback(
    (time: number) => {
      if (!canControl) return;
      syncSocket.sendSeek(time);
      setAutoSyncStats((prev) => ({
        ...prev,
        isSyncing: true,
        driftSeconds: 0,
        latencyMs: 15,
        lastSyncedAt: Date.now(),
        localTime: time,
      }));
    },
    [canControl]
  );

  const sendPlayCommand = useCallback(
    (time?: number) => {
      if (!canControl) return;
      syncSocket.sendPlay(time);
    },
    [canControl]
  );

  const sendPauseCommand = useCallback(
    (time?: number) => {
      if (!canControl) return;
      syncSocket.sendPause(time);
    },
    [canControl]
  );

  const sendStateCommand = useCallback(
    (time: number, isPlaying: boolean) => {
      if (!canControl) return;
      syncSocket.sendSyncState({
        position: time,
        playing: isPlaying,
      });
    },
    [canControl]
  );

  const setVideoStateFromServer = useCallback((payload: any, player: any) => {
    if (!player) return;
    const hostTime = typeof payload?.time === 'number' ? payload.time : (typeof payload?.position === 'number' ? payload.position : 0);
    const hostPlaying = Boolean(payload?.playing !== undefined ? payload.playing : payload?.isPlaying);
    const hostRate = typeof payload?.playbackRate === 'number' ? payload.playbackRate : 1.0;

    const unified = wrapAsUnifiedPlayer(player);
    const localTime = unified.getCurrentTime();
    const localPlaying = typeof unified.isPlaying === 'function' ? unified.isPlaying() : false;
    const localRate = unified.getPlaybackRate();

    applySync(unified, localTime, hostTime, localPlaying, hostPlaying, localRate, hostRate, payload?.updatedAt || payload?.ts);

    if (payload?.time !== undefined || payload?.position !== undefined) {
      setCurrentTimelineTime(hostTime);
    }
    if (payload?.playing !== undefined || payload?.isPlaying !== undefined) {
      setCurrentIsPlaying(hostPlaying);
    }
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
    sendPlay: () => sendPlayCommand(),
    sendPause: () => sendPauseCommand(),
    sendSeek: (t: number) => sendSeekCommand(t),
    sendState: (t: number, p: boolean) => sendStateCommand(t, p),
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
