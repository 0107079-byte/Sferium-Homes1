/**
 * WebRTC Mesh Manager (P2P Browser <-> Browser)
 * Direct Peer-to-Peer Voice & Video Chat via WebSocket Signaling
 * Fully token-free, API key-free, and LiveKit-free
 */

export interface PeerAudioState {
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  volume: number; // 0 - 100
  stream?: MediaStream;
}

export interface WebRTCMeshState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  selectedAudioDevice?: string;
  peers: Record<string, PeerAudioState>;
  error?: string | null;
}

type StateListener = (state: WebRTCMeshState) => void;

export class WebRTCMeshManager {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private vadAnimFrameId: number | null = null;
  private silenceTimer: any = null;
  private listeners: Set<StateListener> = new Set();
  private wsSender: ((msg: any) => void) | null = null;

  public roomId: string = '';
  public currentUserId: string = '';
  public currentUserName: string = '';
  public currentUserAvatar: string = '';
  public currentUserColor: string = '';

  private state: WebRTCMeshState = {
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    audioLevel: 0,
    peers: {},
    error: null,
  };

  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  public setWebSocketSender(sender: (msg: any) => void) {
    this.wsSender = sender;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState(): WebRTCMeshState {
    return {
      ...this.state,
      peers: { ...this.state.peers },
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  /**
   * Подключение к голосовой Mesh-комнате
   */
  public async connectMesh(
    roomId: string,
    user: { userId: string; name: string; avatar?: string; color?: string; deviceId?: string }
  ): Promise<boolean> {
    try {
      this.state.isConnecting = true;
      this.state.error = null;
      this.notify();

      this.roomId = roomId;
      this.currentUserId = user.userId;
      this.currentUserName = user.name;
      this.currentUserAvatar = user.avatar || '🍿';
      this.currentUserColor = user.color || '#6366f1';

      // 1. Захват аудио с микрофона пользователя
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (user.deviceId) {
        audioConstraints.deviceId = { exact: user.deviceId };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      this.state.selectedAudioDevice = user.deviceId;
      this.state.isMuted = false;

      // 2. Инициализация VAD (Voice Activity Detection) через Web Audio API
      this.setupVAD(this.localStream);

      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.notify();

      // 3. Отправка сигнала voice:join в WebSocket
      if (this.wsSender) {
        this.wsSender({
          type: 'voice:join',
          roomId,
          userId: user.userId,
          name: user.name,
          avatar: user.avatar,
          color: user.color,
          isMuted: this.state.isMuted,
          isDeafened: this.state.isDeafened,
        });
      }

      return true;
    } catch (err: any) {
      console.error('[WebRTC Mesh] Ошибка подключения:', err);
      this.state.isConnected = false;
      this.state.isConnecting = false;
      this.state.error = err.message || 'Ошибка доступа к микрофону';
      this.notify();
      return false;
    }
  }

  /**
   * Отключение от голосовой комнаты
   */
  public disconnectMesh() {
    // 1. Отправляем сигнал voice:leave
    if (this.wsSender && this.roomId && this.currentUserId) {
      this.wsSender({
        type: 'voice:leave',
        roomId: this.roomId,
        userId: this.currentUserId,
      });
    }

    // 2. Закрываем все PeerConnection
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();

    // 3. Очищаем аудио-элементы
    this.remoteAudioElements.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    this.remoteAudioElements.clear();

    // 4. Останавливаем локальный стрим микрофона
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // 5. Очищаем аудио контекст VAD
    this.cleanupVAD();

    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.isSpeaking = false;
    this.state.audioLevel = 0;
    this.state.peers = {};
    this.notify();
  }

  /**
   * Управление микрофоном (Mute / Unmute)
   */
  public toggleMute(): boolean {
    this.state.isMuted = !this.state.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.state.isMuted;
      });
    }

    if (this.state.isMuted) {
      this.state.isSpeaking = false;
      this.state.audioLevel = 0;
    }

    if (this.wsSender) {
      this.wsSender({
        type: 'voice:state',
        userId: this.currentUserId,
        isMuted: this.state.isMuted,
        isDeafened: this.state.isDeafened,
      });
    }

    this.notify();
    return this.state.isMuted;
  }

  /**
   * Принудительная установка состояния микрофона (Mute / Unmute)
   */
  public setLocalMute(muted: boolean) {
    this.state.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }

    if (muted) {
      this.state.isSpeaking = false;
      this.state.audioLevel = 0;
    }

    if (this.wsSender) {
      this.wsSender({
        type: 'voice:state',
        userId: this.currentUserId,
        isMuted: this.state.isMuted,
        isDeafened: this.state.isDeafened,
      });
    }

    this.notify();
  }

  /**
   * Заглушить всех (Deafen / Un-deafen)
   */
  public toggleDeafen(): boolean {
    this.state.isDeafened = !this.state.isDeafened;
    
    // Глушим воспроизведение удаленных аудио
    this.remoteAudioElements.forEach((el) => {
      el.muted = this.state.isDeafened;
    });

    if (this.wsSender) {
      this.wsSender({
        type: 'voice:state',
        userId: this.currentUserId,
        isMuted: this.state.isMuted,
        isDeafened: this.state.isDeafened,
      });
    }

    this.notify();
    return this.state.isDeafened;
  }

  /**
   * Настройка громкости отдельного пира
   */
  public setPeerVolume(peerUserId: string, volume: number) {
    const clamped = Math.max(0, Math.min(100, volume));
    if (this.state.peers[peerUserId]) {
      this.state.peers[peerUserId].volume = clamped;
    }
    const audioEl = this.remoteAudioElements.get(peerUserId);
    if (audioEl) {
      audioEl.volume = clamped / 100;
    }
    this.notify();
  }

  /**
   * Переключение микрофона на другое аудиоустройство
   */
  public async switchAudioDevice(deviceId: string) {
    try {
      this.state.selectedAudioDevice = deviceId;
      if (!this.state.isConnected) return;

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];

      // Заменяем трек во всех существующих PeerConnection
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender && newAudioTrack) {
          audioSender.replaceTrack(newAudioTrack);
        }
      });

      // Перенастраиваем локальный стрим и VAD
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
      }
      this.localStream = newStream;
      newAudioTrack.enabled = !this.state.isMuted;
      this.setupVAD(newStream);

      this.notify();
    } catch (e) {
      console.error('[WebRTC Mesh] Ошибка смены устройства:', e);
    }
  }

  // ==========================================
  // WEBRTC SIGNALING HANDLERS
  // ==========================================

  /**
   * Получение списка участников в голосовом канале от сервера
   */
  public async handlePeersList(peers: any[]) {
    if (!this.state.isConnected) return;

    for (const peer of peers) {
      if (peer.userId && peer.userId !== this.currentUserId) {
        this.addOrUpdatePeer(peer.userId, {
          userId: peer.userId,
          name: peer.name || 'Участник',
          avatar: peer.avatar || '🍿',
          color: peer.color || '#6366f1',
          isMuted: Boolean(peer.isMuted),
          isDeafened: Boolean(peer.isDeafened),
          isSpeaking: Boolean(peer.isSpeaking),
          volume: 100,
        });

        // Инициируем исходящий P2P Offer к каждому участнику
        await this.createAndSendOffer(peer.userId);
      }
    }
  }

  /**
   * Новый участник вошел в голосовой канал
   */
  public async handleUserJoined(peer: any) {
    if (!this.state.isConnected || !peer.userId || peer.userId === this.currentUserId) return;

    this.addOrUpdatePeer(peer.userId, {
      userId: peer.userId,
      name: peer.name || 'Участник',
      avatar: peer.avatar || '🍿',
      color: peer.color || '#6366f1',
      isMuted: Boolean(peer.isMuted),
      isDeafened: Boolean(peer.isDeafened),
      isSpeaking: false,
      volume: 100,
    });

    // Создаем Offer для нового участника
    await this.createAndSendOffer(peer.userId);
  }

  /**
   * Участник вышел из голосового канала
   */
  public handleUserLeft(userId: string) {
    this.closePeer(userId);
  }

  /**
   * Входящий SDP Offer
   */
  public async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit, metadata?: any) {
    if (!this.state.isConnected || !fromUserId) return;

    if (metadata) {
      this.addOrUpdatePeer(fromUserId, {
        userId: fromUserId,
        name: metadata.name || 'Участник',
        avatar: metadata.avatar || '🍿',
        color: metadata.color || '#6366f1',
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        volume: 100,
      });
    }

    const pc = this.getOrCreatePeerConnection(fromUserId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Добавляем наш локальный аудио-трек в соединение
      if (this.localStream) {
        const senders = pc.getSenders();
        this.localStream.getAudioTracks().forEach((track) => {
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, this.localStream!);
          }
        });
      }

      // Создаем Answer и отправляем обратно
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.wsSender) {
        this.wsSender({
          type: 'voice:answer',
          toUserId: fromUserId,
          answer,
        });
      }
    } catch (err) {
      console.error(`[WebRTC Mesh] Ошибка обработки Offer от ${fromUserId}:`, err);
    }
  }

  /**
   * Входящий SDP Answer
   */
  public async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;

    try {
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error(`[WebRTC Mesh] Ошибка обработки Answer от ${fromUserId}:`, err);
    }
  }

  /**
   * Входящий ICE Candidate
   */
  public async handleIceCandidate(fromUserId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc || !candidate) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[WebRTC Mesh] Ошибка добавления ICE Candidate от ${fromUserId}:`, err);
    }
  }

  /**
   * Обновление состояния удаленного пира (Mute / Deafen)
   */
  public handlePeerState(userId: string, isMuted?: boolean, isDeafened?: boolean) {
    if (this.state.peers[userId]) {
      if (typeof isMuted === 'boolean') this.state.peers[userId].isMuted = isMuted;
      if (typeof isDeafened === 'boolean') this.state.peers[userId].isDeafened = isDeafened;
      this.notify();
    }
  }

  /**
   * Обновление активности голоса пира
   */
  public handlePeerSpeaking(userId: string, isSpeaking: boolean, volume?: number) {
    if (this.state.peers[userId]) {
      this.state.peers[userId].isSpeaking = isSpeaking;
      this.notify();
    }
  }

  // ==========================================
  // ПРИВАТНЫЕ МЕТОДЫ WEBRTC & VAD
  // ==========================================

  private async createAndSendOffer(remoteUserId: string) {
    const pc = this.getOrCreatePeerConnection(remoteUserId);

    try {
      if (this.localStream) {
        const senders = pc.getSenders();
        this.localStream.getAudioTracks().forEach((track) => {
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, this.localStream!);
          }
        });
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      if (this.wsSender) {
        this.wsSender({
          type: 'voice:offer',
          toUserId: remoteUserId,
          offer,
          name: this.currentUserName,
          avatar: this.currentUserAvatar,
          color: this.currentUserColor,
        });
      }
    } catch (err) {
      console.error(`[WebRTC Mesh] Ошибка создания Offer для ${remoteUserId}:`, err);
    }
  }

  private getOrCreatePeerConnection(remoteUserId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(remoteUserId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Отправка кандидатов ICE через WebSocket
    pc.onicecandidate = (event) => {
      if (event.candidate && this.wsSender) {
        this.wsSender({
          type: 'voice:ice_candidate',
          toUserId: remoteUserId,
          candidate: event.candidate,
        });
      }
    };

    // Прием удаленного аудиопотока
    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.remoteStreams.set(remoteUserId, stream);

      // Создаем HTMLAudioElement для воспроизведения
      let audioEl = this.remoteAudioElements.get(remoteUserId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        this.remoteAudioElements.set(remoteUserId, audioEl);
      }

      audioEl.srcObject = stream;
      audioEl.muted = this.state.isDeafened;
      audioEl.volume = (this.state.peers[remoteUserId]?.volume ?? 100) / 100;

      audioEl.play().catch((e) => {
        console.warn('[WebRTC Mesh] Autoplay policy warning:', e);
      });

      if (this.state.peers[remoteUserId]) {
        this.state.peers[remoteUserId].stream = stream;
        this.notify();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc?.iceConnectionState === 'disconnected' || pc?.iceConnectionState === 'failed' || pc?.iceConnectionState === 'closed') {
        this.closePeer(remoteUserId);
      }
    };

    this.peerConnections.set(remoteUserId, pc);
    return pc;
  }

  private addOrUpdatePeer(userId: string, data: PeerAudioState) {
    this.state.peers[userId] = {
      ...(this.state.peers[userId] || {}),
      ...data,
    };
    this.notify();
  }

  private closePeer(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }

    const audioEl = this.remoteAudioElements.get(userId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      this.remoteAudioElements.delete(userId);
    }

    this.remoteStreams.delete(userId);
    delete this.state.peers[userId];
    this.notify();
  }

  /**
   * Настройка VAD (Voice Activity Detection) через AnalyserNode
   */
  private setupVAD(stream: MediaStream) {
    try {
      this.cleanupVAD();

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      this.sourceNode.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const THRESHOLD = 12; // 12% порог громкости

      const loop = () => {
        if (!this.analyser || !this.audioContext) return;

        if (this.state.isMuted) {
          if (this.state.isSpeaking || this.state.audioLevel > 0) {
            this.state.isSpeaking = false;
            this.state.audioLevel = 0;
            this.notify();
            this.broadcastSpeaking(false, 0);
          }
          this.vadAnimFrameId = requestAnimationFrame(loop);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(100, Math.round((rms / 128) * 100));

        this.state.audioLevel = level;

        if (level >= THRESHOLD) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          if (!this.state.isSpeaking) {
            this.state.isSpeaking = true;
            this.notify();
            this.broadcastSpeaking(true, level);
          }
        } else if (this.state.isSpeaking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.state.isSpeaking = false;
            this.silenceTimer = null;
            this.notify();
            this.broadcastSpeaking(false, 0);
          }, 320);
        }

        this.vadAnimFrameId = requestAnimationFrame(loop);
      };

      this.vadAnimFrameId = requestAnimationFrame(loop);
    } catch (e) {
      console.warn('[WebRTC Mesh] Ошибка инициализации VAD:', e);
    }
  }

  private broadcastSpeaking(isSpeaking: boolean, volume: number) {
    if (this.wsSender && this.currentUserId) {
      this.wsSender({
        type: 'voice:active',
        userId: this.currentUserId,
        isSpeaking,
        volume,
        audioLevel: volume,
      });
    }
  }

  private cleanupVAD() {
    if (this.vadAnimFrameId !== null) {
      cancelAnimationFrame(this.vadAnimFrameId);
      this.vadAnimFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

export const rtcManager = new WebRTCMeshManager();
