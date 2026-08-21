import React from "react";
import { useVoiceChat } from "../hooks/useVoiceChat";

export interface VoicePanelProps {
  roomId: string;
  currentUserId: string;
  livekitUrl: string;
  livekitToken: string;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  roomId,
  currentUserId,
  livekitUrl,
  livekitToken
}) => {
  const { participants, micEnabled, toggleMic } = useVoiceChat({
    roomId,
    userId: currentUserId,
    livekitUrl,
    livekitToken
  });

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-950/80 border border-zinc-850 rounded-2xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-200">Голосовой чат</span>
        <button
          type="button"
          onClick={toggleMic}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            micEnabled ? "bg-green-600 text-white hover:bg-green-700" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          {micEnabled ? "Микрофон включен" : "Микрофон выключен"}
        </button>
      </div>

      <div className="text-[11px] text-zinc-400">
        Участники в голосе: {participants.length}
      </div>
    </div>
  );
};

export default VoicePanel;
