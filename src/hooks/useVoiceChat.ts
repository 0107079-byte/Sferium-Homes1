import { useEffect, useRef, useState } from "react";
import { VoiceClient } from "../voice/voiceClient";
import { RemoteParticipant } from "livekit-client";

export interface UseVoiceChatOptions {
  roomId: string;
  userId: string;
  livekitUrl: string;
  livekitToken: string;
}

export function useVoiceChat(opts: UseVoiceChatOptions) {
  const clientRef = useRef<VoiceClient | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);

  useEffect(() => {
    if (!opts.livekitUrl || !opts.livekitToken) {
      return;
    }

    const client = new VoiceClient({
      url: opts.livekitUrl,
      token: opts.livekitToken,
      roomId: opts.roomId,
      userId: opts.userId,
      onParticipantsChange: (ps) => setParticipants(ps)
    });

    clientRef.current = client;

    client.connect().catch((err) => {
      console.error("[useVoiceChat] Connect failed:", err);
    });

    return () => {
      client.disconnect().catch((err) => {
        console.error("[useVoiceChat] Disconnect error:", err);
      });
    };
  }, [opts.roomId, opts.userId, opts.livekitUrl, opts.livekitToken]);

  const toggleMic = async () => {
    if (!clientRef.current) return;
    try {
      if (micEnabled) {
        await clientRef.current.disableMic();
        setMicEnabled(false);
      } else {
        await clientRef.current.enableMic();
        setMicEnabled(true);
      }
    } catch (err) {
      console.error("[useVoiceChat] toggleMic error:", err);
    }
  };

  return {
    participants,
    micEnabled,
    toggleMic
  };
}

export default useVoiceChat;
