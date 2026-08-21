import { Room, RoomEvent, RemoteParticipant, LocalParticipant } from "livekit-client";

export interface VoiceClientOptions {
  url: string;          // LiveKit URL
  token: string;        // LiveKit access token
  roomId: string;
  userId: string;
  onParticipantsChange?: (participants: RemoteParticipant[]) => void;
}

export class VoiceClient {
  room: Room | null = null;
  opts: VoiceClientOptions;

  constructor(opts: VoiceClientOptions) {
    this.opts = opts;
  }

  async connect() {
    if (!this.opts.url || !this.opts.token) {
      console.warn("[VoiceClient] LiveKit URL or token is missing, cannot connect");
      return;
    }

    try {
      const room = new Room();

      room.on(RoomEvent.ParticipantConnected, () => {
        this.emitParticipants();
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        this.emitParticipants();
      });

      room.on(RoomEvent.TrackSubscribed, () => {
        this.emitParticipants();
      });

      room.on(RoomEvent.TrackUnsubscribed, () => {
        this.emitParticipants();
      });

      await room.connect(this.opts.url, this.opts.token, {
        autoSubscribe: true,
      });
      this.room = room;
      this.emitParticipants();
    } catch (err) {
      console.error("[VoiceClient] Error connecting to LiveKit room:", err);
      throw err;
    }
  }

  emitParticipants() {
    if (!this.room || !this.opts.onParticipantsChange) return;
    const participants = Array.from(this.room.remoteParticipants.values());
    this.opts.onParticipantsChange(participants);
  }

  getLocalParticipant(): LocalParticipant | null {
    return this.room?.localParticipant ?? null;
  }

  async enableMic() {
    const lp = this.getLocalParticipant();
    if (!lp) return;
    await lp.setMicrophoneEnabled(true);
  }

  async disableMic() {
    const lp = this.getLocalParticipant();
    if (!lp) return;
    await lp.setMicrophoneEnabled(false);
  }

  async disconnect() {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
  }
}

export default VoiceClient;
