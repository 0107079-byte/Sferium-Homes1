/**
 * Voice & Video Manager for Sferium Homes Sync (Powered by WebRTC Mesh)
 * 100% P2P Browser <-> Browser, Zero Tokens, Zero API Keys
 */

import { rtcManager, WebRTCMeshState, PeerAudioState } from './rtc';

export { rtcManager };
export type { WebRTCMeshState, PeerAudioState };

export class VoiceManager {
  public subscribe(listener: (state: WebRTCMeshState) => void): () => void {
    return rtcManager.subscribe(listener);
  }

  public getState(): WebRTCMeshState {
    return rtcManager.getState();
  }

  public async join(
    roomId: string,
    user: { userId: string; name: string; avatar?: string; color?: string; deviceId?: string }
  ): Promise<boolean> {
    return rtcManager.connectMesh(roomId, user);
  }

  public leave() {
    rtcManager.disconnectMesh();
  }

  public toggleMute(): boolean {
    return rtcManager.toggleMute();
  }

  public toggleDeafen(): boolean {
    return rtcManager.toggleDeafen();
  }

  public setPeerVolume(userId: string, volume: number) {
    rtcManager.setPeerVolume(userId, volume);
  }

  public async switchDevice(deviceId: string) {
    await rtcManager.switchAudioDevice(deviceId);
  }
}

export const voiceManager = new VoiceManager();
