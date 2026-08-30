# ПОЛНЫЙ АУДИТ СИСТЕМЫ СИНХРОНИЗАЦИИ (SYNC AUDIT)
**Проект:** Sferium-Homes Watch Party (Совместный просмотр видео)
**Дата аудита:** 2026-08-29

---

## 1. Карта обнаруженных механизмов синхронизации

При аудите проекта обнаружено **6 независимых конкурирующих систем синхронизации**, работающих параллельно:

```text
                               ┌── VideoSyncPlugin (src/plugins/videoSync.ts)
                               ├── useVideoSync hook (src/hooks/useVideoSync.ts)
                               ├── SyncEngine singleton (src/modules/sync.ts)
UniversalPlayer / Player ←─────┼── SyncVideoClient / AutoSync (src/sync/syncVideoClient.ts, src/utils/AutoSync.ts)
                               ├── P2PSyncController (src/p2p/p2pSync.ts)
                               └── UniversalPlayer Direct Watchers (useEffect on currentTime)
```

### Детали обнаруженных компонентов:

1. **`VideoSyncPlugin` (`src/plugins/videoSync.ts`)**:
   - Автономный экземпляр создается внутри `UniversalPlayer.tsx`.
   - Второй экземпляр создается через `initVideoSync` внутри `Room.tsx`.
   - Запускает собственный Host Broadcast Loop (каждые 500 мс).
   - Запускает собственный Guest Alignment Loop (каждые 800 мс).
   - Подписывается на сокеты напрямую (`ws.addEventListener`).
   - Отправляет: `video:sync`, `video:play`, `video:pause`, `video:seek`.

2. **`useVideoSync` Hook (`src/hooks/useVideoSync.ts`)**:
   - Вызывается в `src/pages/Room.tsx`.
   - Создает экземпляр `SyncVideoClient`.
   - Подписывается на события сокета: `video_sync`, `sync:state`, `player:state`, `sync:play`, `sync:pause`, `sync:seek`.
   - Вычисляет собственный дрейф и запускает `autoSyncEngine`.
   - Отправляет: `syncSocket.sendVideoSync`, `sync:state`, `sync:seek`, `sync:play`, `sync:pause`, `syncSocket.sendSyncCommand`.

3. **`SyncEngine` Singleton (`src/modules/sync.ts`)**:
   - Синглтон `syncEngine` экспортируется и привязывается к плееру через `syncEngine.bindPlayer()` в `UniversalPlayer.tsx`.
   - Запускает собственный интервал проверки гостя (каждые 800 мс `guestSyncInterval`).
   - Подписывается на 14 типов событий сокета (`video_sync`, `player:heartbeat`, `player:seek`, `player:state`, `sync:state`, `room_state`, `heartbeat_sync`, `sync:video_url`, `sync:play`, `video:play`, `sync:pause`, `video:pause`, `sync:seek`, `video:seek`).
   - Выполняет собственный `seekSafe()` при дрейфе > 0.3s.

4. **`AutoSyncEngine` (`src/utils/AutoSync.ts`)**:
   - Синглтон `autoSyncEngine`, ведущий отдельный учет `isSyncing`, `driftSeconds`, `latencyMs`.
   - Вызывается из `useVideoSync` и `SyncVideoClient`.

5. **`P2PSyncController` (`src/p2p/p2pSync.ts`)**:
   - Инициализируется в `Room.tsx`.
   - Отправляет сообщения `sync:state`, `sync:play`, `sync:pause`, `sync:seek` в P2P-каналы и дублирует в WebSocket fallback.

6. **`UniversalPlayer` Direct Props Watcher (`src/components/UniversalPlayer.tsx`)**:
   - `useEffect` следит за изменением пропса `currentTime` и для гостя выполняет `video.currentTime = currentTime` при разнице > 0.3s, вызывая параллельный seek в обход плагинов.

7. **Ручные таймеры и обработчики в `Room.tsx`**:
   - Каждые 1500 мс интервал хоста отправляет состояние одновременно через 3 канала:
     `sendStateCommand(...)` + `videoSyncRef.current?.sendState(...)` + `p2pSync.sendState(...)`.
   - При `handlePlay` вызываются 4 метода: `sendPlayCommand()`, `videoSyncRef.current?.sendPlay()`, `p2pSync.sendPlay()`, `syncSocket.sendPlay()`.

---

## 2. Карта типов WebSocket сообщений (Хаос протокола)

На сервере и клиенте циркулировало более **18 различных типов сообщений** для одной и той же цели:

| Действие | Отправляемые и слушаемые типы сообщений |
| :--- | :--- |
| **Периодический Sync / Heartbeat** | `video:sync`, `sync:state`, `video_sync`, `player:heartbeat`, `heartbeat_sync`, `heartbeat`, `heartbeat_update`, `sync_time_update`, `room_state` |
| **Play** | `video:play`, `sync:play`, `play_video`, `sync_play`, `player:state` (playing), `video_command` (play) |
| **Pause** | `video:pause`, `sync:pause`, `pause_video`, `sync_pause`, `player:state` (paused), `video_command` (pause) |
| **Seek** | `video:seek`, `sync:seek`, `seek_video`, `sync_seek`, `player:seek`, `video_command` (seek) |

Каждый раз, когда хост нажимал паузу или перемещал таймлайн, сервер получал 3–5 сообщений разного формата и ретранслировал каждому гостю 5 дублирующих пакетов, вызывая шторм обновлений и взаимные блокировки плееров.

---

## 3. Анализ адаптеров плееров

Обнаружено множественное дублирование логики адаптеров:
- `src/plugins/videoSync.ts` содержал `HTML5VideoPlayerAdapter`, `YouTubePlayerAdapter`, `VKVideoPlayerAdapter`, `GenericPlayerAdapter`.
- `src/lib/YouTubeAdapter.tsx`, `VKAdapter.tsx`, `RutubeAdapter.tsx`, `VideoAdapter.tsx` содержали отдельные реализации.
- `src/modules/sync.ts` содержал отдельную реализацию `seekSafe` с жесткими таймаутами.
- `UniversalPlayer.tsx` реализовывал свой внутренний адаптер с `useImperativeHandle`.

---

## 4. Почему происходила рассинхронизация и заикания (Stutter / Jitter)

1. **Гонка таймеров и интервалов:**
   Одновременно работали 3 интервала хоста (500ms, 750ms, 1500ms) и 3 интервала гостя (800ms, 800ms, 1000ms).
2. **Отсутствие зон коррекции дрейфа (Drift Deadbands):**
   Любое минимальное отклонение > 300ms немедленно вызывало жесткий `seekTo()`. Видео постоянно дергалось взад-вперед при нормальном воспроизведении.
3. **Отсутствие монотонного контроля ревизий на всех уровнях:**
   Старые пакеты из-за задержки сети могли перезаписать свежее состояние хоста.
4. **Многократная компенсация задержки:**
   Компенсация транзитного времени складывалась и в `useVideoSync`, и в `VideoSyncPlugin`, и в `syncEngine`.
