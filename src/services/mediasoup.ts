// SFU Mediasoup Service implementation with graceful fallback
export function isMediasoupSupported(): boolean {
  return false;
}

export async function createSFURoom(roomId: string): Promise<any> {
  console.log(`[SFU Mediasoup Stub] Room #${roomId} SFU requested (disabled or not installed).`);
  return null;
}

export function getSFURoom(roomId: string): any {
  return null;
}

export function deleteSFURoom(roomId: string): void {
  console.log(`[SFU Mediasoup Stub] Room #${roomId} SFU delete requested.`);
}

export async function createWebRtcTransport(roomId: string): Promise<any> {
  throw new Error("Mediasoup is not installed or enabled on this host.");
}

export async function createPlainTransports(roomId: string): Promise<any> {
  throw new Error("Mediasoup is not installed or enabled on this host.");
}
