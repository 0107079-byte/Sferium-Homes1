import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import {
  type BroadcastState,
  getBroadcastTime,
} from "../lib/broadcastModel";
import type { VideoAdapter } from "../lib/VideoAdapter";

type BroadcastMessage = {
  type: "BROADCAST_STATE";
  payload: BroadcastState;
};

export function useBroadcastSync(
  room: Room | undefined,
  adapter: VideoAdapter | undefined,
  isHost: boolean,
  initialState: BroadcastState,
) {
  const [state, setState] = useState<BroadcastState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!room) return;

    const handler = (payload: Uint8Array) => {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as BroadcastMessage;
      if (msg.type !== "BROADCAST_STATE") return;
      setState(msg.payload);
      applyToAdapter(msg.payload, adapter);
    };

    room.on("dataReceived", handler);
    return () => {
      room.off("dataReceived", handler);
    };
  }, [room, adapter]);

  function publishState(next: BroadcastState) {
    if (!room || !isHost) return;
    const msg: BroadcastMessage = { type: "BROADCAST_STATE", payload: next };
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(msg)),
      { reliable: true },
    );
    setState(next);
    applyToAdapter(next, adapter);
  }

  return {
    state,
    publishState,
  };
}

function applyToAdapter(state: BroadcastState, adapter?: VideoAdapter) {
  if (!adapter) return;
  const target = getBroadcastTime(state);
  const current = adapter.getCurrentTime();
  const drift = Math.abs(current - target);

  if (drift > 1.0) {
    adapter.seek(target);
  }

  if (state.paused) adapter.pause();
  else adapter.play();
}
