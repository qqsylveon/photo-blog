const noise = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value) }
export const nightStars = Array.from({ length: 280 }, (_, i) => ({ x: noise(i + 1), y: noise(i + 501), radius: .55 + noise(i + 1001) ** 3 * 2.1, phase: noise(i + 1501) * Math.PI * 2, warm: i % 9 === 0 }))
export function createNightScene(ctx: CanvasRenderingContext2D) {
  const stars = nightStars
  return {
    draw(time: number, width: number, height: number) {
      ctx.save()
      const count = Math.min(280, Math.max(100, Math.round(width * height / 11500)))
      // Sparse atmospheric dust follows a loose diagonal band rather than an even dot pattern.
      for (let i = 0; i < 90; i++) {
        const x = noise(i + 2001) * width, y = (x / width * .46 + noise(i + 2501) * .22) * height
        ctx.fillStyle = `rgba(157,189,221,${.07 + noise(i + 3001) * .09})`
        ctx.beginPath(); ctx.arc(x, y, .4 + noise(i + 3501) * .7, 0, Math.PI * 2); ctx.fill()
      }
      for (let i = 0; i < count; i++) {
        const star = stars[i]!, x = star.x * width, y = star.y * height
        const glow = .4 + .5 * (1 + Math.sin(time * (.00035 + noise(i) * .0004) + star.phase)) / 2
        if (star.radius > 1.8) {
          const halo = ctx.createRadialGradient(x, y, 0, x, y, star.radius * 5)
          halo.addColorStop(0, `rgba(193,220,255,${glow * .27})`); halo.addColorStop(1, 'rgba(193,220,255,0)')
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, star.radius * 5, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = `rgba(220,236,255,${glow * .36})`; ctx.lineWidth = .6
          ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke()
        }
        ctx.fillStyle = star.warm ? `rgba(245,220,179,${glow})` : `rgba(213,232,255,${glow})`
        ctx.beginPath(); ctx.arc(x, y, star.radius, 0, Math.PI * 2); ctx.fill()
      }
      const meteorCount = width < 720 ? 3 : 5
      for (let i = 0; i < meteorCount; i++) {
        const seconds = time / 1000 + i * 2.17, period = 10.7, cycle = Math.floor(seconds / period), elapsed = seconds % period
        const duration = 1.25 + noise(i + cycle * 41) * .65
        if (elapsed > duration) continue
        const progress = elapsed / duration, seed = i * 17 + cycle * 83
        const angle = .42 + noise(seed + 1) * .28, distance = Math.min(width * .48, 800)
        const x = width * (.58 + noise(seed + 2) * .55) - distance * progress
        const y = height * (.03 + noise(seed + 3) * .38) + distance * progress * Math.tan(angle)
        const length = Math.min(width * .24, 210 + noise(seed + 4) * 130), fade = Math.sin(Math.PI * progress) ** .7
        const tx = x + Math.cos(angle) * length, ty = y - Math.sin(angle) * length
        const tail = ctx.createLinearGradient(x, y, tx, ty)
        tail.addColorStop(0, `rgba(224,243,255,${fade * .95})`); tail.addColorStop(.25, `rgba(151,203,239,${fade * .56})`); tail.addColorStop(1, 'rgba(151,203,239,0)')
        ctx.lineCap = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = tail
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke()
        const head = ctx.createRadialGradient(x, y, 0, x, y, 7)
        head.addColorStop(0, `rgba(247,252,255,${fade})`); head.addColorStop(.25, `rgba(180,224,255,${fade * .65})`); head.addColorStop(1, 'rgba(180,224,255,0)')
        ctx.fillStyle = head; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }
  }
}
