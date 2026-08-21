import { Router } from 'express';
import { listRooms, createRoom, deleteRoom, verifyRoomPassword, rooms } from '../modules/rooms';
import { CreateRoomPayload } from '../../src/types';

export const roomsRouter = Router();

// GET /api/rooms - List active public rooms (and optionally user's private rooms)
roomsRouter.get('/', async (req, res) => {
  try {
    const tag = req.query.tag as string;
    const search = req.query.search as string;
    const hostId = req.query.hostId as string;
    const includePrivate = req.query.includePrivate === 'true';

    const roomList = await listRooms({
      tag,
      search,
      hostId,
      includePrivate,
    });

    res.json({
      success: true,
      rooms: roomList,
      total: roomList.length,
    });
  } catch (err: any) {
    console.error('[API /api/rooms] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка получения списка комнат' });
  }
});

// GET /api/rooms/:roomId - Get detailed info about a specific room
roomsRouter.get('/:roomId', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({ success: false, error: 'Комната не найдена' });
  }

  res.json({
    success: true,
    room: {
      roomId: room.roomId,
      name: room.name,
      description: room.description,
      isPrivate: room.isPrivate,
      hasPassword: Boolean(room.password),
      tags: room.tags,
      hostId: room.hostId,
      hostName: room.hostName,
      membersCount: Object.keys(room.members || {}).length,
      videoUrl: room.videoUrl,
      provider: room.provider,
      playing: room.playing,
    },
  });
});

// POST /api/rooms - Create a new room
roomsRouter.post('/', async (req, res) => {
  try {
    const payload: CreateRoomPayload = req.body;

    if (!payload.name || !payload.name.trim()) {
      return res.status(400).json({ success: false, error: 'Название комнаты обязательно' });
    }

    if (!payload.hostId || !payload.hostName) {
      return res.status(400).json({ success: false, error: 'Данные создателя обязательны' });
    }

    const created = await createRoom(payload);

    res.status(201).json({
      success: true,
      room: created,
      roomId: created.roomId,
    });
  } catch (err: any) {
    console.error('[API POST /api/rooms] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка создания комнаты' });
  }
});

// DELETE /api/rooms/:roomId - Delete room
roomsRouter.delete('/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const requesterUserId = (req.headers['x-user-id'] || req.query.userId || req.body?.userId) as string;

    const result = await deleteRoom(roomId, requesterUserId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, message: `Комната #${roomId} успешно удалена` });
  } catch (err: any) {
    console.error('[API DELETE /api/rooms] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка удаления комнаты' });
  }
});

// POST /api/rooms/:roomId/verify - Verify password for private room
roomsRouter.post('/:roomId/verify', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const password = req.body?.password || '';

  const isValid = verifyRoomPassword(roomId, password);
  if (!isValid) {
    return res.status(403).json({ success: false, error: 'Неверный пароль от комнаты' });
  }

  res.json({ success: true, message: 'Пароль верный' });
});
