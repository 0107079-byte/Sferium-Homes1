import { describe, it, expect, beforeEach } from 'vitest';
import { AuthoritativeSyncServer, ClientConnection } from '../../backend/syncVideoServer';
import { SyncCommandMessage, SyncRequestMessage } from '../types';

describe('AuthoritativeSyncServer', () => {
  let server: AuthoritativeSyncServer;
  let mockWsHost: any;
  let mockWsGuest: any;
  let hostClient: ClientConnection;
  let guestClient: ClientConnection;
  let hostSentMessages: any[];
  let guestSentMessages: any[];

  beforeEach(() => {
    server = new AuthoritativeSyncServer();
    hostSentMessages = [];
    guestSentMessages = [];

    mockWsHost = {
      readyState: 1, // OPEN
      send: (msg: string) => hostSentMessages.push(JSON.parse(msg)),
    };

    mockWsGuest = {
      readyState: 1, // OPEN
      send: (msg: string) => guestSentMessages.push(JSON.parse(msg)),
    };

    hostClient = {
      ws: mockWsHost,
      userId: 'host-user',
      roomId: 'test-room',
      role: 'host',
    };

    guestClient = {
      ws: mockWsGuest,
      userId: 'guest-user',
      roomId: 'test-room',
      role: 'guest',
    };

    server.registerClient(hostClient);
    server.registerClient(guestClient);
  });

  it('handles SYNC_COMMAND play with monotonic revision increment and broadcasts SYNC_STATE', () => {
    const playCmd: SyncCommandMessage = {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'play',
      position: 10,
      playbackRate: 1.0,
      clientTime: Date.now(),
      userId: 'host-user',
    };

    server.handleMessage(hostClient, playCmd);

    expect(hostSentMessages.length).toBe(1);
    expect(guestSentMessages.length).toBe(1);

    const state = guestSentMessages[0];
    expect(state.type).toBe('SYNC_STATE');
    expect(state.roomId).toBe('test-room');
    expect(state.playing).toBe(true);
    expect(state.position).toBe(10);
    expect(state.revision).toBe(1);
  });

  it('handles SYNC_COMMAND pause and increments revision', () => {
    server.handleMessage(hostClient, {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'play',
      position: 0,
      clientTime: Date.now(),
      userId: 'host-user',
    });

    server.handleMessage(hostClient, {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'pause',
      position: 15,
      clientTime: Date.now(),
      userId: 'host-user',
    });

    expect(hostSentMessages.length).toBe(2);
    const lastState = hostSentMessages[1];
    expect(lastState.type).toBe('SYNC_STATE');
    expect(lastState.playing).toBe(false);
    expect(lastState.position).toBe(15);
    expect(lastState.revision).toBe(2);
  });

  it('handles SYNC_COMMAND seek', () => {
    server.handleMessage(hostClient, {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'seek',
      position: 45,
      clientTime: Date.now(),
      userId: 'host-user',
    });

    const lastState = hostSentMessages[0];
    expect(lastState.type).toBe('SYNC_STATE');
    expect(lastState.position).toBe(45);
    expect(lastState.revision).toBe(1);
  });

  it('handles SYNC_COMMAND rate', () => {
    server.handleMessage(hostClient, {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'rate',
      playbackRate: 1.5,
      clientTime: Date.now(),
      userId: 'host-user',
    });

    const lastState = hostSentMessages[0];
    expect(lastState.type).toBe('SYNC_STATE');
    expect(lastState.playbackRate).toBe(1.5);
    expect(lastState.revision).toBe(1);
  });

  it('processes SYNC_REQUEST by returning SYNC_STATE only to requester without state change or revision increment', () => {
    // Initial state setup
    server.handleMessage(hostClient, {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'play',
      position: 10,
      clientTime: Date.now(),
      userId: 'host-user',
    });

    // Clear messages
    hostSentMessages = [];
    guestSentMessages = [];

    // Guest sends SYNC_REQUEST
    const req: SyncRequestMessage = {
      type: 'SYNC_REQUEST',
      roomId: 'test-room',
      userId: 'guest-user',
    };

    server.handleMessage(guestClient, req);

    expect(hostSentMessages.length).toBe(0); // Host was not bothered
    expect(guestSentMessages.length).toBe(1); // Guest received authoritative state

    const response = guestSentMessages[0];
    expect(response.type).toBe('SYNC_STATE');
    expect(response.revision).toBe(1); // Revision unchanged
    expect(response.playing).toBe(true);
  });

  it('rejects SYNC_STATE when sent directly from client', () => {
    server.handleMessage(hostClient, {
      type: 'SYNC_STATE',
      roomId: 'test-room',
      position: 999,
      playing: true,
      playbackRate: 2,
      revision: 999,
      serverTime: Date.now(),
    });

    expect(hostSentMessages.length).toBe(0);
    expect(guestSentMessages.length).toBe(0);
  });

  it('rejects SYNC_COMMAND from unauthorized guest', () => {
    server.handleMessage(guestClient, {
      type: 'SYNC_COMMAND',
      roomId: 'test-room',
      command: 'play',
      position: 10,
      userId: 'guest-user',
    });

    expect(hostSentMessages.length).toBe(0);
    expect(guestSentMessages.length).toBe(0);
  });
});
