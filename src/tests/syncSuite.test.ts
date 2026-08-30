import { MockPlayer, MockWebSocket } from './mockPlayer';
import { SyncController, applySync, DEFAULT_DRIFT_CONFIG } from '../plugins/videoSync';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${message || 'Assertion failed'}`);
    failedCount++;
  }
}

export async function runAllSyncTests(): Promise<boolean> {
  console.log('\n======================================================');
  console.log('🚀 WATCH PARTY SYNC SYSTEM: COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  // ----------------------------------------------------
  // TEST 1: Zone 1 (Deadband < 80ms)
  // ----------------------------------------------------
  console.log('[SUITE 1] Zone 1: Deadband (< 80ms drift)');
  {
    const player = new MockPlayer(100.03, true);
    const res = applySync(
      player,
      100.03, // playerTime (30ms ahead)
      100.00, // hostTime
      true,   // playing
      true,   // hostPlaying
      1.0,    // rate
      1.0,    // hostRate
      Date.now(),
      DEFAULT_DRIFT_CONFIG
    );

    assert(!res.seeked, 'Zone 1 does not trigger seek');
    assert(!res.rateChanged, 'Zone 1 does not alter playback rate');
    assert(Math.abs(res.drift - 0.03) < 0.005, 'Drift calculation is exact (30ms)');
    assert(res.appliedRate === 1.0, 'Applied rate matches host base rate');
  }

  // ----------------------------------------------------
  // TEST 2: Zone 2 (Soft Rate Correction: 80ms - 350ms)
  // ----------------------------------------------------
  console.log('\n[SUITE 2] Zone 2: Soft Rate Correction (80ms - 350ms drift)');
  {
    // Guest is ahead by 150ms -> slow down to 0.95
    const playerAhead = new MockPlayer(100.15, true);
    const resAhead = applySync(
      playerAhead,
      100.15,
      100.00,
      true,
      true,
      1.0,
      1.0,
      Date.now(),
      DEFAULT_DRIFT_CONFIG
    );

    assert(!resAhead.seeked, 'Zone 2 does not hard-seek');
    assert(resAhead.rateChanged, 'Zone 2 changes playback rate');
    assert(Math.abs(resAhead.appliedRate - 0.95) < 0.001, 'Ahead guest slows down to 0.95x');

    // Guest is behind by 150ms -> speed up to 1.05
    const playerBehind = new MockPlayer(99.85, true);
    const resBehind = applySync(
      playerBehind,
      99.85,
      100.00,
      true,
      true,
      1.0,
      1.0,
      Date.now(),
      DEFAULT_DRIFT_CONFIG
    );

    assert(!resBehind.seeked, 'Zone 2 does not hard-seek when behind');
    assert(resBehind.rateChanged, 'Zone 2 speeds up playback rate');
    assert(Math.abs(resBehind.appliedRate - 1.05) < 0.001, 'Behind guest speeds up to 1.05x');
  }

  // ----------------------------------------------------
  // TEST 3: Zone 3 (Hard Seek >= 350ms)
  // ----------------------------------------------------
  console.log('\n[SUITE 3] Zone 3: Hard Seek (>= 350ms drift)');
  {
    const player = new MockPlayer(50.0, true);
    const res = applySync(
      player,
      50.0,
      120.0, // 70 seconds behind!
      true,
      true,
      1.0,
      1.0,
      Date.now(),
      DEFAULT_DRIFT_CONFIG
    );

    assert(res.seeked, 'Zone 3 triggers hard seekTo');
    assert(player.seekHistory.length === 1 && Math.abs(player.seekHistory[0] - 120.0) < 0.001, 'Player seeked directly to host position');
    assert(res.appliedRate === 1.0, 'Applied rate resets to normal host rate after seek');
  }

  // ----------------------------------------------------
  // TEST 4: Monotonic Revision Guard (Rejects stale / out-of-order packets)
  // ----------------------------------------------------
  console.log('\n[SUITE 4] Monotonic Revision Guard');
  {
    const ws = new MockWebSocket();
    const player = new MockPlayer(0, false);
    const guestController = new SyncController(player, ws, false, 'TEST_ROOM');
    guestController.start();

    // Packet 1: Revision 10 (Position 100s)
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM',
      position: 100,
      playing: true,
      revision: 10,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(guestController.lastAppliedRevision === 10, 'Packet with rev=10 accepted');
    assert(player.seekHistory.length === 1 && Math.abs(player.seekHistory[0] - 100) < 0.1, 'Player updated to rev=10 position');

    // Packet 2: Stale / Out-of-order Revision 8 (Position 50s)
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM',
      position: 50,
      playing: true,
      revision: 8,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(guestController.lastAppliedRevision === 10, 'Out-of-order rev=8 correctly rejected');
    assert(player.seekHistory.length === 1, 'Stale packet position 50s was NOT applied to player');

    // Packet 3: Duplicate Revision 10 (Position 100s)
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM',
      position: 100,
      playing: true,
      revision: 10,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(guestController.lastAppliedRevision === 10, 'Duplicate rev=10 safely ignored without state change');

    // Packet 4: Valid newer Revision 11 (Position 110s)
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM',
      position: 110,
      playing: true,
      revision: 11,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(guestController.lastAppliedRevision === 11, 'Newer rev=11 accepted');
    guestController.stop();
  }

  // ----------------------------------------------------
  // TEST 5: Latency Compensation
  // ----------------------------------------------------
  console.log('\n[SUITE 5] Network Latency Transit Compensation');
  {
    const player = new MockPlayer(0, true);
    const now = Date.now();
    const packetSentTime = now - 200; // 200ms in transit

    const res = applySync(
      player,
      50.0,
      50.0, // host time when sent
      true,
      true,
      1.0,
      1.0,
      packetSentTime,
      DEFAULT_DRIFT_CONFIG
    );

    // Corrected host time should advance by 0.200s
    assert(Math.abs(res.correctedHostTime - 50.2) < 0.005, 'Latency compensated: hostTime advanced by 200ms');
    assert(Math.abs(res.drift - 0.2) < 0.005, 'Drift accounts for transit delay');
  }

  // ----------------------------------------------------
  // TEST 6: Hysteresis (Oscillation Prevention)
  // ----------------------------------------------------
  console.log('\n[SUITE 6] Hysteresis Boundary Test (No oscillating state)');
  {
    const ws = new MockWebSocket();
    const player = new MockPlayer(100.0, true);
    const controller = new SyncController(player, ws, false, 'TEST_ROOM', {
      ...DEFAULT_DRIFT_CONFIG,
      deadbandSeconds: 0.08,
      deadbandExitSeconds: 0.04,
    });
    controller.start();

    // 1. Initial State: rev=1, host is at 100.10s (guest is 100ms behind -> triggers Zone 2 soft speedup)
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM',
      position: 100.10,
      playing: true,
      rate: 1.0,
      revision: 1,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(Math.abs(player.playbackRate - 1.05) < 0.01, 'Enters soft rate correction (1.05x) when drift is 100ms');

    // 2. Drift decreases to 60ms (inside deadband < 80ms, but ABOVE deadbandExit 40ms)
    player.currentTime = 100.04; // 60ms behind host at 100.10
    const align2 = controller.alignGuestWithHost();
    assert(Math.abs((align2?.appliedRate || 0) - 1.05) < 0.01, 'Hysteresis keeps 1.05x active at 60ms to finish converging');

    // 3. Drift drops to 30ms (BELOW deadbandExit 40ms) -> exits soft correction back to 1.0x
    player.currentTime = 100.07; // 30ms behind host at 100.10
    const align3 = controller.alignGuestWithHost();
    assert(Math.abs((align3?.appliedRate || 0) - 1.0) < 0.01, 'Exits soft correction to 1.0x when drift drops under 40ms exit threshold');
    assert(Math.abs(player.playbackRate - 1.0) < 0.01, 'Player rate successfully restored to 1.0x');

    controller.stop();
  }

  // ----------------------------------------------------
  // TEST 7: Hard Seek Cooldown Protection
  // ----------------------------------------------------
  console.log('\n[SUITE 7] Hard Seek Cooldown Protection (Anti-Seek Storm)');
  {
    const ws = new MockWebSocket();
    const player = new MockPlayer(0, true);
    const controller = new SyncController(player, ws, false, 'TEST_ROOM', {
      ...DEFAULT_DRIFT_CONFIG,
      seekCooldownMs: 400,
    });
    controller.start();

    // First hard seek
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM',
      position: 500,
      playing: true,
      revision: 1,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(player.seekHistory.length === 1, 'First seekTo executed');

    // Immediate second sync check within cooldown window
    player.currentTime = 0; // Simulate player lag before seek completes
    controller.alignGuestWithHost();
    assert(player.seekHistory.length === 1, 'Immediate repeated seek suppressed by cooldown');

    controller.stop();
  }

  // ----------------------------------------------------
  // TEST 8: Reconnection and Initial Catch-Up Sync
  // ----------------------------------------------------
  console.log('\n[SUITE 8] Reconnect Flow');
  {
    const ws = new MockWebSocket();
    const player = new MockPlayer(0, false);
    const controller = new SyncController(player, ws, false, 'ROOM_XYZ');
    controller.start();

    // Client requests sync
    controller.requestServerSync();
    assert(ws.sentMessages.some((m) => m.type === 'SYNC_REQUEST' && m.roomId === 'ROOM_XYZ'), 'SYNC_REQUEST message sent to server on connect');

    // Server responds with SYNC_STATE
    ws.receive({
      type: 'SYNC_STATE',
      roomId: 'ROOM_XYZ',
      position: 125.5,
      playing: true,
      rate: 1.0,
      revision: 42,
      serverTime: Date.now(),
      updatedAt: Date.now(),
    });

    assert(controller.lastAppliedRevision === 42, 'Guest caught up to current room revision');
    assert(player.playing === true, 'Guest caught up to playing state');
    assert(player.seekHistory.includes(125.5), 'Guest seeked to authoritative room timestamp');

    controller.stop();
  }

  // ----------------------------------------------------
  // TEST 9: Multi-Client Timeline Simulation
  // (1 Host, 3 Guests with 30ms, 120ms, and 2000ms drifts)
  // ----------------------------------------------------
  console.log('\n[SUITE 9] Multi-Client Simulation (Host + 3 Guests)');
  {
    const hostWs = new MockWebSocket();
    const g1Ws = new MockWebSocket();
    const g2Ws = new MockWebSocket();
    const g3Ws = new MockWebSocket();

    const hostPlayer = new MockPlayer(200.0, true);
    const g1Player = new MockPlayer(200.02, true); // Zone 1 (20ms drift)
    const g2Player = new MockPlayer(199.88, true); // Zone 2 (120ms drift)
    const g3Player = new MockPlayer(50.0, true);   // Zone 3 (150s drift)

    const host = new SyncController(hostPlayer, hostWs, true, 'SIM_ROOM');
    const g1 = new SyncController(g1Player, g1Ws, false, 'SIM_ROOM');
    const g2 = new SyncController(g2Player, g2Ws, false, 'SIM_ROOM');
    const g3 = new SyncController(g3Player, g3Ws, false, 'SIM_ROOM');

    host.start();
    g1.start();
    g2.start();
    g3.start();

    // Host sends SYNC_STATE broadcast
    const now = Date.now();
    const broadcastMsg = {
      type: 'SYNC_STATE',
      roomId: 'SIM_ROOM',
      position: 200.0,
      playing: true,
      rate: 1.0,
      revision: 100,
      serverTime: now,
      updatedAt: now,
    };

    g1Ws.receive(broadcastMsg);
    g2Ws.receive(broadcastMsg);
    g3Ws.receive(broadcastMsg);

    // Verify Guest 1 (Zone 1): Perfect sync
    assert(g1Player.seekHistory.length === 0, 'Guest 1 (20ms drift) remains in Zone 1 deadband with no seek');
    assert(g1Player.playbackRate === 1.0, 'Guest 1 rate remains 1.0x');

    // Verify Guest 2 (Zone 2): Soft rate speedup
    assert(g2Player.seekHistory.length === 0, 'Guest 2 (120ms drift) does not seek');
    assert(Math.abs(g2Player.playbackRate - 1.05) < 0.01, 'Guest 2 speeds up to 1.05x smoothly');

    // Verify Guest 3 (Zone 3): Immediate hard seek
    assert(g3Player.seekHistory.length === 1 && Math.abs(g3Player.seekHistory[0] - 200.0) < 0.1, 'Guest 3 (150s drift) immediately seeks to 200s');

    // Simulate 3 seconds of playback: G2 catches up smoothly
    for (let t = 0; t < 3; t++) {
      hostPlayer.tick(1.0);
      g1Player.tick(1.0);
      g2Player.tick(1.0); // ticks at 1.05x rate = +1.05s per second!
      g3Player.tick(1.0);
    }

    const hostPos = hostPlayer.getCurrentTime(); // 203.0
    const g2Pos = g2Player.getCurrentTime();     // 199.88 + 3.15 = 203.03
    const driftG2 = Math.abs(g2Pos - hostPos);   // 0.03s = 30ms (converged into Zone 1!)

    assert(driftG2 <= 0.04, `Guest 2 converged from 120ms drift to ${Math.round(driftG2 * 1000)}ms without a single seek discontinuity`);

    host.stop();
    g1.stop();
    g2.stop();
    g3.stop();
  }

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  return failedCount === 0;
}
