/**
 * VideoSyncPlugin
 * Клиентский плагин синхронизации видеопотоков для комнат совместного просмотра.
 * Поддерживает:
 * - Авто-коррекцию дрифта (таймкоды, плейбек-рейт)
 * - Ротацию и смену роли Хост / Гость
 * - Прямые MP4/WebM потоки и HLS (.m3u8) через Hls.js
 * - Автоматический реконнект WebSocket
 */
class VideoSyncPlugin {
  /**
   * @param {Object} options
   * @param {string} [options.wsUrl] - WebSocket URL сервера
   * @param {string} [options.roomId] - ID комнаты просмотра
   * @param {HTMLVideoElement} options.videoElement - DOM-элемент <video>
   * @param {function} [options.onStateChange] - Коллбек изменения общего состояния (init, user_joined, user_left, source_changed и т.д.)
   * @param {function} [options.onHostChange] - Коллбек изменения прав хоста (isHost: boolean)
   * @param {number} [options.syncThreshold=0.2] - Порог рассинхрона в секундах для мгновенного seek
   */
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host);
    this.roomId = options.roomId || 'default';
    this.video = options.videoElement;
    this.isHost = false;
    this.userId = null;
    this.syncInterval = null;
    this.onStateChange = options.onStateChange || null;
    this.onHostChange = options.onHostChange || null;
    this.syncThreshold = options.syncThreshold !== undefined ? options.syncThreshold : 0.2;
    this.hlsInstance = null;
    this.isApplyingRemote = false;

    if (!this.video) {
      console.error('[VideoSyncPlugin] Не передан videoElement!');
    }

    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.send({ type: 'join', roomId: this.roomId });
        if (this.onStateChange) this.onStateChange('connected', { roomId: this.roomId });
      };

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handleMessage(msg);
        } catch (err) {
          console.warn('[VideoSyncPlugin] Ошибка парсинга WS сообщения:', err);
        }
      };

      this.ws.onclose = () => {
        if (this.onStateChange) this.onStateChange('disconnected', {});
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        if (this.onStateChange) this.onStateChange('error', { error: err });
      };
    } catch (err) {
      console.error('[VideoSyncPlugin] Не удалось открыть соединение WS:', err);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'init':
      case 'room_init':
        this.userId = msg.userId;
        this.isHost = Boolean(msg.isHost);
        if (msg.state && msg.state.src) {
          this.loadSource(msg.state.src, msg.state.currentTime);
        }
        this.applyState(msg.state);
        this.setupControls();
        if (this.onHostChange) this.onHostChange(this.isHost);
        if (this.onStateChange) this.onStateChange('init', msg);
        break;

      case 'host_changed':
      case 'host_rotation':
        this.isHost = msg.newHostId === this.userId;
        this.setupControls();
        if (this.onHostChange) this.onHostChange(this.isHost);
        if (this.onStateChange) this.onStateChange('host_changed', msg);
        break;

      case 'state':
      case 'sync:state':
      case 'video:sync':
        this.applyState(msg.data || msg);
        break;

      case 'play':
      case 'sync:play':
      case 'video:play':
        if (!this.isHost && this.video) {
          this.isApplyingRemote = true;
          if (msg.time !== undefined && Math.abs(this.video.currentTime - msg.time) > this.syncThreshold) {
            this.video.currentTime = msg.time;
          }
          this.video.play().catch(() => {}).finally(() => {
            setTimeout(() => { this.isApplyingRemote = false; }, 100);
          });
        }
        break;

      case 'pause':
      case 'sync:pause':
      case 'video:pause':
        if (!this.isHost && this.video) {
          this.isApplyingRemote = true;
          if (msg.time !== undefined && Math.abs(this.video.currentTime - msg.time) > this.syncThreshold) {
            this.video.currentTime = msg.time;
          }
          this.video.pause();
          setTimeout(() => { this.isApplyingRemote = false; }, 100);
        }
        break;

      case 'seek':
      case 'sync:seek':
      case 'video:seek':
        if (!this.isHost && this.video) {
          const targetTime = msg.time !== undefined ? msg.time : msg.currentTime;
          if (typeof targetTime === 'number') {
            this.isApplyingRemote = true;
            this.video.currentTime = targetTime;
            setTimeout(() => { this.isApplyingRemote = false; }, 150);
          }
        }
        break;

      case 'source_changed':
      case 'sync:video_url':
        {
          const newSrc = msg.src || msg.url || msg.videoUrl;
          if (newSrc) {
            this.loadSource(newSrc, msg.currentTime || 0);
            if (this.onStateChange) this.onStateChange('source_changed', msg);
          }
        }
        break;

      case 'user_joined':
        if (this.onStateChange) this.onStateChange('user_joined', msg);
        break;

      case 'user_left':
        if (this.onStateChange) this.onStateChange('user_left', msg);
        break;
    }
  }

  loadSource(rawUrl, startTime = 0) {
    if (!rawUrl || !this.video) return;

    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }

    let streamUrl = rawUrl;
    const isHls = rawUrl.includes('.m3u8');

    // Проксирование при необходимости
    if (!rawUrl.startsWith('/proxy/')) {
      if (isHls) {
        streamUrl = `/proxy/hls/master?url=${encodeURIComponent(rawUrl)}`;
      } else if (rawUrl.endsWith('.mp4') || rawUrl.endsWith('.webm') || rawUrl.includes('.mp4?')) {
        streamUrl = `/proxy/video?url=${encodeURIComponent(rawUrl)}`;
      }
    }

    if (isHls || streamUrl.includes('/proxy/hls/')) {
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        this.hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        this.hlsInstance.loadSource(streamUrl);
        this.hlsInstance.attachMedia(this.video);
        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (startTime > 0) this.video.currentTime = startTime;
        });
      } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        this.video.src = streamUrl;
        if (startTime > 0) this.video.currentTime = startTime;
      }
    } else {
      this.video.src = streamUrl;
      if (startTime > 0) this.video.currentTime = startTime;
    }
  }

  applyState(state) {
    if (this.isHost || !state || !this.video) return;

    const remoteTime = state.currentTime !== undefined ? state.currentTime : state.time;
    if (typeof remoteTime === 'number') {
      const diff = Math.abs(this.video.currentTime - remoteTime);
      if (diff > this.syncThreshold) {
        this.video.currentTime = remoteTime;
      }
    }

    const isPaused = state.paused !== undefined ? state.paused : (state.playing === false);
    if (isPaused !== undefined) {
      if (isPaused && !this.video.paused) {
        this.video.pause();
      } else if (!isPaused && this.video.paused) {
        this.video.play().catch(() => {});
      }
    }

    const rate = state.rate || state.playbackRate;
    if (rate && this.video.playbackRate !== rate) {
      this.video.playbackRate = rate;
    }
  }

  setupControls() {
    if (this.isHost) {
      this.video.controls = true;
      this.bindVideoEvents();
    } else {
      this.video.controls = false;
      this.unbindVideoEvents();
    }
  }

  bindVideoEvents() {
    this.unbindVideoEvents();
    this.video.addEventListener('play', this.onPlay);
    this.video.addEventListener('pause', this.onPause);
    this.video.addEventListener('seeked', this.onSeek);
    this.video.addEventListener('ratechange', this.onRateChange);
    this.video.addEventListener('loadedmetadata', this.onLoadedMetadata);
    this.startHeartbeat();
  }

  unbindVideoEvents() {
    this.video.removeEventListener('play', this.onPlay);
    this.video.removeEventListener('pause', this.onPause);
    this.video.removeEventListener('seeked', this.onSeek);
    this.video.removeEventListener('ratechange', this.onRateChange);
    this.video.removeEventListener('loadedmetadata', this.onLoadedMetadata);
    this.stopHeartbeat();
  }

  onPlay = () => {
    if (!this.isHost || this.isApplyingRemote) return;
    this.send({ type: 'play', time: this.video.currentTime });
  };

  onPause = () => {
    if (!this.isHost || this.isApplyingRemote) return;
    this.send({ type: 'pause', time: this.video.currentTime });
  };

  onSeek = () => {
    if (!this.isHost || this.isApplyingRemote) return;
    this.send({ type: 'seek', time: this.video.currentTime });
  };

  onRateChange = () => {
    if (!this.isHost) return;
    this.send({
      type: 'state',
      data: {
        currentTime: this.video.currentTime,
        duration: this.video.duration || 0,
        paused: this.video.paused,
        rate: this.video.playbackRate
      }
    });
  };

  onLoadedMetadata = () => {
    if (!this.isHost) return;
    this.send({
      type: 'state',
      data: {
        currentTime: 0,
        duration: this.video.duration || 0,
        paused: true,
        rate: 1
      }
    });
  };

  startHeartbeat() {
    this.stopHeartbeat();
    this.syncInterval = setInterval(() => {
      if (this.isHost && !this.video.paused) {
        this.send({
          type: 'state',
          data: {
            currentTime: this.video.currentTime,
            duration: this.video.duration || 0,
            paused: this.video.paused,
            rate: this.video.playbackRate
          }
        });
      }
    }, 500);
  }

  stopHeartbeat() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  changeSource(url) {
    if (!this.isHost) return;
    this.loadSource(url, 0);
    this.send({ type: 'change_source', url });
  }

  claimHost() {
    this.send({ type: 'claim_host' });
  }

  destroy() {
    this.unbindVideoEvents();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.hlsInstance) this.hlsInstance.destroy();
    if (this.ws) this.ws.close();
  }

  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Экспорт для Node / Bundlers / Browser globals
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoSyncPlugin;
} else {
  window.VideoSyncPlugin = VideoSyncPlugin;
}
