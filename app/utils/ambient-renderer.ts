import { createNightScene } from './ambient-night'
import { createPondScene } from './ambient-pond'

export const createAmbientRenderer = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')!
  const night = createNightScene(ctx), pond = createPondScene(ctx)
  let width = 1, height = 1, originX = 0, originY = 0, theme: 'night' | 'pond' = 'pond'
  let arrivalStart: number | undefined
  function resize() {
    const bounds = canvas.getBoundingClientRect()
    width = Math.max(1, bounds.width || innerWidth); height = Math.max(1, bounds.height || innerHeight)
    originX = bounds.left; originY = bounds.top
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2500000 / (width * height)))
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    pond.resize(width, height)
  }
  resize()
  return {
    resize,
    setTheme(next: 'night' | 'pond') { if (next !== theme) { pond.reset(); arrivalStart = undefined }; theme = next },
    interact(x: number, y: number, time: number, force = false) { return theme === 'pond' && pond.interact(x - originX, y - originY, time, force) },
    draw(time: number) {
      arrivalStart ??= time
      const arrival = Math.max(0, time - arrivalStart)
      ctx.clearRect(0, 0, width, height)
      theme === 'night' ? night.draw(time, width, height, arrival) : pond.draw(time, arrival)
    },
    clear() { ctx.clearRect(0, 0, width, height); pond.reset(); arrivalStart = undefined }
  }
}
