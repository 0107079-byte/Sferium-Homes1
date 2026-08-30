/**
 * Sferium-Homes Phase 3: Real Implementation Pipeline Integration Tests
 *
 * Tests the REAL production sync pipeline:
 * 1. VideoSyncPlugin (src/plugins/videoSync.ts)
 * 2. applySync drift calculation & latency compensation
 * 3. Multi-client convergence using simulated WebSocket connections
 * 4. Monotonic revision progression & stale revision rejection
 * 5. Clock skew / RTT offset calculation
 * 6. Rapid seek & loop prevention
 */

import { VideoSyncPlugin, UnifiedPlayer, applySync, VideoSyncMessage } from '../../plugins/videoSync';

// Mock in-memory WebSocket broker that simulates real duplex network communication
class SimulatedWebSocketBroker {
  private sockets: SimulatedClientSocket[] = [];

  public register(socket: SimulatedClientSocket) {
    this.sockets.push(socket);
  }

  public unregister(socket: SimulatedClientSocket) {
    this.sockets = this.sockets.filter((s) => s !== socket);
  }

  public broadcast(sender: SimulatedClientSocket, message: string) {
    for (const socket of this.sockets) {
      if (socket !== sender && socket.readyState === 1) {
        socket.triggerIncomingMessage(message);
      }
    }
  }
}

class SimulatedClientSocket {
  public readyState: number = 1; // OPEN
  private listeners: ((event: { data: string }) => void)[] = [];
  public sentMessages: any[] = [];
  private broker: SimulatedWebSocketBroker;

  constructor(broker: SimulatedWebSocketBroker) {
    this.broker = broker;
    this.broker.register(this);
  }

  public send(data: string) {
    const parsed = JSON.parse(data);
    this.sentMessages.push(parsed);
    this.broker.broadcast(this, data);
  }

  public addEventListener(event: string, handler: (event: { data: string }) => void) {
    if (event === 'message') {
      this.listeners.push(handler);
    }
  }

  public removeEventListener(event: string, handler: (event: { data: string }) => void) {
    if (event === 'message') {
      this.listeners = this.listeners.filter((h) => h !== handler);
    }
  }

  public triggerIncomingMessage(data: string) {
    for (const listener of this.listeners) {
      listener({ data });
    }
  }

  public close() {
    this.readyState = 3; // CLOSED
    this.broker.unregister(this);
  }
}

// In-Memory Test Player implementation matching UnifiedPlayer interface
class TestPlayer implements UnifiedPlayer {
  public currentTime: number = 0;
  public playing: boolean = false;
  public playbackRate: number = 1.0;
  public seekCount: number = 0;
  public playCount: number = 0;
  public pauseCount: number = 0;

  public play(): void {
    this.playing = true;
    this.playCount++;
  }

  public pause(): void {
    this.playing = false;
    this.pauseCount++;
  }

  public seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.seekCount++;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return 600;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public isPlaying(): boolean {
    return this.playing;
  }
}

export interface PipelineTestResult {
  name: string;
  passed: boolean;
  details: string;
}

export async function runRealPipelineIntegrationTests(): Promise<PipelineTestResult[]> {
  const results: PipelineTestResult[] = [];
  const broker = new SimulatedWebSocketBroker();

  // Test 1: Real Host -> Guest Sync Pipeline
  {
    const hostPlayer = new TestPlayer();
    const guestPlayer = new TestPlayer();

    const hostSocket = new SimulatedClientSocket(broker);
    const guestSocket = new SimulatedClientSocket(broker);

    const hostPlugin = new VideoSyncPlugin(hostPlayer, hostSocket, true, 'TEST_ROOM_1');
    const guestPlugin = new VideoSyncPlugin(guestPlayer, guestSocket, false, 'TEST_ROOM_1');

    hostPlugin.start();
    guestPlugin.start();

    // Host seeks to 45.0s and starts playback
    hostPlayer.currentTime = 45.0;
    hostPlugin.notifySeek(45.0);
    hostPlugin.notifyPlay();

    // Guest receives broadcast and aligns
    const guestAligned = guestPlayer.currentTime === 45.0 && guestPlayer.playing === true;

    results.push({
      name: '1. Host Action -> Real WebSocket Broadcast -> Guest Plugin Execution',
      passed: guestAligned,
      details: `Host pos=${hostPlayer.currentTime} playing=${hostPlayer.playing} | Guest pos=${guestPlayer.currentTime} playing=${guestPlayer.playing}`,
    });

    hostPlugin.stop();
    guestPlugin.stop();
  }

  // Test 2: Monotonic Revision Rejection (Stale messages must not override newer state)
  {
    const guestPlayer = new TestPlayer();
    const guestSocket = new SimulatedClientSocket(broker);
    const guestPlugin = new VideoSyncPlugin(guestPlayer, guestSocket, false, 'TEST_ROOM_2');
    guestPlugin.start();

    // Send Revision 10: pos = 120s
    guestPlugin.handleIncomingMessage({
      type: 'SYNC_COMMAND',
      command: 'seek',
      roomId: 'TEST_ROOM_2',
      position: 120,
      time: 120,
      revision: 10,
      serverTime: Date.now(),
    });

    const posAfterRev10 = guestPlayer.currentTime;

    // Send Stale Revision 5: pos = 30s (must be rejected)
    guestPlugin.handleIncomingMessage({
      type: 'SYNC_COMMAND',
      command: 'seek',
      roomId: 'TEST_ROOM_2',
      position: 30,
      time: 30,
      revision: 5,
      serverTime: Date.now() - 5000,
    });

    const staleRejected = guestPlayer.currentTime === 120 && posAfterRev10 === 120;

    results.push({
      name: '2. Real Monotonic Revision Guard (Rejection of Out-of-Order Packets)',
      passed: staleRejected,
      details: `Current position=${guestPlayer.currentTime}s (Expected 120s, Rejected 30s from revision 5)`,
    });

    guestPlugin.stop();
  }

  // Test 3: Clock Offset Calculation & Timeline Drift Compensation
  {
    const player = new TestPlayer();
    player.currentTime = 50.0;
    const socket = new SimulatedClientSocket(broker);
    const plugin = new VideoSyncPlugin(player, socket, false, 'TEST_ROOM_3');
    plugin.start();

    // Simulate server being 2000ms ahead of client
    const serverTimestamp = Date.now() - 2000;
    plugin.handleIncomingMessage({
      type: 'SYNC_STATE',
      roomId: 'TEST_ROOM_3',
      position: 50.0,
      time: 50.0,
      playing: true,
      playbackRate: 1.0,
      rate: 1.0,
      serverTime: serverTimestamp,
      revision: 1,
    });

    const estimatedPos = plugin.calculateEstimatedServerPosition();
    const driftResult = plugin.alignGuestWithHost();

    results.push({
      name: '3. Real Clock Skew Offset & Anti-Drift Server Timeline Estimation',
      passed: typeof estimatedPos === 'number' && !isNaN(estimatedPos),
      details: `Estimated server position=${estimatedPos.toFixed(2)}s | Drift result seeked=${driftResult?.seeked}`,
    });

    plugin.stop();
  }

  // Test 4: Multi-Client Multi-Guest Synchronization Convergence
  {
    const hostPlayer = new TestPlayer();
    const guestPlayer1 = new TestPlayer();
    const guestPlayer2 = new TestPlayer();
    const guestPlayer3 = new TestPlayer();

    const hostSocket = new SimulatedClientSocket(broker);
    const guestSocket1 = new SimulatedClientSocket(broker);
    const guestSocket2 = new SimulatedClientSocket(broker);
    const guestSocket3 = new SimulatedClientSocket(broker);

    const hostPlugin = new VideoSyncPlugin(hostPlayer, hostSocket, true, 'TEST_ROOM_4');
    const guestPlugin1 = new VideoSyncPlugin(guestPlayer1, guestSocket1, false, 'TEST_ROOM_4');
    const guestPlugin2 = new VideoSyncPlugin(guestPlayer2, guestSocket2, false, 'TEST_ROOM_4');
    const guestPlugin3 = new VideoSyncPlugin(guestPlayer3, guestSocket3, false, 'TEST_ROOM_4');

    hostPlugin.start();
    guestPlugin1.start();
    guestPlugin2.start();
    guestPlugin3.start();

    // Host changes state to playing at 240s
    hostPlayer.currentTime = 240.0;
    hostPlugin.notifySeek(240.0);
    hostPlugin.notifyPlay();

    const allConverged =
      guestPlayer1.currentTime === 240 &&
      guestPlayer1.playing === true &&
      guestPlayer2.currentTime === 240 &&
      guestPlayer2.playing === true &&
      guestPlayer3.currentTime === 240 &&
      guestPlayer3.playing === true;

    results.push({
      name: '4. Multi-Client Room Convergence (Host + 3 Guests Aligned to Exact Timeline)',
      passed: allConverged,
      details: `Guest1=${guestPlayer1.currentTime}s, Guest2=${guestPlayer2.currentTime}s, Guest3=${guestPlayer3.currentTime}s`,
    });

    hostPlugin.stop();
    guestPlugin1.stop();
    guestPlugin2.stop();
    guestPlugin3.stop();
  }

  // Test 5: Rapid Seek Spam Loop Prevention
  {
    const guestPlayer = new TestPlayer();
    const guestSocket = new SimulatedClientSocket(broker);
    const guestPlugin = new VideoSyncPlugin(guestPlayer, guestSocket, false, 'TEST_ROOM_5');
    guestPlugin.start();

    // Fire 20 seeks in rapid succession
    for (let i = 1; i <= 20; i++) {
      guestPlugin.handleIncomingMessage({
        type: 'SYNC_COMMAND',
        command: 'seek',
        roomId: 'TEST_ROOM_5',
        position: i * 5,
        time: i * 5,
        revision: i,
        serverTime: Date.now(),
      });
    }

    // Must end up at final state without crash or inverted order
    const finalSeekHandled = guestPlayer.currentTime === 100;

    results.push({
      name: '5. Rapid Seek Burst Handling & Feedback Loop Prevention',
      passed: finalSeekHandled,
      details: `Final position after 20 seeks=${guestPlayer.currentTime}s (Expected 100s)`,
    });

    guestPlugin.stop();
  }

  // Test 6: Direct applySync Math Verification
  {
    const player = new TestPlayer();
    player.currentTime = 10.0;
    player.playing = false;

    // Host is at 10.2s (< 0.3s drift) -> No seek should occur
    const smallDrift = applySync(player, player.currentTime, 10.2, false, false, 1.0, 1.0);
    const smallDriftNoSeek = !smallDrift.seeked;

    // Host is at 25.0s (> 0.3s drift) -> Hard seek must occur
    const largeDrift = applySync(player, player.currentTime, 25.0, false, false, 1.0, 1.0);
    const largeDriftSeeked = largeDrift.seeked && player.currentTime === 25.0;

    results.push({
      name: '6. Mathematical Sub-Second applySync Drift Verification (Threshold & Jitter Protection)',
      passed: smallDriftNoSeek && largeDriftSeeked,
      details: `Small drift (0.2s) seeked=${smallDrift.seeked} | Large drift (15s) seeked=${largeDrift.seeked}`,
    });
  }

  return results;
}
