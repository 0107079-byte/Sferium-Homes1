import { useEffect, useRef, useState } from 'react';
import { SyncController } from '../plugins/videoSync';
import { socketClient } from '../ws/socket';
import { SyncStateMessage } from '../types';

export interface UseVideoSyncOptions {
  roomId: string;
  userId: string;
  isHost?: boolean;
  canControl?: boolean;
}

/**
 * useVideoSync - React integration hook for the single canonical SyncController.
 * Contains ZERO duplicate synchronization logic.
 */
export function useVideoSync({ roomId, userId, isHost = false, canControl = false }: UseVideoSyncOptions) {
  const syncControllerRef = useRef<SyncController | null>(null);
  const [currentSyncState, setCurrentSyncState] = useState<SyncStateMessage | null>(null);
  const [lastDriftInfo, setLastDriftInfo] = useState<{ drift: number; type: string }>({ drift: 0, type: 'none' });

  useEffect(() => {
    // Instantiate the single canonical SyncController
    const controller = new SyncController({
      roomId,
      userId,
      isHost,
      canControl,
      onSendMessage: (msg) => {
        socketClient.send(msg);
      },
      onStateApplied: (state) => {
        setCurrentSyncState(state);
      },
      onDriftCorrected: (drift, type) => {
        setLastDriftInfo({ drift, type });
      },
    });

    syncControllerRef.current = controller;

    // Listen for authoritative SYNC_STATE messages from the server
    const unsubscribe = socketClient.subscribe((data) => {
      if (data && data.type === 'SYNC_STATE' && data.roomId === roomId) {
        controller.applySyncState(data as SyncStateMessage);
      }
    });

    return () => {
      unsubscribe();
      controller.destroy();
      syncControllerRef.current = null;
    };
  }, [roomId, userId]);

  // Update permissions dynamically
  useEffect(() => {
    if (syncControllerRef.current) {
      syncControllerRef.current.updatePermissions(canControl, isHost);
    }
  }, [canControl, isHost]);

  return {
    syncController: syncControllerRef.current,
    currentSyncState,
    lastDriftInfo,
  };
}
