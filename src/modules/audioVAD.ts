/**
 * Web Audio API Voice Activity Detector (VAD) & Audio Level Analyzer
 * Discord-style real-time voice detection with RMS calculation and hysteresis
 */

export interface VADOptions {
  fftSize?: number;
  minDecibels?: number;
  maxDecibels?: number;
  smoothingTimeConstant?: number;
  speakingThreshold?: number; // 0 to 100
  silenceDelayMs?: number; // ms to keep speaking state active after silence (hangover time)
  onVoiceActiveChange?: (isSpeaking: boolean, volume: number) => void;
  onVolumeChange?: (volume: number) => void;
}

export class AudioVADManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isSpeaking: boolean = false;
  private currentVolume: number = 0;
  private silenceTimer: any = null;
  private isDestroyed: boolean = false;
  private isMuted: boolean = false;

  private options: Required<VADOptions> = {
    fftSize: 256,
    minDecibels: -90,
    maxDecibels: -10,
    smoothingTimeConstant: 0.4,
    speakingThreshold: 12, // 12% volume threshold
    silenceDelayMs: 380, // Discord-like silence delay
    onVoiceActiveChange: () => {},
    onVolumeChange: () => {},
  };

  constructor(options?: VADOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * Initialize with an existing MediaStream or audio track
   */
  public async initializeWithStream(stream: MediaStream): Promise<boolean> {
    try {
      this.cleanup();
      this.isDestroyed = false;
      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[AudioVAD] Web Audio API is not supported in this browser.');
        return false;
      }

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.options.fftSize;
      this.analyser.minDecibels = this.options.minDecibels;
      this.analyser.maxDecibels = this.options.maxDecibels;
      this.analyser.smoothingTimeConstant = this.options.smoothingTimeConstant;

      this.sourceNode.connect(this.analyser);

      this.startAnalysisLoop();
      return true;
    } catch (err) {
      console.error('[AudioVAD] Initialization error:', err);
      return false;
    }
  }

  /**
   * Request microphone stream automatically and initialize VAD
   */
  public async initializeWithMicrophone(audioConstraints?: MediaTrackConstraints): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints || {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const success = await this.initializeWithStream(stream);
      return success ? stream : null;
    } catch (err) {
      console.error('[AudioVAD] Microphone access error:', err);
      return null;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      this.currentVolume = 0;
      this.options.onVoiceActiveChange(false, 0);
      this.options.onVolumeChange(0);
    }
  }

  public setThreshold(threshold: number) {
    this.options.speakingThreshold = Math.max(1, Math.min(100, threshold));
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getCurrentVolume(): number {
    return this.currentVolume;
  }

  /**
   * Real-time analysis loop calculating RMS and Voice Activity
   */
  private startAnalysisLoop() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkAudio = () => {
      if (this.isDestroyed || !this.analyser) return;

      if (this.isMuted) {
        if (this.currentVolume !== 0 || this.isSpeaking) {
          this.currentVolume = 0;
          this.isSpeaking = false;
          this.options.onVoiceActiveChange(false, 0);
          this.options.onVolumeChange(0);
        }
        this.animationFrameId = requestAnimationFrame(checkAudio);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // 1. Calculate Average / RMS Volume (0 to 100)
      let sum = 0;
      let nonZeroCount = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        sum += val * val;
        if (val > 10) nonZeroCount++;
      }

      const rms = Math.sqrt(sum / dataArray.length);
      // Scale non-linearly for natural human perception of loudness
      const normalizedVolume = Math.min(100, Math.round((rms / 128) * 100));
      this.currentVolume = normalizedVolume;
      this.options.onVolumeChange(normalizedVolume);

      // 2. Voice Activity Detection (VAD) with Hysteresis
      const exceedsThreshold = normalizedVolume >= this.options.speakingThreshold;

      if (exceedsThreshold) {
        // Clear any pending silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.options.onVoiceActiveChange(true, normalizedVolume);
        }
      } else if (this.isSpeaking && !this.silenceTimer) {
        // Human voice has natural pauses between syllables; wait silenceDelayMs before turning off
        this.silenceTimer = setTimeout(() => {
          if (!this.isDestroyed) {
            this.isSpeaking = false;
            this.options.onVoiceActiveChange(false, 0);
          }
          this.silenceTimer = null;
        }, this.options.silenceDelayMs);
      }

      this.animationFrameId = requestAnimationFrame(checkAudio);
    };

    this.animationFrameId = requestAnimationFrame(checkAudio);
  }

  /**
   * Cleanup audio nodes and context
   */
  public cleanup() {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    try {
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
    } catch (e) {
      console.warn('[AudioVAD] Cleanup warning:', e);
    }

    this.isSpeaking = false;
    this.currentVolume = 0;
  }
}
