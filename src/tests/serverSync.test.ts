export async function runServerAuthorityTests(): Promise<boolean> {
  console.log('\n[SUITE 10] Server Authority & Protocol Consistency Tests');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Simulated server room state
  interface ServerRoom {
    roomId: string;
    hostId: string;
    anyoneCanControl: boolean;
    currentTime: number;
    playing: boolean;
    revision: number;
    rate: number;
    lastUpdated: number;
  }

  function createTestServer() {
    const room: ServerRoom = {
      roomId: 'SERVER_TEST_ROOM',
      hostId: 'user_host_1',
      anyoneCanControl: false,
      currentTime: 0,
      playing: false,
      revision: 1,
      rate: 1.0,
      lastUpdated: Date.now(),
    };

    const broadcastLogs: any[] = [];
    const clientMessages: Record<string, any[]> = {
      user_host_1: [],
      user_guest_2: [],
    };

    function broadcast(msg: any) {
      broadcastLogs.push(msg);
      Object.keys(clientMessages).forEach((uid) => {
        clientMessages[uid].push(msg);
      });
    }

    function handleMessage(userId: string, msg: any) {
      const isHost = userId === room.hostId || room.anyoneCanControl;

      if (msg.type === 'SYNC_COMMAND') {
        if (!isHost) {
          clientMessages[userId].push({
            type: 'error',
            code: 403,
            message: 'Forbidden: You are not authorized to control playback',
          });
          return;
        }

        const cmd = msg.command || msg.cmd?.type;
        const rawTime = parseFloat(msg.position ?? msg.time ?? room.currentTime);
        if (!isNaN(rawTime) && isFinite(rawTime)) {
          room.currentTime = Math.max(0, Math.min(864000, rawTime));
        }

        if (cmd === 'play') {
          room.playing = true;
        } else if (cmd === 'pause') {
          room.playing = false;
        }

        room.revision += 1;
        const now = Date.now();
        room.lastUpdated = now;

        broadcast({
          type: 'SYNC_COMMAND',
          command: cmd,
          roomId: room.roomId,
          position: room.currentTime,
          time: room.currentTime,
          playing: room.playing,
          playbackRate: room.rate,
          rate: room.rate,
          updatedAt: now,
          serverTime: now,
          revision: room.revision,
          senderId: userId,
        });

        broadcast({
          type: 'SYNC_STATE',
          roomId: room.roomId,
          position: room.currentTime,
          time: room.currentTime,
          playing: room.playing,
          playbackRate: room.rate,
          rate: room.rate,
          updatedAt: now,
          serverTime: now,
          revision: room.revision,
          senderId: userId,
        });
      }
    }

    return { room, handleMessage, broadcastLogs, clientMessages };
  }

  // Test 1: Guest without permissions cannot control video
  {
    const server = createTestServer();
    server.handleMessage('user_guest_2', {
      type: 'SYNC_COMMAND',
      command: 'play',
      position: 100,
    });

    const guestMsgs = server.clientMessages['user_guest_2'];
    assert(guestMsgs.some((m) => m.type === 'error' && m.code === 403), 'Unauthorized guest command receives 403 Forbidden error');
    assert(server.room.playing === false, 'Server room state was NOT modified by unauthorized guest');
    assert(server.room.currentTime === 0, 'Server room time was NOT modified by unauthorized guest');
    assert(server.broadcastLogs.length === 0, 'No broadcast occurred from unauthorized guest command');
  }

  // Test 2: Host command is executed, revision increments, and broadcasted
  {
    const server = createTestServer();
    server.handleMessage('user_host_1', {
      type: 'SYNC_COMMAND',
      command: 'play',
      position: 45.5,
    });

    assert(server.room.playing === true, 'Host command activated playback on server');
    assert(server.room.currentTime === 45.5, 'Host command set authoritative position to 45.5s');
    assert(server.room.revision === 2, 'Monotonic revision incremented to 2');
    assert(server.broadcastLogs.some((m) => m.type === 'SYNC_COMMAND' && m.command === 'play' && m.revision === 2), 'Authoritative SYNC_COMMAND broadcasted');
    assert(server.broadcastLogs.some((m) => m.type === 'SYNC_STATE' && m.position === 45.5 && m.revision === 2), 'Authoritative SYNC_STATE broadcasted');
  }

  // Test 3: Anyone can control toggle enables guest control
  {
    const server = createTestServer();
    server.room.anyoneCanControl = true;

    server.handleMessage('user_guest_2', {
      type: 'SYNC_COMMAND',
      command: 'seek',
      position: 300,
    });

    assert(server.room.currentTime === 300, 'Guest can control video when anyoneCanControl is enabled');
    assert(server.room.revision === 2, 'Revision incremented on guest control');
  }

  console.log(`\nServer Authority Tests: ${passed} PASSED, ${failed} FAILED\n`);
  return failed === 0;
}
