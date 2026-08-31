import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncController } from '../plugins/videoSync';
import { MockPlayerAdapter } from './mockPlayer';
import { SyncStateMessage } from '../types';

describe('SyncController (Single Client Sync Engine)', () => {
  let player: MockPlayerAdapter;
  let sentMessages: any[];
  let controller: SyncController;

  beforeEach(() => {
    player = new MockPlayerAdapter();
    sentMessages = [];

    controller = new SyncController({
      roomId: 'room-101',
      userId: 'user-101',
      isHost: true,
      canControl: true,
      onSendMessage: (msg) => sentMessages.push(msg),
    });

    controller.setAdapter(player);
  });

  it('sends SYNC_REQUEST when adapter is set', () => {
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0]).toEqual({
      type: 'SYNC_REQUEST',
      roomId: 'room-101',
      userId: 'user-101',
    });
  });

  it('dispatches SYNC_COMMAND play when host user interacts', () => {
    sentMessages = [];
    controller.handleUserCommand('play');

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SYNC_COMMAND');
    expect(sentMessages[0].command).toBe('play');
    expect(sentMessages[0].roomId).toBe('room-101');
  });

  it('dispatches SYNC_COMMAND pause when host user pauses', () => {
    sentMessages = [];
    controller.handleUserCommand('pause');

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SYNC_COMMAND');
    expect(sentMessages[0].command).toBe('pause');
  });

  it('dispatches SYNC_COMMAND seek with exact position', () => {
    sentMessages = [];
    controller.handleUserCommand('seek', 42.5);

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SYNC_COMMAND');
    expect(sentMessages[0].command).toBe('seek');
    expect(sentMessages[0].position).toBe(42.5);
  });

  it('dispatches SYNC_COMMAND rate with exact playbackRate', () => {
    sentMessages = [];
    controller.handleUserCommand('rate', undefined, 1.5);

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].type).toBe('SYNC_COMMAND');
    expect(sentMessages[0].command).toBe('rate');
    expect(sentMessages[0].playbackRate).toBe(1.5);
  });

  it('applies authoritative SYNC_STATE to local player adapter', () => {
    const state: SyncStateMessage = {
      type: 'SYNC_STATE',
      roomId: 'room-101',
      position: 15,
      playing: true,
      playbackRate: 1.25,
      revision: 1,
      serverTime: Date.now(),
    };

    controller.applySyncState(state);

    expect(player.playing).toBe(true);
    expect(player.playbackRate).toBe(1.25);
    expect(controller.getLastRevision()).toBe(1);
  });

  it('discards stale incoming states where revision <= lastAppliedRevision', () => {
    const state1: SyncStateMessage = {
      type: 'SYNC_STATE',
      roomId: 'room-101',
      position: 15,
      playing: true,
      playbackRate: 1.0,
      revision: 5,
      serverTime: Date.now(),
    };

    controller.applySyncState(state1);
    expect(player.playing).toBe(true);

    // Stale state with revision 3
    const staleState: SyncStateMessage = {
      type: 'SYNC_STATE',
      roomId: 'room-101',
      position: 0,
      playing: false,
      playbackRate: 1.0,
      revision: 3,
      serverTime: Date.now(),
    };

    controller.applySyncState(staleState);
    expect(player.playing).toBe(true); // not changed
    expect(controller.getLastRevision()).toBe(5);
  });

  it('performs seek drift correction when drift is large (>= 1.5s)', () => {
    player.currentTime = 5;
    const state: SyncStateMessage = {
      type: 'SYNC_STATE',
      roomId: 'room-101',
      position: 50,
      playing: true,
      playbackRate: 1.0,
      revision: 10,
      serverTime: Date.now(),
    };

    controller.applySyncState(state);

    expect(player.seekCount).toBeGreaterThanOrEqual(1);
    expect(Math.abs(player.currentTime - 50)).toBeLessThan(1.0);
  });
});
