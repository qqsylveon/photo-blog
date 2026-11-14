// Shared smoothstep keeps every layer continuous at both ends of its arrival.
export function ambientReveal(elapsed: number, delay: number, duration: number): number {
  const progress = Math.max(0, Math.min(1, (elapsed - delay) / duration))
  return progress * progress * (3 - 2 * progress)
}
