# АРХИТЕКТУРА ЕДИНОЙ СИСТЕМЫ СИНХРОНИЗАЦИИ (SYNC ARCHITECTURE)

## 1. Концепция единого источника истины

В новой архитектуре действует строгое разделение ролей:
- **HOST** — единственный инициатор действий управления (`play`, `pause`, `seek`, `rate`).
- **SERVER** — единственный авторитетный релей и хранитель `RoomSyncState`. Проверяет права, присваивает монотонный `revision`, фиксирует серверное время `serverTime` и рассылает канонический `SYNC_STATE` всем клиентам.
- **GUEST** — ведомый узел (slave). Никогда не генерирует авторитетных состояний. Вычисляет текущую авторитетную позицию хоста с учетом временной шкалы и корректирует свой плеер через **3-зонный механизм коррекции дрейфа**.

```text
                 HOST
                  │
                  ▼
          ┌───────────────┐
          │ SyncController│
          └───────┬───────┘
                  │  (SYNC_COMMAND / SYNC_STATE)
             WebSocket
                  │
                  ▼
          ┌───────────────┐
          │     SERVER    │ (Authoritative Room State, Monotonic Revision,
          │ authoritative │  Server Timestamp, Permission Check)
          │ room state    │
          └───────┬───────┘
                  │  (Канонический SYNC_STATE broadcast)
          ┌───────┼────────┐
          ▼       ▼        ▼
       GUEST 1 GUEST 2  GUEST N
          │       │        │ (SyncController + 3-Zone Drift Correction)
          ▼       ▼        ▼
       Adapter Adapter  Adapter (HTML5, YouTube, VK, Rutube, Yandex)
          │       │        │
          ▼       ▼        ▼
        Player  Player   Player
```

---

## 2. Модель временной шкалы (Timeline Model)

Состояние воспроизведения передается в канонической структуре `SyncState`:

```ts
export interface SyncState {
  roomId: string;
  revision: number;        // Монотонный номер ревизии (1, 2, 3...)
  position: number;        // Секунды в видео на момент updatedAt
  playing: boolean;        // Воспроизводится ли видео
  playbackRate: number;    // Скорость воспроизведения (1.0, 1.25, etc.)
  updatedAt: number;       // Client/Server timestamp отправки
  serverTime: number;      // Авторитетное серверное время Date.now()
  senderId?: string;       // ID пользователя-инициатора
}
```

### Формула вычисления ожидаемой позиции у гостя:
```ts
function calculateEstimatedServerPosition(state: SyncState, clockOffset: number): number {
  if (!state.playing) {
    return state.position;
  }
  const currentServerTime = Date.now() - clockOffset;
  const elapsedSeconds = Math.max(0, (currentServerTime - state.serverTime) / 1000);
  const rate = state.playbackRate > 0 ? state.playbackRate : 1.0;
  return state.position + elapsedSeconds * rate;
}
```

---

## 3. Трехзонная коррекция дрейфа (3-Zone Drift Correction)

Вместо постоянных скачков плеера (`seekTo`) введена плавная модель:

```text
| drift | < 80 мс (ZONE 1: DEADBAND)
   └─► Никаких действий. Плееры идеально синхронизированы.

80 мс <= | drift | < 350 мс (ZONE 2: SOFT RATE CORRECTION)
   └─► Гость отстал: плавно ускорить (playbackRate = 1.05..1.08)
   └─► Гость забежал вперед: плавно замедлить (playbackRate = 0.92..0.95)
   └─► После входа в Zone 1: вернуть playbackRate = authoritativeRate

| drift | >= 350 мс (ZONE 3: HARD CORRECTION)
   └─► Однократный seekTo(estimatedPosition) с защитой от дребезга (cooldown 500 мс).
```

---

## 4. Защита от устаревших пакетов (Monotonic Revision Guard)

Каждый клиент хранит `lastAppliedRevision`. Если входящее сообщение имеет `revision <= lastAppliedRevision`, оно немедленно отклоняется. Это исключает влияние перестановок пакетов в сети (packet reordering) и старых сетевых ответов.

---

## 5. Унифицированная архитектура адаптеров (PlayerAdapter)

Все видеопровайдеры оборачиваются в единый интерфейс:
```ts
export interface PlayerAdapter {
  play(): Promise<void> | void;
  pause(): Promise<void> | void;
  seekTo(time: number): Promise<void> | void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): Promise<void> | void;
  isPlaying(): boolean;
  isReady(): boolean;
  destroy(): void;
}
```

Реализации:
- `HTML5PlayerAdapter` — прямой доступ к `<video>`, обработка autoplay policy.
- `YouTubePlayerAdapter` — обертка над iframe API (`playVideo`, `pauseVideo`, `seekTo(time, true)`, `setPlaybackRate`).
- `VKPlayerAdapter` — интеграция с VK Video Iframe Bridge с буферным восстановлением.
- `RutubePlayerAdapter` — интеграция с Rutube postMessage/iframe player.
- `YandexPlayerAdapter` / `GenericPlayerAdapter` — универсальный адаптер для любых HTML5 / Iframe плееров.

---

## 6. Жизненный цикл Heartbeat и Reconnect

1. **Host Heartbeat**: Единый таймер с интервалом 500 мс отправляет `SYNC_STATE` на сервер.
2. **Guest Alignment Loop**: Единый таймер с интервалом 700 мс проверяет дрейф и плавно подстраивает скорость воспроизведения.
3. **Reconnect Recovery**: При обрыве связи и повторном подключении гость автоматически отправляет `SYNC_REQUEST`, в ответ сервер высылает актуальный `SYNC_STATE`.
4. **Удаление/Отключение старых модулей**:
   - `SyncEngine` (`src/modules/sync.ts`) превращается в тонкий фасад над `SyncController`.
   - `useVideoSync` (`src/hooks/useVideoSync.ts`) делегирует все вызовы в единый `SyncController`.
   - Дублирующие таймеры в `UniversalPlayer.tsx` и `Room.tsx` удалены.
