import { describe, it, expect, beforeEach } from 'vitest';
import { AuthoritativeSyncServer, ClientConnection } from '../../../backend/syncVideoServer';
import { SyncController } from '../../plugins/videoSync';
import { MockPlayerAdapter } from '../mockPlayer';

describe('Real End-to-End Sync Pipeline', () => {
  let server: AuthoritativeSyncServer;
  let hostPlayer: MockPlayerAdapter;
  let guestPlayer1: MockPlayerAdapter;
  let guestPlayer2: MockPlayerAdapter;

  let hostController: SyncController;
  let guest1Controller: SyncController;
  let guest2Controller: SyncController;

  let hostWs: any;
  let guest1Ws: any;
  let guest2Ws: any;

  let hostClient: ClientConnection;
  let guest1Client: ClientConnection;
  let guest2Client: ClientConnection;

  beforeEach(() => {
    server = new AuthoritativeSyncServer();

    hostPlayer = new MockPlayerAdapter();
    guestPlayer1 = new MockPlayerAdapter();
    guestPlayer2 = new MockPlayerAdapter();

    hostWs = {
      readyState: 1,
      send: (msg: string) => {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'SYNC_STATE') {
          hostController.applySyncState(parsed);
        }
      },
    };

    guest1Ws = {
      readyState: 1,
      send: (msg: string) => {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'SYNC_STATE') {
          guest1Controller.applySyncState(parsed);
        }
      },
    };

    guest2Ws = {
      readyState: 1,
      send: (msg: string) => {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'SYNC_STATE') {
          guest2Controller.applySyncState(parsed);
        }
      },
    };

    hostClient = { ws: hostWs, userId: 'host', roomId: 'e2e-room', role: 'host' };
    guest1Client = { ws: guest1Ws, userId: 'guest1', roomId: 'e2e-room', role: 'guest' };
    guest2Client = { ws: guest2Ws, userId: 'guest2', roomId: 'e2e-room', role: 'guest' };

    server.registerClient(hostClient);
    server.registerClient(guest1Client);
    server.registerClient(guest2Client);

    hostController = new SyncController({
      roomId: 'e2e-room',
      userId: 'host',
      isHost: true,
      canControl: true,
      onSendMessage: (msg) => server.handleMessage(hostClient, msg),
    });

    guest1Controller = new SyncController({
      roomId: 'e2e-room',
      userId: 'guest1',
      isHost: false,
      canControl: false,
      onSendMessage: (msg) => server.handleMessage(guest1Client, msg),
    });

    guest2Controller = new SyncController({
      roomId: 'e2e-room',
      userId: 'guest2',
      isHost: false,
      canControl: false,
      onSendMessage: (msg) => server.handleMessage(guest2Client, msg),
    });

    hostController.setAdapter(hostPlayer);
    guest1Controller.setAdapter(guestPlayer1);
    guest2Controller.setAdapter(guestPlayer2);
  });

  it('executes full pipeline: Host Play -> SYNC_COMMAND -> SERVER -> revision++ -> SYNC_STATE -> All Guests Play', () => {
    expect(hostPlayer.playing).toBe(false);
    expect(guestPlayer1.playing).toBe(false);
    expect(guestPlayer2.playing).toBe(false);

    // Host presses play
    hostController.handleUserCommand('play');

    expect(hostPlayer.playing).toBe(true);
    expect(guestPlayer1.playing).toBe(true);
    expect(guestPlayer2.playing).toBe(true);

    expect(hostController.getLastRevision()).toBe(1);
    expect(guest1Controller.getLastRevision()).toBe(1);
    expect(guest2Controller.getLastRevision()).toBe(1);
  });

  it('executes full pipeline: Host Seek -> SYNC_COMMAND -> SERVER -> revision++ -> SYNC_STATE -> All Guests Seek', () => {
    hostController.handleUserCommand('seek', 120);

    expect(hostController.getLastRevision()).toBe(1);
    expect(guest1Controller.getLastRevision()).toBe(1);
    expect(guest2Controller.getLastRevision()).toBe(1);

    expect(Math.abs(guestPlayer1.currentTime - 120)).toBeLessThan(1.0);
    expect(Math.abs(guestPlayer2.currentTime - 120)).toBeLessThan(1.0);
  });

  it('executes full pipeline: Host Rate -> SYNC_COMMAND -> SERVER -> revision++ -> SYNC_STATE -> All Guests Rate', () => {
    hostController.handleUserCommand('rate', undefined, 1.5);

    expect(hostPlayer.playbackRate).toBe(1.5);
    expect(guestPlayer1.playbackRate).toBe(1.5);
    expect(guestPlayer2.playbackRate).toBe(1.5);
  });

  it('executes full pipeline: Host Pause -> SYNC_COMMAND -> SERVER -> revision++ -> SYNC_STATE -> All Guests Pause', () => {
    hostController.handleUserCommand('play');
    expect(guestPlayer1.playing).toBe(true);

    hostController.handleUserCommand('pause');
    expect(hostPlayer.playing).toBe(false);
    expect(guestPlayer1.playing).toBe(false);
    expect(guestPlayer2.playing).toBe(false);
  });
});
