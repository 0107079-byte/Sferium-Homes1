import { socketClient } from '../ws/socket';

export interface PeerConnectionInfo {
  peerId: string;
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

export class MeshRTCManager {
  private peers = new Map<string, PeerConnectionInfo>();
  private localStream: MediaStream | null = null;
  private onRemoteStreamAdded: ((peerId: string, stream: MediaStream) => void) | null = null;
  private onRemoteStreamRemoved: ((peerId: string) => void) | null = null;

  public setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
  }

  public setCallbacks(
    onAdd: (peerId: string, stream: MediaStream) => void,
    onRemove: (peerId: string) => void
  ): void {
    this.onRemoteStreamAdded = onAdd;
    this.onRemoteStreamRemoved = onRemove;
  }

  public async connectToPeer(peerId: string, isInitiator: boolean): Promise<void> {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    const info: PeerConnectionInfo = { peerId, pc };
    this.peers.set(peerId, info);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        info.stream = event.streams[0];
        this.onRemoteStreamAdded?.(peerId, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketClient.send({
          type: 'SIGNAL_ICE',
          targetUserId: peerId,
          signal: event.candidate,
        });
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.send({
        type: 'SIGNAL_OFFER',
        targetUserId: peerId,
        signal: offer,
      });
    }
  }

  public async handleSignal(type: string, fromUserId: string, signal: any): Promise<void> {
    let peer = this.peers.get(fromUserId);
    if (!peer) {
      await this.connectToPeer(fromUserId, false);
      peer = this.peers.get(fromUserId);
    }
    if (!peer) return;

    const pc = peer.pc;
    if (type === 'SIGNAL_OFFER') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketClient.send({
        type: 'SIGNAL_ANSWER',
        targetUserId: fromUserId,
        signal: answer,
      });
    } else if (type === 'SIGNAL_ANSWER') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (type === 'SIGNAL_ICE') {
      await pc.addIceCandidate(new RTCIceCandidate(signal));
    }
  }

  public removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.pc.close();
      this.peers.delete(peerId);
      this.onRemoteStreamRemoved?.(peerId);
    }
  }

  public closeAll(): void {
    for (const [peerId, peer] of this.peers.entries()) {
      peer.pc.close();
      this.onRemoteStreamRemoved?.(peerId);
    }
    this.peers.clear();
  }
}

export const rtcManager = new MeshRTCManager();
