/**
 * The three clocks of the typing indicator. They are chosen to fit together with chat-service's own
 * (`TypingService.TTL_MS`, 7s): a renewal every 2.5s keeps a typing session alive with room to lose
 * one frame, the typist's side stops 4s after the last keystroke, and the viewer's side drops the dots
 * 8s after the last frame — a second longer than the server would hold them, so the server's "stopped"
 * normally arrives first and this is only the net under a lost frame or a dead connection.
 */
export const TYPING_HEARTBEAT_MS = 2_500;
export const TYPING_IDLE_MS = 4_000;
export const TYPING_PEER_TTL_MS = 8_000;
