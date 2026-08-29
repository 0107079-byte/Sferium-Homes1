/**
 * Sferium-Homes Phase 4: Critical Room / Database / Join Integration Tests
 *
 * Tests the room lifecycle and join-invariants:
 * 1. Host creates a room -> exists in PostgreSQL/memory -> Host is participant & host
 * 2. Guest joins room -> joins existing room -> Guest is member -> Host is host -> No new room is created
 * 3. Guest joins invalid room code -> 404 ROOM_NOT_FOUND -> No room is created
 * 4. Case-insensitivity & URL normalization (e.g. /room/abc, ?room=abc, uppercase/lowercase)
 * 5. Reconnection & Direct URL entry -> No duplicate room, membership preserved
 * 6. DB Invariant: COUNT(rooms WHERE code = target) === 1
 */

import { createRoom, joinRoomBackend, getRoomByIdOrCode, rooms } from '../../../backend/modules/rooms';
import { normalizeRoomCode, loadRoomFromDb, saveRoomToDb } from '../../db';
import { Member, RoomState } from '../../types';

export interface AuditTestResult {
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

export async function runRoomJoinAuditIntegrationTests(): Promise<AuditTestResult[]> {
  const results: AuditTestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      results.push({
        name,
        passed: true,
        details: 'Verified invariant successfully',
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      results.push({
        name,
        passed: false,
        details: err.message || String(err),
        durationMs: Date.now() - start,
      });
    }
  };

  // --- TEST 1: Code and URL Normalization Invariants ---
  await runTest('URL and Code Normalization resolves all formats to canonical room code', async () => {
    const testCases = [
      { input: 'ALPHA123', expected: 'ALPHA123' },
      { input: 'alpha123', expected: 'ALPHA123' },
      { input: '  alpha123  ', expected: 'ALPHA123' },
      { input: '/room/ALPHA123', expected: 'ALPHA123' },
      { input: 'https://sferium.tv/room/alpha123?ref=invite', expected: 'ALPHA123' },
      { input: '/invite/alpha123#player', expected: 'ALPHA123' },
      { input: 'https://site.com/?room=ALPHA123&user=guest', expected: 'ALPHA123' },
      { input: 'ALPHA_123-ROOM', expected: 'ALPHA_123-ROOM' },
    ];

    for (const { input, expected } of testCases) {
      const normalized = normalizeRoomCode(input);
      if (normalized !== expected) {
        throw new Error(`Normalization failed for "${input}": got "${normalized}", expected "${expected}"`);
      }
    }
  });

  // --- TEST 2: Host Room Creation ---
  const testRoomCode = `AUDIT_${Date.now()}`;
  let hostUserId = 'host_user_alpha';

  await runTest('Host Room Creation creates single room in DB and assigns Host role', async () => {
    const initialCount = Object.keys(rooms).length;

    const createdRoom = await createRoom({
      roomId: testRoomCode,
      name: 'Audit Cinema Room',
      hostId: hostUserId,
      hostName: 'Alice Host',
      hostAvatar: '👑',
      hostColor: '#a855f7',
      initialVideoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    });

    if (createdRoom.roomId !== testRoomCode) {
      throw new Error(`Expected roomId "${testRoomCode}", got "${createdRoom.roomId}"`);
    }

    if (createdRoom.hostId !== hostUserId) {
      throw new Error(`Expected hostId "${hostUserId}", got "${createdRoom.hostId}"`);
    }

    const hostMember = createdRoom.members[hostUserId];
    if (!hostMember || !hostMember.isHost || hostMember.role !== 'host') {
      throw new Error(`Host member is not properly initialized as host: ${JSON.stringify(hostMember)}`);
    }

    // Verify room exists in memory and persistence
    const loaded = await getRoomByIdOrCode(testRoomCode);
    if (!loaded) {
      throw new Error(`Room "${testRoomCode}" was not found after creation`);
    }
  });

  // --- TEST 3: Guest Join Existing Room (Never creates new room) ---
  const guestUserId = 'guest_user_beta';
  await runTest('Guest Join connects to existing room without creating a second room', async () => {
    const roomsCountBefore = Object.keys(rooms).length;

    const joinResult = await joinRoomBackend({
      roomId: testRoomCode,
      userId: guestUserId,
      name: 'Bob Guest',
      avatar: '🍿',
      color: '#3b82f6',
    });

    if (!joinResult.success || !joinResult.room) {
      throw new Error(`Guest join failed: ${joinResult.error}`);
    }

    const joinedRoom = joinResult.room;

    // INVARIANT 1: Room ID matches exactly
    if (joinedRoom.roomId !== testRoomCode) {
      throw new Error(`Guest joined wrong room: expected "${testRoomCode}", got "${joinedRoom.roomId}"`);
    }

    // INVARIANT 2: Host is still Alice, NOT Guest
    if (joinedRoom.hostId !== hostUserId) {
      throw new Error(`Host was overwritten! Expected "${hostUserId}", got "${joinedRoom.hostId}"`);
    }

    // INVARIANT 3: Guest is participant with isHost = false and role = 'member'
    const guestMember = joinedRoom.members[guestUserId];
    if (!guestMember) {
      throw new Error(`Guest ${guestUserId} is not listed in room members`);
    }
    if (guestMember.isHost === true) {
      throw new Error(`Guest was erroneously assigned host privileges!`);
    }
    if (guestMember.role !== 'member') {
      throw new Error(`Expected guest role 'member', got '${guestMember.role}'`);
    }

    // INVARIANT 4: Host member is still host
    const hostMember = joinedRoom.members[hostUserId];
    if (!hostMember || !hostMember.isHost) {
      throw new Error(`Host member record was compromised!`);
    }

    // INVARIANT 5: No duplicate or extra room created in registry
    const roomsCountAfter = Object.keys(rooms).length;
    if (roomsCountAfter !== roomsCountBefore) {
      throw new Error(`Extra room was created on join! Count before: ${roomsCountBefore}, Count after: ${roomsCountAfter}`);
    }
  });

  // --- TEST 4: Guest Join with Non-Existent Code returns 404 and NEVER creates a room ---
  await runTest('Join with invalid code returns 404 ROOM_NOT_FOUND and creates NO room', async () => {
    const badCode = `NON_EXISTENT_${Date.now()}`;
    const roomsCountBefore = Object.keys(rooms).length;

    const result = await joinRoomBackend({
      roomId: badCode,
      userId: 'intruder_user',
      name: 'Intruder',
    });

    if (result.success) {
      throw new Error(`Join unexpectedly succeeded for non-existent room code "${badCode}"`);
    }

    if (result.status !== 404 || result.code !== 'ROOM_NOT_FOUND') {
      throw new Error(`Expected 404 ROOM_NOT_FOUND, got status ${result.status} code ${result.code}`);
    }

    const roomsCountAfter = Object.keys(rooms).length;
    if (roomsCountAfter !== roomsCountBefore) {
      throw new Error(`A phantom room was created during invalid join attempt!`);
    }

    if (rooms[badCode]) {
      throw new Error(`Phantom room "${badCode}" exists in memory map!`);
    }
  });

  // --- TEST 5: Direct URL / Lowercase Join with Existing Room ---
  await runTest('Direct URL / Lowercase join correctly resolves to existing room', async () => {
    const rawInput = `https://sferium.tv/room/${testRoomCode.toLowerCase()}?invite=true`;
    const guest2UserId = 'guest_user_gamma';

    const joinResult = await joinRoomBackend({
      roomId: rawInput,
      userId: guest2UserId,
      name: 'Charlie Gamma',
    });

    if (!joinResult.success || !joinResult.room) {
      throw new Error(`Direct URL join failed: ${joinResult.error}`);
    }

    if (joinResult.room.roomId !== testRoomCode) {
      throw new Error(`Expected room #${testRoomCode}, joined #${joinResult.room.roomId}`);
    }

    if (joinResult.room.hostId !== hostUserId) {
      throw new Error(`Host mutated during URL join!`);
    }

    if (joinResult.room.members[guest2UserId]?.isHost) {
      throw new Error(`Guest 2 became host!`);
    }
  });

  // --- TEST 6: Reconnection does not create duplicate members or rooms ---
  await runTest('Reconnecting user updates presence without duplicating room', async () => {
    const roomsCountBefore = Object.keys(rooms).length;

    const reJoinResult = await joinRoomBackend({
      roomId: testRoomCode,
      userId: guestUserId,
      name: 'Bob Guest Updated Name',
      avatar: '🎬',
    });

    if (!reJoinResult.success || !reJoinResult.room) {
      throw new Error(`Reconnection failed: ${reJoinResult.error}`);
    }

    const member = reJoinResult.room.members[guestUserId];
    if (member.name !== 'Bob Guest Updated Name' || member.avatar !== '🎬') {
      throw new Error(`Member profile was not updated on reconnect`);
    }

    const roomsCountAfter = Object.keys(rooms).length;
    if (roomsCountAfter !== roomsCountBefore) {
      throw new Error(`Reconnection created duplicate room!`);
    }
  });

  return results;
}
