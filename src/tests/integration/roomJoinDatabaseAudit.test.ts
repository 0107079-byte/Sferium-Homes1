import { describe, it, expect } from 'vitest';
import { roomManager } from '../../../backend/modules/rooms';
import { AuthoritativeSyncServer, ClientConnection } from '../../../backend/syncVideoServer';

describe('Room & Join Audit', () => {
  it('adds and removes users in room manager properly', () => {
    const room = roomManager.createRoom({
      id: 'audit-room-1',
      name: 'Audit Room',
      hostId: 'host-1',
      currentVideo: null,
      playbackState: { position: 0, playing: false, playbackRate: 1.0, revision: 0, updatedAt: Date.now() },
      users: [],
      createdAt: Date.now(),
    });

    expect(roomManager.getRoom('audit-room-1')).toBeDefined();

    roomManager.addUser('audit-room-1', { id: 'u1', name: 'User 1', role: 'member' });
    expect(roomManager.getRoom('audit-room-1')?.users.length).toBe(1);

    roomManager.removeUser('audit-room-1', 'u1');
    expect(roomManager.getRoom('audit-room-1')?.users.length).toBe(0);
  });

  it('verifies server authority provides accurate state upon join without revision increment', () => {
    const server = new AuthoritativeSyncServer();
    let sentMessage: any = null;

    const mockWs = {
      readyState: 1,
      send: (msg: string) => {
        sentMessage = JSON.parse(msg);
      },
    };

    const client: ClientConnection = {
      ws: mockWs as any,
      userId: 'joining-user',
      roomId: 'audit-room-2',
      role: 'guest',
    };

    server.registerClient(client);

    // Initial state before join request
    const initialState = server.getRoomState('audit-room-2');
    const initialRev = initialState.revision;

    server.processSyncRequest(client);

    expect(sentMessage).toBeDefined();
    expect(sentMessage.type).toBe('SYNC_STATE');
    expect(sentMessage.roomId).toBe('audit-room-2');
    expect(sentMessage.revision).toBe(initialRev);
  });
});
