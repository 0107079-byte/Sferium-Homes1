import { Room, User, VideoInfo } from '../../src/types';

class RoomManager {
  private rooms = new Map<string, Room>();

  constructor() {
    // Seed a default demo room
    this.createRoom({
      id: 'demo-room',
      name: 'Уютная Гостиная Sferium',
      hostId: 'host-1',
      currentVideo: {
        provider: 'youtube',
        id: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
      },
      playbackState: {
        position: 0,
        playing: false,
        playbackRate: 1.0,
        revision: 1,
        updatedAt: Date.now(),
      },
      users: [],
      createdAt: Date.now(),
    });
  }

  public createRoom(room: Room): Room {
    this.rooms.set(room.id, room);
    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public listRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public addUser(roomId: string, user: User): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const existingIdx = room.users.findIndex((u) => u.id === user.id);
    if (existingIdx >= 0) {
      room.users[existingIdx] = { ...room.users[existingIdx], ...user };
    } else {
      room.users.push(user);
    }
    return room;
  }

  public removeUser(roomId: string, userId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.users = room.users.filter((u) => u.id !== userId);
    return room;
  }

  public setVideo(roomId: string, video: VideoInfo): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.currentVideo = video;
    room.playbackState = {
      position: 0,
      playing: false,
      playbackRate: 1.0,
      revision: room.playbackState.revision + 1,
      updatedAt: Date.now(),
    };
    return room;
  }
}

export const roomManager = new RoomManager();
