/**
 * Name of the cookie holding whether the video page's comment panel is open.
 *
 * It lives here rather than beside the panel: `VideoDetail` is a `"use client"`
 * module, and every export of one reaches a Server Component as a client
 * reference, not as its value — the page read `undefined` for the cookie name
 * and the panel came back open on every reload.
 */
export const COMMENT_PANEL_COOKIE = "tt-comments-open";
