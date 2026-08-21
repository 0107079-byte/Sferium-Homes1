/**
 * Mobile Haptic & Vibration Feedback Service
 * Uses navigator.vibrate() where supported
 */

class VibrationService {
  private isEnabled: boolean = true;

  constructor() {
    try {
      const stored = localStorage.getItem('sferium_vibration_enabled');
      if (stored !== null) {
        this.isEnabled = stored === 'true';
      }
    } catch {}
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('sferium_vibration_enabled', String(enabled));
    } catch {}
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  private trigger(pattern: number | number[]) {
    if (!this.isEnabled) return;
    if (this.isSupported()) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        console.warn('Vibration failed:', err);
      }
    }
  }

  /**
   * Short gentle pulse for new chat messages
   */
  public vibrateNewMessage() {
    this.trigger(60);
  }

  /**
   * Double pulse for direct user mentions
   */
  public vibrateMention() {
    this.trigger([100, 50, 100]);
  }

  /**
   * Triple prominent pulse for host moderation actions (kick, mute, close room)
   */
  public vibrateHostAction() {
    this.trigger([150, 80, 150, 80, 200]);
  }

  /**
   * Single subtle pulse for user joins/leaves
   */
  public vibrateUserPresence() {
    this.trigger(40);
  }
}

export const vibrationManager = new VibrationService();
export default vibrationManager;
