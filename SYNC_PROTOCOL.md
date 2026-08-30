# ПРОТОКОЛ СИНХРОНИЗАЦИИ ВИДЕО (SYNC PROTOCOL)

## 1. Канонические типы сообщений

Протокол взаимодействия клиент-сервер использует типизированные JSON-сообщения.

### 1.1 `SYNC_STATE` (Authoritative State Broadcast & Heartbeat)
Отправляется хостом на сервер (каждые 500 мс или при смене состояния) и рассылается сервером всем гостям.

```json
{
  "type": "SYNC_STATE",
  "roomId": "ROOM123",
  "revision": 105,
  "position": 42.5,
  "playing": true,
  "playbackRate": 1.0,
  "updatedAt": 1787999900000,
  "serverTime": 1787999900050,
  "senderId": "user_host_1"
}
```

### 1.2 `SYNC_COMMAND` (Host Direct Command)
Отправляется хостом при интерактивных действиях (нажатие Play, Pause, перемещение ползунка Seek, изменение скорости).

```json
{
  "type": "SYNC_COMMAND",
  "command": "play" | "pause" | "seek" | "rate",
  "roomId": "ROOM123",
  "position": 120.0,
  "playing": true,
  "playbackRate": 1.0,
  "revision": 106,
  "updatedAt": 1787999901000
}
```

### 1.3 `SYNC_REQUEST` (Guest Reconnect / Initial Load State Query)
Отправляется гостем при входе в комнату или после reconnect.

```json
{
  "type": "SYNC_REQUEST",
  "roomId": "ROOM123",
  "userId": "user_guest_2"
}
```

### 1.4 `SYNC_ACK` / `SYNC_ERROR`
Служебные ответы сервера (например, если неавторизованный гость пытается послать команду управления).

```json
{
  "type": "SYNC_ERROR",
  "code": "PERMISSION_DENIED",
  "message": "Only host or permitted users can control playback."
}
```

---

## 2. Обратная совместимость (Thin Backward-Compatibility Layer)

Для поддержки существующих клиентов и тестов сервер и клиент прозрачно транслируют старые события (`video:sync`, `sync:state`, `video:play`, `video:pause`, `video:seek`, `video_sync`) в канонические `SYNC_STATE` и `SYNC_COMMAND` без дублирования бизнес-логики.
