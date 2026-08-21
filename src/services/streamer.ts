// Streamer Service implementation with graceful fallback
export async function startStreamSession(roomId: string, videoUrl: string, ports: any, startTime: number): Promise<void> {
  console.log(`[Streamer Stub] Stream session requested for room ${roomId}: ${videoUrl}`);
}

export function stopStreamSession(roomId: string): void {
  console.log(`[Streamer Stub] Stop stream session for room ${roomId}`);
}

export function getCurrentTime(roomId: string): number | null {
  return null;
}
