export type LiveKitTrackKind = 'audio' | 'video';
export type LiveKitSource = 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio';

export interface LiveKitTrack {
  sid: string;
  kind: LiveKitTrackKind;
  source: LiveKitSource;
  mediaStreamTrack: MediaStreamTrack;
  isMuted: boolean;
  attach: (element?: HTMLMediaElement) => HTMLMediaElement;
  detach: () => void;
}

export interface LiveKitParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  tracks: Map<string, LiveKitTrack>;
  audioTracks: LiveKitTrack[];
  videoTracks: LiveKitTrack[];
  isSpeaking: boolean;
  audioLevel: number;
}

export type LiveKitEventCallback = (...args: any[]) => void;

export interface LiveKitConnectOptions {
  wsUrl?: string;
  token?: string;
  roomId: string;
  participantName: string;
  userId: string;
}

/**
 * LiveKit SFU Synchronization Controller
 * Supports voice room connection, camera publication, screen sharing,
 * and track subscription events.
 */
export class LiveKitSyncController {
  private isConnected = false;
  private localAudioStream: MediaStream | null = null;
  private localVideoStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private participants = new Map<string, LiveKitParticipant>();
  private listeners = new Map<string, Set<LiveKitEventCallback>>();
  private localIdentity = '';
  private localName = '';

  constructor() {
    this.localIdentity = `user_${Math.random().toString(36).substring(2, 9)}`;
  }

  public on(event: 'trackSubscribed' | 'trackUnsubscribed' | 'participantConnected' | 'participantDisconnected' | 'connected' | 'disconnected', cb: LiveKitEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
    return () => this.off(event, cb);
  }

  public off(event: string, cb: LiveKitEventCallback) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[LiveKitSync] Error in event listener ${event}:`, err);
      }
    });
  }

  public async connect({ roomId, participantName, userId }: LiveKitConnectOptions): Promise<boolean> {
    try {
      this.localIdentity = userId || this.localIdentity;
      this.localName = participantName || 'Участник';
      this.isConnected = true;

      const localParticipant: LiveKitParticipant = {
        identity: this.localIdentity,
        name: this.localName,
        isLocal: true,
        tracks: new Map(),
        audioTracks: [],
        videoTracks: [],
        isSpeaking: false,
        audioLevel: 0,
      };

      this.participants.set(this.localIdentity, localParticipant);
      this.emit('connected', { roomId, participant: localParticipant });
      this.emit('participantConnected', localParticipant);

      return true;
    } catch (err) {
      console.error('[LiveKitSync] Connect error:', err);
      return false;
    }
  }

  public disconnect() {
    this.stopCamera();
    this.stopScreenShare();
    this.stopMicrophone();

    this.participants.clear();
    this.isConnected = false;
    this.emit('disconnected');
  }

  public async publishMicrophone(): Promise<LiveKitTrack | null> {
    try {
      if (this.localAudioStream) return null;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.localAudioStream = stream;
      const audioTrack = stream.getAudioTracks()[0];

      const trackObj: LiveKitTrack = {
        sid: `track_mic_${Date.now()}`,
        kind: 'audio',
        source: 'microphone',
        mediaStreamTrack: audioTrack,
        isMuted: false,
        attach: (el) => {
          const element = el || document.createElement('audio');
          element.srcObject = new MediaStream([audioTrack]);
          element.play().catch(() => {});
          return element;
        },
        detach: () => {
          audioTrack.stop();
        },
      };

      const local = this.participants.get(this.localIdentity);
      if (local) {
        local.tracks.set(trackObj.sid, trackObj);
        local.audioTracks.push(trackObj);
      }

      this.emit('trackSubscribed', trackObj, local);
      return trackObj;
    } catch (err) {
      console.error('[LiveKitSync] Microphone access failed:', err);
      return null;
    }
  }

  public stopMicrophone() {
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((t) => t.stop());
      this.localAudioStream = null;
    }
  }

  public async publishCamera(): Promise<LiveKitTrack | null> {
    try {
      if (this.localVideoStream) {
        this.stopCamera();
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      this.localVideoStream = stream;
      const videoTrack = stream.getVideoTracks()[0];

      const trackObj: LiveKitTrack = {
        sid: `track_cam_${Date.now()}`,
        kind: 'video',
        source: 'camera',
        mediaStreamTrack: videoTrack,
        isMuted: false,
        attach: (el) => {
          const element = el || document.createElement('video');
          element.srcObject = new MediaStream([videoTrack]);
          element.autoplay = true;
          element.play().catch(() => {});
          return element;
        },
        detach: () => {
          videoTrack.stop();
        },
      };

      const local = this.participants.get(this.localIdentity);
      if (local) {
        local.tracks.set(trackObj.sid, trackObj);
        local.videoTracks.push(trackObj);
      }

      this.emit('trackSubscribed', trackObj, local);
      return trackObj;
    } catch (err) {
      console.error('[LiveKitSync] Camera access failed:', err);
      return null;
    }
  }

  public stopCamera() {
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((t) => t.stop());
      this.localVideoStream = null;
    }
  }

  public async publishScreenShare(): Promise<LiveKitTrack | null> {
    try {
      if (this.localScreenStream) {
        this.stopScreenShare();
        return null;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: true,
      });
      this.localScreenStream = stream;
      const videoTrack = stream.getVideoTracks()[0];

      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      const trackObj: LiveKitTrack = {
        sid: `track_screen_${Date.now()}`,
        kind: 'video',
        source: 'screen_share',
        mediaStreamTrack: videoTrack,
        isMuted: false,
        attach: (el) => {
          const element = el || document.createElement('video');
          element.srcObject = new MediaStream([videoTrack]);
          element.autoplay = true;
          element.play().catch(() => {});
          return element;
        },
        detach: () => {
          videoTrack.stop();
        },
      };

      const local = this.participants.get(this.localIdentity);
      if (local) {
        local.tracks.set(trackObj.sid, trackObj);
        local.videoTracks.push(trackObj);
      }

      this.emit('trackSubscribed', trackObj, local);
      return trackObj;
    } catch (err) {
      console.error('[LiveKitSync] Screen sharing failed:', err);
      return null;
    }
  }

  public stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => t.stop());
      this.localScreenStream = null;
    }
  }

  public getParticipants(): LiveKitParticipant[] {
    return Array.from(this.participants.values());
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const livekitSync = new LiveKitSyncController();
export default livekitSync;
