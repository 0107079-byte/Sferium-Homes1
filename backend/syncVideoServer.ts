/**
 * Authoritative Server-side Video Sync Handler
 * Supports strictly the unified protocol:
 * - SYNC_COMMAND (play, pause, seek, rate)
 * - SYNC_STATE (host heartbeat / state update)
 * - SYNC_REQUEST (client catch-up request)
 *
 * Implements monotonic revision counter and single authoritative broadcast.
 */

export interface SyncStatePacket {
  type: 'SYNC_STATE';
  roomId: string;
  position: number;
  currentTime: number;
  playing: boolean;
  isPlaying: boolean;
  playbackRate: number;
  serverTime: number;
  updatedAt: number;
  revision: number;
  senderId: string;
}

export function handleSyncMessage(
  msg: any,
  client: any,
  room: any,
  broadcast: (roomId: string, data: any) => void
) {
  if (!room) return;

  const targetRoomId = room.id || room.roomId;
  const clientId = client.id || client.userId;

  if (typeof room.revision !== 'number') {
    room.revision = 0;
  }
  if (!room.videoState) {
    room.videoState = {
      url: room.videoUrl || "",
      time: room.currentTime || 0,
      isPlaying: Boolean(room.playing || room.isPlaying),
      playbackRate: room.playbackRate || 1.0,
      updatedAt: Date.now(),
      hostId: room.hostId || clientId,
    };
  }

  const member = room.members
    ? (room.members instanceof Map ? room.members.get(clientId) : room.members[clientId])
    : undefined;

  const isHost =
    clientId === room.videoState.hostId ||
    clientId === room.hostId ||
    client.isHost === true ||
    client.canControl === true ||
    client.role === 'moderator' ||
    member?.role === 'moderator' ||
    member?.isHost === true ||
    member?.customPermissions?.manageVideo === true ||
    room.anyoneCanControl === true;

  const now = Date.now();

  switch (msg.type) {
    case 'SYNC_COMMAND': {
      if (!isHost) {
        return; // Only authorized users can execute control commands
      }

      const command = msg.command || msg.cmd;
      let targetTime = typeof msg.position === 'number'
        ? msg.position
        : (typeof msg.currentTime === 'number'
            ? msg.currentTime
            : (typeof msg.time === 'number' ? msg.time : room.currentTime || 0));
      
      targetTime = Math.max(0, targetTime);
      const rate = typeof msg.playbackRate === 'number' ? msg.playbackRate : (typeof msg.rate === 'number' ? msg.rate : (room.playbackRate || 1.0));

      if (command === 'play') {
        room.playing = true;
        room.isPlaying = true;
        room.currentTime = targetTime;
        room.playbackRate = rate;
      } else if (command === 'pause') {
        room.playing = false;
        room.isPlaying = false;
        room.currentTime = targetTime;
        room.playbackRate = rate;
      } else if (command === 'seek') {
        room.currentTime = targetTime;
        if (typeof msg.playing === 'boolean') {
          room.playing = msg.playing;
          room.isPlaying = msg.playing;
        }
      } else if (command === 'rate') {
        room.playbackRate = rate;
      }

      room.revision = (room.revision || 0) + 1;
      room.lastUpdated = now;
      room.videoState.time = room.currentTime;
      room.videoState.isPlaying = room.playing;
      room.videoState.playbackRate = room.playbackRate;
      room.videoState.updatedAt = now;

      const statePacket: SyncStatePacket = {
        type: 'SYNC_STATE',
        roomId: targetRoomId,
        position: room.currentTime,
        currentTime: room.currentTime,
        playing: room.playing,
        isPlaying: room.playing,
        playbackRate: room.playbackRate || 1.0,
        serverTime: now,
        updatedAt: now,
        revision: room.revision,
        senderId: clientId,
      };

      broadcast(targetRoomId, statePacket);
      break;
    }

    case 'SYNC_STATE': {
      if (!isHost) {
        return; // Only host heartbeat is authoritative
      }

      const stateTime = typeof msg.position === 'number'
        ? msg.position
        : (typeof msg.currentTime === 'number'
            ? msg.currentTime
            : (typeof msg.time === 'number' ? msg.time : room.currentTime || 0));
      const isPlaying = typeof msg.playing === 'boolean' ? msg.playing : Boolean(msg.isPlaying);
      const rate = typeof msg.playbackRate === 'number' ? msg.playbackRate : (typeof msg.rate === 'number' ? msg.rate : 1.0);

      room.currentTime = Math.max(0, stateTime);
      room.playing = isPlaying;
      room.isPlaying = isPlaying;
      room.playbackRate = rate;
      room.revision = (room.revision || 0) + 1;
      room.lastUpdated = now;
      room.videoState.time = room.currentTime;
      room.videoState.isPlaying = room.playing;
      room.videoState.playbackRate = room.playbackRate;
      room.videoState.updatedAt = now;

      const statePacket: SyncStatePacket = {
        type: 'SYNC_STATE',
        roomId: targetRoomId,
        position: room.currentTime,
        currentTime: room.currentTime,
        playing: room.playing,
        isPlaying: room.playing,
        playbackRate: room.playbackRate || 1.0,
        serverTime: now,
        updatedAt: now,
        revision: room.revision,
        senderId: clientId,
      };

      broadcast(targetRoomId, statePacket);
      break;
    }

    case 'SYNC_REQUEST': {
      // Calculate current projected time if room was playing
      let projectedTime = room.currentTime || 0;
      if (room.playing && room.lastUpdated) {
        const elapsedSec = (now - room.lastUpdated) / 1000;
        projectedTime += elapsedSec * (room.playbackRate || 1.0);
      }

      const statePacket: SyncStatePacket = {
        type: 'SYNC_STATE',
        roomId: targetRoomId,
        position: projectedTime,
        currentTime: projectedTime,
        playing: Boolean(room.playing),
        isPlaying: Boolean(room.playing),
        playbackRate: room.playbackRate || 1.0,
        serverTime: now,
        updatedAt: now,
        revision: room.revision || 0,
        senderId: room.hostId || 'server',
      };

      if (typeof client.send === 'function') {
        client.send(JSON.stringify(statePacket));
      } else if (client.ws && typeof client.ws.send === 'function') {
        client.ws.send(JSON.stringify(statePacket));
      }
      break;
    }
  }
}

export function handleSync(ws: any, msg: any, rooms: any) {
  const room = rooms && (rooms[msg.roomId] || (rooms instanceof Map ? rooms.get(msg.roomId) : undefined));
  if (!room) return;

  const broadcast = (roomId: string, data: any) => {
    if (typeof room.broadcast === 'function') {
      room.broadcast(data);
    }
  };

  handleSyncMessage(msg, ws, room, broadcast);
}

export default handleSyncMessage;
