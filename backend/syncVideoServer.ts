/**
 * Server-side Video Sync Handler
 * Handles sync:play, sync:pause, sync:seek, and sync:state from host
 * and broadcasts synchronized state to all room participants.
 */
export function handleSyncMessage(
  msg: any,
  client: any,
  room: any,
  broadcast: (roomId: string, data: any) => void
) {
  if (!room) return;

  if (!room.videoState) {
    room.videoState = {
      url: room.videoUrl || "",
      time: room.currentTime || 0,
      isPlaying: Boolean(room.playing || room.isPlaying),
      updatedAt: Date.now(),
      hostId: room.hostId || client.id || client.userId,
    };
  }

  const clientId = client.id || client.userId;
  const member = room.members ? (room.members[clientId] || (room.members instanceof Map ? room.members.get(clientId) : undefined)) : undefined;
  const isHost =
    clientId === room.videoState.hostId ||
    clientId === room.hostId ||
    client.isHost === true ||
    client.canControl === true ||
    client.role === 'moderator' ||
    member?.role === 'moderator' ||
    member?.customPermissions?.manageVideo === true ||
    room.anyoneCanControl === true;

  if (!isHost) {
    return; // Only authorized users can control playback sync
  }

  const targetRoomId = room.id || room.roomId;

  switch (msg.type) {
    case "sync:play":
      room.videoState.isPlaying = true;
      room.videoState.updatedAt = Date.now();
      room.playing = true;
      room.isPlaying = true;
      room.lastUpdated = Date.now();
      broadcast(targetRoomId, { type: "sync:play", roomId: targetRoomId });
      break;

    case "sync:pause":
      room.videoState.isPlaying = false;
      room.videoState.updatedAt = Date.now();
      room.playing = false;
      room.isPlaying = false;
      room.lastUpdated = Date.now();
      broadcast(targetRoomId, { type: "sync:pause", roomId: targetRoomId });
      break;

    case "sync:seek":
      const seekTime = typeof msg.time === "number" ? msg.time : parseFloat(msg.currentTime || 0);
      room.videoState.time = seekTime;
      room.videoState.updatedAt = Date.now();
      room.currentTime = seekTime;
      room.lastUpdated = Date.now();
      broadcast(targetRoomId, { type: "sync:seek", roomId: targetRoomId, time: seekTime });
      break;

    case "sync:state":
      const stateTime = typeof msg.time === "number" ? msg.time : parseFloat(msg.currentTime || 0);
      const isPlaying = Boolean(msg.isPlaying ?? msg.playing);
      room.videoState.time = stateTime;
      room.videoState.isPlaying = isPlaying;
      room.videoState.updatedAt = Date.now();
      room.currentTime = stateTime;
      room.playing = isPlaying;
      room.isPlaying = isPlaying;
      room.lastUpdated = Date.now();
      broadcast(targetRoomId, {
        type: "sync:state",
        roomId: targetRoomId,
        time: stateTime,
        isPlaying: isPlaying,
      });
      break;
  }
}

/**
 * handleSync
 * Routes WebSocket sync events (sync:state, sync:play, sync:pause, sync:seek)
 * to other participants in the room.
 */
export function handleSync(ws: any, msg: any, rooms: any) {
  const room = rooms && (rooms[msg.roomId] || (rooms instanceof Map ? rooms.get(msg.roomId) : undefined));
  if (!room) return;

  const broadcastExcept = (senderWs: any, data: any) => {
    if (typeof room.broadcastExcept === 'function') {
      room.broadcastExcept(senderWs, data);
    } else if (typeof room.broadcast === 'function') {
      room.broadcast(data, senderWs);
    }
  };

  switch (msg.type) {
    case "sync:state":
      broadcastExcept(ws, {
        type: "sync:state",
        payload: msg.payload || {
          time: msg.time ?? msg.currentTime,
          playing: msg.isPlaying ?? msg.playing,
          ts: Date.now(),
        },
        time: msg.payload?.time ?? msg.time ?? msg.currentTime,
        isPlaying: msg.payload?.playing ?? msg.isPlaying ?? msg.playing,
        roomId: msg.roomId,
      });
      break;

    case "sync:play":
      broadcastExcept(ws, {
        type: "sync:play",
        roomId: msg.roomId,
      });
      break;

    case "sync:pause":
      broadcastExcept(ws, {
        type: "sync:pause",
        roomId: msg.roomId,
      });
      break;

    case "sync:seek":
      broadcastExcept(ws, {
        type: "sync:seek",
        payload: msg.payload || { time: msg.time ?? msg.currentTime },
        time: msg.payload?.time ?? msg.time ?? msg.currentTime,
        roomId: msg.roomId,
      });
      break;
  }
}

export default handleSyncMessage;

