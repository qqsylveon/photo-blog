import { describe, expect, it } from 'vitest'
import { cyclingFrame, legPose } from '../../app/utils/cycling-geometry'

it.each([[393,283],[2560,440]])('completes the slightly faster ride at2200ms and clears a%ipx viewport',(width,spriteWidth)=>{
  expect(cyclingFrame(width,spriteWidth,2199).finished).toBe(false)
  const frame=cyclingFrame(width,spriteWidth,2200)
  expect(frame.finished).toBe(true)
  expect(frame.x+spriteWidth).toBeLessThan(0)
})

describe('responsive cyclist exit and connected pedaling', () => {
  it.each([[320, 230], [390, 281], [530, 382], [768, 290], [1440, 432]])('fully exits a %ipx viewport', (width, spriteWidth) => {
    const frame = cyclingFrame(width, spriteWidth, 2800)
    expect(frame.x + spriteWidth).toBeLessThanOrEqual(-23.9)
    expect(frame.finished).toBe(true)
    expect(cyclingFrame(width, spriteWidth, 0).x).toBeGreaterThan(width)
  })
  it('preserves limb lengths throughout the entire pedal cycle', () => {
    for (let i = 0; i < 72; i++) {
      const frame = cyclingFrame(1000, 400, i * 650 / 72)
      const pose = legPose({ x: 276, y: 71 }, frame.near)
      expect(Math.hypot(pose.knee.x - pose.hip.x, pose.knee.y - pose.hip.y)).toBeCloseTo(64, 8)
      expect(Math.hypot(pose.ankle.x - pose.knee.x, pose.ankle.y - pose.knee.y)).toBeCloseTo(74, 8)
      expect(pose.ankle.x - frame.near.x).toBeCloseTo(7, 10)
    }
  })
})
