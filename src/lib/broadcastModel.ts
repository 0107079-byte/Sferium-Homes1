export type VideoSource = "youtube" | "vk" | "rutube";

export type BroadcastState = {
  startedAt: number;
  offset: number;
  paused: boolean;
  source: VideoSource;
};

export function createInitialBroadcast(source: VideoSource): BroadcastState {
  return {
    startedAt: Date.now(),
    offset: 0,
    paused: true,
    source,
  };
}

export function getBroadcastTime(state: BroadcastState): number {
  if (state.paused) return state.offset;
  return state.offset + (Date.now() - state.startedAt) / 1000;
}

export function applyPlay(state: BroadcastState): BroadcastState {
  if (!state.paused) return state;
  return {
    ...state,
    paused: false,
    startedAt: Date.now(),
  };
}

export function applyPause(state: BroadcastState): BroadcastState {
  if (state.paused) return state;
  const now = Date.now();
  const played = (now - state.startedAt) / 1000;
  return {
    ...state,
    paused: true,
    offset: state.offset + played,
    startedAt: now,
  };
}

export function applySeek(state: BroadcastState, newOffset: number): BroadcastState {
  return {
    ...state,
    offset: newOffset,
    startedAt: Date.now(),
  };
}

export function applySourceChange(state: BroadcastState, source: VideoSource): BroadcastState {
  return {
    ...state,
    source,
    offset: 0,
    startedAt: Date.now(),
    paused: true,
  };
}
