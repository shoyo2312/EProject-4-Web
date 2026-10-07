import { afterEach, describe, expect, it, vi } from "vitest";

const { FakeClient, instances, tokens, refreshAccessToken } = vi.hoisted(() => {
  type Handler = (message: { body: string }) => void;

  const instances: FakeClient[] = [];

  class FakeClient {
    connected = false;
    active = false;
    brokerURL = "";
    beforeConnect: () => Promise<void> = async () => {};
    onConnect: () => void = () => {};
    handlers = new Map<string, Handler>();
    subscribe = vi.fn((destination: string, handler: Handler) => {
      this.handlers.set(destination, handler);
      return { id: destination, unsubscribe: vi.fn(() => this.handlers.delete(destination)) };
    });
    activate = vi.fn(() => {
      this.active = true;
    });
    deactivate = vi.fn(async () => {
      this.active = false;
      this.connected = false;
    });

    constructor() {
      instances.push(this);
    }

    /** What stompjs does on every (re)connect: a fresh session with no subscriptions. */
    async connect() {
      await this.beforeConnect();
      this.handlers.clear();
      this.connected = true;
      this.onConnect();
    }
  }

  return {
    FakeClient,
    instances,
    tokens: { access: "access" as string | null, refresh: "refresh" as string | null, fresh: true },
    refreshAccessToken: vi.fn<() => Promise<string | null>>(),
  };
});

vi.mock("@stomp/stompjs", () => ({ Client: FakeClient }));
vi.mock("@/lib/api/client", () => ({ refreshAccessToken: () => refreshAccessToken() }));
vi.mock("@/lib/api/tokens", () => ({
  getAccessToken: () => tokens.access,
  getRefreshToken: () => tokens.refresh,
  isAccessTokenFresh: () => tokens.fresh,
}));

/** Fresh module per test: the client and its topics are module state. */
async function load() {
  vi.resetModules();
  return import("@/lib/realtime/stompClient");
}

afterEach(() => {
  instances.length = 0;
  Object.assign(tokens, { access: "access", refresh: "refresh", fresh: true });
  refreshAccessToken.mockReset();
});

describe("subscribeTopic", () => {
  it("re-subscribes every topic after a reconnect", async () => {
    const { subscribeTopic } = await load();
    const onMessage = vi.fn();
    subscribeTopic("/topic/videos.1", onMessage);

    const client = instances[0];
    expect(client.activate).toHaveBeenCalledTimes(1);

    await client.connect();
    await client.connect();

    expect(client.subscribe).toHaveBeenCalledTimes(2);
    client.handlers.get("/topic/videos.1")?.({ body: '{"n":1}' });
    expect(onMessage).toHaveBeenCalledWith('{"n":1}');
  });

  it("subscribes at once on a live connection, and not again once dropped", async () => {
    const { subscribeTopic } = await load();
    subscribeTopic("/topic/a", vi.fn());
    const client = instances[0];
    await client.connect();

    const unsubscribe = subscribeTopic("/topic/b", vi.fn());
    expect(client.handlers.has("/topic/b")).toBe(true);

    unsubscribe();
    await client.connect();
    expect([...client.handlers.keys()]).toEqual(["/topic/a"]);
  });

  it("hands the handshake a refreshed token when the stored one is stale", async () => {
    const { subscribeTopic } = await load();
    tokens.fresh = false;
    refreshAccessToken.mockResolvedValue("rotated");
    subscribeTopic("/topic/a", vi.fn());

    await instances[0].connect();

    expect(instances[0].brokerURL).toContain("token=rotated");
  });

  it("does not connect without a token", async () => {
    const { subscribeTopic } = await load();
    tokens.access = null;
    tokens.refresh = null;
    subscribeTopic("/topic/a", vi.fn());

    await instances[0].beforeConnect();

    expect(instances[0].deactivate).toHaveBeenCalled();
  });
});

describe("resetRealtime", () => {
  it("reconnects as the current viewer when topics are still open", async () => {
    const { resetRealtime, subscribeTopic } = await load();
    subscribeTopic("/topic/a", vi.fn());
    const client = instances[0];
    await client.connect();

    resetRealtime();
    await vi.waitFor(() => expect(client.activate).toHaveBeenCalledTimes(2));
    expect(client.deactivate).toHaveBeenCalledTimes(1);
  });
});
