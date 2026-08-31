import { socketClient } from '../ws/socket';

export class VoiceChatManager {
  private localStream: MediaStream | null = null;
  private isMuted = false;
  private isDeafened = false;
  private isCameraOn = false;
  private onSpeakingChange: ((isSpeaking: boolean) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: any = null;

  public async startMicrophone(): Promise<MediaStream | null> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.isCameraOn,
      });
      this.setupVAD(this.localStream);
      return this.localStream;
    } catch (err) {
      console.warn('[VoiceChat] Media access denied:', err);
      return null;
    }
  }

  public async toggleCamera(): Promise<boolean> {
    this.isCameraOn = !this.isCameraOn;
    if (this.localStream) {
      // Reacquire with video
      this.localStream.getTracks().forEach(t => t.stop());
      await this.startMicrophone();
    }
    return this.isCameraOn;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;
    return this.isDeafened;
  }

  public setSpeakingCallback(cb: (isSpeaking: boolean) => void): void {
    this.onSpeakingChange = cb;
  }

  private setupVAD(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkVolume = () => {
        if (!this.analyser || this.isMuted) {
          if (wasSpeaking) {
            wasSpeaking = false;
            this.onSpeakingChange?.(false);
          }
          this.animationFrame = requestAnimationFrame(checkVolume);
          return;
        }

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const isSpeaking = average > 25;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.onSpeakingChange?.(isSpeaking);
        }

        this.animationFrame = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('VAD init error:', e);
    }
  }

  public stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }
}

export const voiceManager = new VoiceChatManager();
