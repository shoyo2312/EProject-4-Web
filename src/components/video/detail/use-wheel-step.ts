"use client";

import { useEffect, type RefObject } from "react";

/** Below this the wheel is treated as noise — a rounding tick, not a gesture. */
const WHEEL_NOISE = 2;

/**
 * A gesture is over once the wheel has been quiet for this long. Momentum from
 * a trackpad flick keeps firing well past the flick itself, so the gap between
 * events — not their total distance — is what separates one gesture from two.
 */
const WHEEL_IDLE_MS = 220;

/*
 * The gesture guard lives at module scope: stepping unmounts `VideoDetail` and
 * mounts the next one, so a guard held in the component would be thrown away
 * exactly when it is needed — the momentum tail of the flick that navigated
 * would arrive at a fresh listener and step again. These two carry it across
 * the navigation instead.
 */
let inGesture = false;
let gestureIdle: ReturnType<typeof setTimeout> | undefined;

/** Restarted on every wheel event; firing it ends the current gesture. */
function armGestureIdle() {
  clearTimeout(gestureIdle);
  gestureIdle = setTimeout(() => {
    inGesture = false;
  }, WHEEL_IDLE_MS);
}

/**
 * Wheel-to-step over `ref`, standing in for the feed's scroll-snap: the video
 * page is one video per route, so there is nothing to scroll and the wheel
 * has to be translated into a navigation. Bound to the player column only, so
 * the comment list beside it keeps scrolling normally.
 *
 * The feed gets its feel from `scroll-snap-stop: always`, which advances
 * exactly one video per gesture however hard it was thrown. That is what is
 * reproduced here, so a light flick moves too: the *first* real tick of a
 * gesture steps immediately, and everything after it is swallowed until the
 * wheel falls quiet — rather than waiting for some distance to add up, which
 * is what made a gentle scroll do nothing.
 */
export function useWheelStep(
  ref: RefObject<HTMLElement | null>,
  step: (direction: "next" | "previous") => void,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      /*
       * A modal opened from inside this column (report, privacy, delete) is
       * still in the column's subtree, so its wheel events bubble here. Left
       * alone they were swallowed by `preventDefault` and stepped the video
       * instead of scrolling the sheet. While one is open the wheel belongs to
       * it — over its backdrop too, where stepping the video underneath is
       * just as wrong.
       */
      if (document.querySelector("[role='dialog']")) return;

      // The column has nowhere to scroll, so this only suppresses overscroll.
      event.preventDefault();
      if (Math.abs(event.deltaY) < WHEEL_NOISE) return;

      // Still inside the gesture that already stepped — keep it alive so the
      // momentum tail cannot start a second one, and ignore it.
      armGestureIdle();
      if (inGesture) return;

      inGesture = true;
      step(event.deltaY > 0 ? "next" : "previous");
    };

    // The idle timer is deliberately left running by the cleanup: unmounting is
    // usually the step itself, and the incoming page needs the guard intact.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, step]);
}
