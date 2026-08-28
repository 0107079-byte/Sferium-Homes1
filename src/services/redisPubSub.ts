import Redis from "ioredis";

export const INSTANCE_ID = `sferium_node_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
const ROOM_EVENTS_CHANNEL = "sferium:room_events";

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let isPubSubActive = false;

function createRedisClient(role: "publisher" | "subscriber"): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          return null; // Stop retrying after 5 attempts to avoid flooding logs
        }
        return Math.min(times * 1000, 5000);
      },
      lazyConnect: true,
    });

    client.on("error", (err) => {
      // Suppress spamming unhandled errors
      console.warn(`[Redis PubSub] ${role} error:`, err.message);
    });

    return client;
  } catch (e: any) {
    console.warn(`[Redis PubSub] Failed to initialize Redis ${role}:`, e.message);
    return null;
  }
}

export async function publishRoomEvent(roomId: string, message: any): Promise<void> {
  if (!publisher && process.env.REDIS_URL) {
    publisher = createRedisClient("publisher");
    if (publisher) {
      publisher.connect().catch((err) => {
        console.warn("[Redis PubSub] Publisher connection failed:", err.message);
      });
    }
  }

  if (!publisher || publisher.status !== "ready") {
    return;
  }

  try {
    const eventPayload = JSON.stringify({
      instanceId: INSTANCE_ID,
      roomId,
      message,
      timestamp: Date.now(),
    });
    await publisher.publish(ROOM_EVENTS_CHANNEL, eventPayload);
  } catch (err: any) {
    console.warn("[Redis PubSub] Error publishing room event:", err.message);
  }
}

export async function subscribeToRoomEvents(
  onMessage: (roomId: string, message: any) => void
): Promise<void> {
  if (isPubSubActive) return;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[Redis PubSub] REDIS_URL not configured. Running in single-instance mode.");
    return;
  }

  subscriber = createRedisClient("subscriber");
  if (!subscriber) return;

  try {
    await subscriber.connect();
    await subscriber.subscribe(ROOM_EVENTS_CHANNEL);
    isPubSubActive = true;
    console.log(`[Redis PubSub] Instance ${INSTANCE_ID} subscribed to ${ROOM_EVENTS_CHANNEL}`);

    subscriber.on("message", (channel, rawMessage) => {
      if (channel !== ROOM_EVENTS_CHANNEL) return;
      try {
        const parsed = JSON.parse(rawMessage);
        // Ignore events published by this exact instance to avoid double-processing
        if (parsed.instanceId === INSTANCE_ID) {
          return;
        }
        if (parsed.roomId && parsed.message) {
          onMessage(parsed.roomId, parsed.message);
        }
      } catch (err: any) {
        console.warn("[Redis PubSub] Error processing incoming event:", err.message);
      }
    });
  } catch (err: any) {
    console.warn("[Redis PubSub] Subscription initialization failed:", err.message);
  }
}
