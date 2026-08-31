import { Room, VideoInfo } from '../types';

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch('/api/rooms');
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const res = await fetch(`/api/rooms/${roomId}`);
  if (!res.ok) throw new Error('Failed to fetch room');
  return res.json();
}

export async function createRoom(data: { name: string; hostId: string; accessCode?: string; isPrivate?: boolean }): Promise<Room> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

export async function updateRoomVideo(roomId: string, video: VideoInfo): Promise<Room> {
  const res = await fetch(`/api/rooms/${roomId}/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video }),
  });
  if (!res.ok) throw new Error('Failed to update room video');
  return res.json();
}
