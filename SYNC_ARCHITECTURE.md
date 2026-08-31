# Sferium Homes Video Synchronization Architecture

## 1. System Topology

```text
+-------------------------------------------------------------------+
|                           SERVER AUTHORITY                        |
|                                                                   |
|  - Stores Authoritative Room State (position, playing, rate, rev) |
|  - Processes SYNC_COMMAND and SYNC_REQUEST                        |
|  - Increments Monotonic Revision (revision++)                     |
|  - Broadcasts SYNC_STATE to All Clients                           |
+-------------------------------------------------------------------+
             ▲                                      │
SYNC_COMMAND │                         SYNC_STATE   │ (Broadcast)
SYNC_REQUEST │                                      ▼
+-------------------------------------------------------------------+
|                        CLIENT SYNC ENGINE                         |
|                                                                   |
|                       src/plugins/videoSync.ts                    |
|                          (SyncController)                         |
|                                                                   |
|  - Drift Correction: micro-rate (<1.5s) & seek (>=1.5s)           |
|  - Ignores stale revisions (revision <= lastAppliedRevision)      |
|  - Lock guard (isApplyingState) prevents feedback loops           |
|  - Guest corrections NEVER emit SYNC_COMMAND                      |
+-------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------+
|                      UNIFIED PLAYER ADAPTER                       |
|                                                                   |
|       YouTubeAdapter | VKAdapter | RutubeAdapter | DirectAdapter   |
+-------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------+
|                         UNIVERSAL PLAYER                          |
+-------------------------------------------------------------------+
```

## 2. Playback Lifecycle Paths

### Play Action
```text
PLAYER PLAY
  → SyncController
  → SYNC_COMMAND (command: 'play')
  → SERVER
  → Authoritative State Updated (playing: true, updatedAt: now)
  → revision++
  → SYNC_STATE broadcast
  → ALL CLIENTS
  → SyncController
  → PLAYER
```

### Pause Action
```text
PLAYER PAUSE
  → SyncController
  → SYNC_COMMAND (command: 'pause')
  → SERVER
  → Authoritative State Updated (playing: false, updatedAt: now)
  → revision++
  → SYNC_STATE broadcast
  → ALL CLIENTS
  → SyncController
  → PLAYER
```

### Seek Action
```text
PLAYER SEEK
  → SyncController
  → SYNC_COMMAND (command: 'seek', position: target)
  → SERVER
  → Authoritative State Updated (position: target, updatedAt: now)
  → revision++
  → SYNC_STATE broadcast
  → ALL CLIENTS
  → SyncController
  → PLAYER
```

### Rate Change
```text
PLAYER RATE
  → SyncController
  → SYNC_COMMAND (command: 'rate', playbackRate: targetRate)
  → SERVER
  → Authoritative State Updated (playbackRate: targetRate, updatedAt: now)
  → revision++
  → SYNC_STATE broadcast
  → ALL CLIENTS
  → SyncController
  → PLAYER
```

### Client Join
```text
CLIENT CONNECT / JOIN
  → SYNC_REQUEST
  → SERVER
  → Computes instantaneous authoritative state
  → SYNC_STATE
  → CLIENT
  → SyncController applies state to Player
```

## 3. Drift Correction

1. Client receives authoritative `SYNC_STATE` containing `position`, `playing`, `playbackRate`, `revision`, `serverTime`.
2. Computes expected position:
   `expectedPosition = position + (playing ? (Date.now() - serverTime) / 1000 * playbackRate : 0)`
3. Measures drift: `drift = |currentPosition - expectedPosition|`.
4. If drift >= 1.5s: performs precision `seekTo(expectedPosition)`.
5. If 0.15s <= drift < 1.5s and playing: applies micro-speed adjustment (1.05x or 0.95x).
6. Prevents feedback loops: `isApplyingState` flag blocks emitting `SYNC_COMMAND` during drift adjustments.
