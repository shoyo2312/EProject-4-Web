import { Client, type StompSubscription } from "@stomp/stompjs";

import { refreshAccessToken } from "@/lib/api/client";
import { getAccessToken, getRefreshToken, isAccessTokenFresh } from "@/lib/api/tokens";

const WS_BASE = (process.env.NEXT_PUBLIC_WS_GATEWAY_URL ?? "http://localhost:8080").replace(
  /^http/,
  "ws",
);

interface Topic {
  destination: string;
  onMessage: (body: string) => void;
  /** This topic's subscription on the live connection; null while there is none. */
  subscription: StompSubscription | null;
}

/** Every destination a mounted component is listening to, connected or not. */
const topics = new Set<Topic>();
let client: Client | null = null;

/**
 * One connection for the whole app. If the chat feature opens its own, move it onto this one —
 * a second socket buys nothing and doubles the handshakes.
 *
 * Built once and never swapped. The token is read in `beforeConnect`, so every (re)connect —
 * including the ones stompjs makes on its own after a drop — hands the handshake whatever token
 * is current, instead of the one the client happened to be built with, which is 15 minutes from
 * being rejected.
 */
function connection(): Client {
  if (client) return client;

  const next = new Client({ reconnectDelay: 3000 });

  // The token travels as a `token` query param, not an `Authorization`
  // connectHeader: chat-service's `JwtHandshakeInterceptor` gates the HTTP
  // Upgrade itself, before any STOMP frame (which is what connectHeaders ride
  // on) exists to carry a header — browsers cannot attach an Authorization
  // header to a WebSocket/SockJS handshake request in the first place. See
  // `services/chat-service/.../websocket/JwtHandshakeInterceptor.java`.
  next.beforeConnect = async () => {
    const token = await handshakeToken();
    // Signed out the socket still opens, as a guest: chat-service lets it listen to the public
    // topics — counts and comments — and nothing else.
    next.brokerURL = token
      ? `${WS_BASE}/ws?token=${encodeURIComponent(token)}`
      : `${WS_BASE}/ws`;
  };

  // Every connection starts with no subscriptions — the broker forgot the old
  // ones when the socket dropped — so each one re-subscribes every topic.
  next.onConnect = () => {
    for (const topic of topics) attach(next, topic);
  };

  client = next;
  return next;
}

/**
 * The access token, refreshed first if it is gone or about to expire. Never throws: stompjs
 * awaits this inside its connect, and a rejection there ends the reconnect loop for good.
 */
async function handshakeToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && isAccessTokenFresh(token)) return token;
  if (!getRefreshToken()) return token;
  try {
    return await refreshAccessToken();
  } catch {
    // Gateway unreachable: try with what there is, and the reconnect loop asks again.
    return token;
  }
}

function attach(stomp: Client, topic: Topic): void {
  topic.subscription = stomp.subscribe(topic.destination, (message) =>
    topic.onMessage(message.body),
  );
}

/**
 * Listens to `destination` on the shared connection until the returned function is called,
 * surviving reconnects. Opens the connection on first use.
 */
export function subscribeTopic(destination: string, onMessage: (body: string) => void): () => void {
  const topic: Topic = { destination, onMessage, subscription: null };
  topics.add(topic);

  const stomp = connection();
  if (stomp.connected) attach(stomp, topic);
  else if (!stomp.active) stomp.activate();

  return () => {
    topics.delete(topic);
    if (stomp.connected) topic.subscription?.unsubscribe();
    topic.subscription = null;
  };
}

/**
 * Drops the connection and reopens it as whoever holds the tokens now — as a guest, signed
 * out. Called whenever the viewer changes: the handshake fixed the identity behind
 * `/user/queue/**`, and the old one must not keep receiving on the new viewer's behalf.
 */
export function resetRealtime(): void {
  const stomp = client;
  if (!stomp) return;
  for (const topic of topics) topic.subscription = null;
  void stomp.deactivate().then(() => {
    if (topics.size > 0) stomp.activate();
  });
}
