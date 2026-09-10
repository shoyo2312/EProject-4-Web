import { Client } from "@stomp/stompjs";

let client: Client | null = null;
const connectListeners = new Set<() => void>();

/**
 * One connection for the whole app. If the chat feature opens its own, move it onto this one —
 * a second socket buys nothing and doubles the handshakes.
 */
export function getStompClient(token: string): Client {
  if (client) {
    return client;
  }
  const wsBase = (process.env.NEXT_PUBLIC_WS_GATEWAY_URL ?? "http://localhost:8080")
    .replace(/^http/, "ws");

  client = new Client({
    brokerURL: `${wsBase}/ws`,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 3000,
  });
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
