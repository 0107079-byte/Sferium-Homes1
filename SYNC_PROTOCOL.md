# Sferium Homes Video Synchronization Protocol

Canonical Video Synchronization Protocol Specification for Sferium Homes.

## 1. Unified Message Protocol

The video synchronization system uses strictly three canonical WebSocket messages:

```text
SYNC_COMMAND
SYNC_STATE
SYNC_REQUEST
```

No other video synchronization messages, legacy aliases, or secondary channels exist.

---

## 2. SYNC_COMMAND

Sent by a permitted client (Host, Moderator, or authorized Member) to request playback modification on the authoritative server.

### Schema
```ts
interface SyncCommandMessage {
  type: 'SYNC_COMMAND';
  roomId: string;
  command: 'play' | 'pause' | 'seek' | 'rate';
  position?: number;
  playbackRate?: number;
  clientTime?: number;
  userId?: string;
}
```

### Flow
```text
PLAYER
  ↓
SyncController
  ↓
SYNC_COMMAND
  ↓
SERVER (Authoritative Sync Server)
```

Only the server decides whether to apply the command, update room authoritative state, increment monotonic revision, and broadcast `SYNC_STATE`.

---

## 3. SYNC_STATE

The single authoritative state broadcast by the server to all connected clients in the room.

### Schema
```ts
interface SyncStateMessage {
  type: 'SYNC_STATE';
  roomId: string;
  position: number;
  playing: boolean;
  playbackRate: number;
  revision: number;
  serverTime: number;
}
```

### Critical Rules
- `SYNC_STATE` is NEVER a control command. Clients cannot send `SYNC_STATE` to modify server state.
- Server is the single source of truth.
- Monotonic revision: `revision++` on each valid server state change.
- Clients ignore incoming states where `revision <= lastAppliedRevision`.

---

## 4. SYNC_REQUEST

Sent by a client upon joining or resynchronizing to request current room playback state without modifying playback state.

### Schema
```ts
interface SyncRequestMessage {
  type: 'SYNC_REQUEST';
  roomId: string;
  userId?: string;
}
```

### Response
The server computes instantaneous room position using the server clock and replies directly to the client with `SYNC_STATE`. `SYNC_REQUEST` does not change room state and does not increment revision.
