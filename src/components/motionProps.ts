/** The design's easing curve (a soft deceleration). */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Vertical travel of the fade-up entrance, in pixels. */
const FADE_UP_RISE_PX = 14;

/** Default duration of the fade-up entrance, in seconds. */
const FADE_UP_S = 0.45;

/**
 * Props for the design's fade-up entrance. Returns an empty object when motion is off,
 * so the element simply renders in place.
 * @param reduce true when the user asked for reduced motion
 * @param delay seconds to wait before starting (used for staggering lists)
 * @param duration seconds the animation takes
 */
export const fadeUp = (reduce: boolean, delay = 0, duration = FADE_UP_S) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: FADE_UP_RISE_PX },
        animate: { opacity: 1, y: 0 },
        transition: { duration, delay, ease: EASE },
      };
