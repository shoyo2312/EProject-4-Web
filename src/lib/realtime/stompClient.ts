import { Client } from "@stomp/stompjs";

let client: Client | null = null;
/** The token the live `client` was built with — see `getStompClient`. */
let clientToken: string | null = null;
const connectListeners = new Set<() => void>();

/**
 * One connection for the whole app. If the chat feature opens its own, move it onto this one —
 * a second socket buys nothing and doubles the handshakes.
 *
 * Rebuilds the client whenever `token` differs from the one it was last built with — an access
 * token is good for 15 minutes (CLAUDE.md), and a feed left open past that must not keep
 * reconnecting with the token it started with. `connectListeners` survives the swap: it is what
 * every subscriber (the feed's video list, the comment sheet) re-subscribes through, and losing
 * it on a token refresh would silently stop every open subscription.
 */
export function getStompClient(token: string): Client {
  if (client && clientToken === token) {
    return client;
  }
  if (client) {
    client.deactivate();
    client = null;
  }

  const wsBase = (process.env.NEXT_PUBLIC_WS_GATEWAY_URL ?? "http://localhost:8080")
    .replace(/^http/, "ws");

  // The token travels as a `token` query param, not an `Authorization`
  // connectHeader: chat-service's `JwtHandshakeInterceptor` gates the HTTP
  // Upgrade itself, before any STOMP frame (which is what connectHeaders ride
  // on) exists to carry a header — browsers cannot attach an Authorization
  // header to a WebSocket/SockJS handshake request in the first place. See
  // `services/chat-service/.../websocket/JwtHandshakeInterceptor.java`.
  client = new Client({
    brokerURL: `${wsBase}/ws?token=${encodeURIComponent(token)}`,
    reconnectDelay: 3000,
  });
  clientToken = token;
  // `Client.onConnect` is a single field, not an event bus — every subscriber (the feed's video
  // list, the comment sheet) registers through `onStompConnect` below instead of overwriting it.
  client.onConnect = () => {
    connectListeners.forEach((listener) => listener());
  };
  client.activate();
  return client;
}

/**
 * Runs `listener` on every (re)connect of the shared client — a reconnect drops every STOMP
 * subscription, so each feature re-subscribes from here rather than assuming one survived.
 * Returns an unsubscribe function.
 */
export function onStompConnect(listener: () => void): () => void {
  connectListeners.add(listener);
  return () => {
    connectListeners.delete(listener);
  };
}
