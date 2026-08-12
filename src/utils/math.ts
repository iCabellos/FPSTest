export const DEG2RAD = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing. `smoothing` is the rate at
 * which the remaining distance is consumed per second (higher = snappier).
 */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

/** Same curve as {@link damp}, but returns the factor so it can drive vectors. */
export function dampFactor(smoothing: number, dt: number): number {
  return 1 - Math.exp(-smoothing * dt);
}

/** Moves `current` toward zero at a constant rate. */
export function decayToZero(current: number, rate: number, dt: number): number {
  const step = rate * dt;
  if (current > 0) return Math.max(0, current - step);
  if (current < 0) return Math.min(0, current + step);
  return 0;
}

export function randomRange(min: number, max: number, random: () => number = Math.random): number {
  return min + (max - min) * random();
}

/** Uniform value in [-amplitude, amplitude]. */
export function randomSigned(amplitude: number, random: () => number = Math.random): number {
  return (random() * 2 - 1) * amplitude;
}
