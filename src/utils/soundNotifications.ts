/**
 * Sound Notification System using Web Audio API synthesis and optional audio files.
 * Generates clear, non-intrusive sound alerts across all browsers with zero loading latency.
 */

class SoundNotificationService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private soundCache: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // Check local storage for mute preference
    try {
      const storedMute = localStorage.getItem('sferium_sound_muted');
      if (storedMute !== null) {
        this.isMuted = storedMute === 'true';
      }
    } catch {}
  }

  private initContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('sferium_sound_muted', String(muted));
    } catch {}
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Tries to play from /public/sounds/<name>.mp3; if not available, synthesizes via Web Audio API
   */
  private tryPlayFileOrSynthesize(name: string, fallbackSynth: () => void) {
    if (this.isMuted) return;

    const path = `/sounds/${name}.mp3`;
    let audio = this.soundCache.get(path);
    if (!audio && typeof window !== 'undefined') {
      audio = new Audio(path);
      this.soundCache.set(path, audio);
    }

    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Fallback to Web Audio synthesis
        fallbackSynth();
      });
    } else {
      fallbackSynth();
    }
  }

  /**
   * Sound: New Chat Message (pleasant two-tone bell)
   */
  public playNewMessage() {
    this.tryPlayFileOrSynthesize('message', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5

      osc2.frequency.setValueAtTime(880, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18); // D6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.05);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    });
  }

  /**
   * Sound: User Joined (upward friendly chirp)
   */
  public playUserJoined() {
    this.tryPlayFileOrSynthesize('join', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  /**
   * Sound: User Left (soft descending tone)
   */
  public playUserLeft() {
    this.tryPlayFileOrSynthesize('leave', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.3);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  /**
   * Sound: New Host Assigned (triumphant brass chord)
   */
  public playNewHost() {
    this.tryPlayFileOrSynthesize('host', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C Major
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.05, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + 0.5);
      });
    });
  }

  /**
   * Sound: Moderation Action (Kick, Mute, Warn)
   */
  public playKickOrMute() {
    this.tryPlayFileOrSynthesize('action', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.25);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  /**
   * Sound: AI Completion / Sparkle (pleasant futuristic chime)
   */
  public playAiSuccess() {
    this.tryPlayFileOrSynthesize('sparkle', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const freqs = [659.25, 880, 1174.66, 1760]; // E5, A5, D6, A6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.04, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.3);
      });
    });
  }

  /**
   * Sound: Alert / Warning chime
   */
  public playAlert() {
    this.tryPlayFileOrSynthesize('alert', () => {
      const ctx = this.initContext();
      if (!ctx || this.isMuted) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    });
  }
}

export const soundManager = new SoundNotificationService();
export default soundManager;
