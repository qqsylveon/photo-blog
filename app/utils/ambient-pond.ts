import { createWaterField, createRipplePool } from './ambient-water'
import { createLeafSprite, createLotusSprite, createLotusBudSprite, createPavilionSprite, createEgretSprite, drawEgret } from './ambient-pond-art'
import {createShrimpSprite,drawShrimp} from './ambient-shrimp'
import {createPondSwimmers,type PondSwimmer} from './pond-swimmers'

export function createPondScene(ctx: CanvasRenderingContext2D) {
  const leaves=[0,1,2].map(createLeafSprite),lotus=createLotusSprite(),bud=createLotusBudSprite(),pavilion=createPavilionSprite(),egret=createEgretSprite(),shrimp=createShrimpSprite()
  const texture = document.createElement('canvas'), textureContext = texture.getContext('2d')!
  const rings = createRipplePool(48), swimmers = createPondSwimmers()
  let width = 1, height = 1, columns = 80, rows = 60, field = createWaterField(columns, rows)
  let pixels = textureContext.createImageData(columns, rows), lastInput = -Infinity, lastPoint: { x: number; y: number } | undefined, rainStep = -1
  let wash: CanvasGradient
  function resize(w: number, h: number) {
    width = w; height = h
    columns = Math.min(180, Math.max(72, Math.round(w / 12))); rows = Math.min(140, Math.max(60, Math.round(h / 12)))
    field = createWaterField(columns, rows); texture.width = columns; texture.height = rows
    pixels = textureContext.createImageData(columns, rows)
    wash = ctx.createLinearGradient(0, 0, w * .2, h)
    wash.addColorStop(0, 'rgba(205,224,218,.10)'); wash.addColorStop(.45, 'rgba(166,204,193,.16)'); wash.addColorStop(1, 'rgba(127,178,172,.21)')
    reset()
  }
  function reset() { rings.clear(); field.reset(); lastPoint = undefined; lastInput = -Infinity; rainStep = -1 }
  function interact(x: number, y: number, time: number, force = false) {
    if (![x, y, time].every(Number.isFinite) || x < 0 || x > width || y < 0 || y > height || (!force && time - lastInput < 40)) return false
    const distance = lastPoint ? Math.hypot(x - lastPoint.x, y - lastPoint.y) : 0
    if (!force && lastPoint && distance < 10) return false
    const steps = lastPoint ? Math.min(4, Math.max(1, Math.floor(distance / 25))) : 1
    for (let i = 1; i <= steps; i++) {
      const px = lastPoint ? lastPoint.x + (x - lastPoint.x) * i / steps : x
      const py = lastPoint ? lastPoint.y + (y - lastPoint.y) * i / steps : y
      field.disturb(px / width, py / height, force ? 5 : 2.4)
      rings.add(px / width, py / height, time, force ? 1.7 : .85)
    }
    lastPoint = { x, y }; lastInput = time
    return true
  }
  function water(time: number) {
    const rain = Math.floor(time / 290)
    if (rain !== rainStep) { rainStep = rain; field.disturb((Math.sin(rain * 2.71) + 1) * .48, (Math.sin(rain * 4.19) + 1) * .48, .65) }
    field.step()
    const values = field.values, data = pixels.data
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < columns - 1; x++) {
      const i = y * columns + x, offset = i * 4
      const normal = (values[i - 1]! - values[i + 1]!) * .8 + (values[i - columns]! - values[i + columns]!) * 1.2
      const drift = Math.sin(x * .38 + y * .19 + time * .00065 + Math.sin(y * .23 + time * .00022)) * .13
      const reflection = Math.tanh(normal) * .24 + drift
      const highlight = Math.max(0, reflection) / .37
      data[offset] = 146 + highlight * 91; data[offset + 1] = 186 + highlight * 61; data[offset + 2] = 187 + highlight * 54
      data[offset + 3] = 9 + Math.abs(reflection) * 58
    }
    textureContext.putImageData(pixels, 0, 0)
    ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true; ctx.drawImage(texture, 0, 0, width, height)
    for (let row = 0; row < 12; row++) {
      const y = height * (.14 + row * .075), drift = Math.sin(time * .00027 + row) * 9
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const x = i / 24 * width, py = y + Math.sin(i * .7 + time * .00035 + row * .9) * 3 + drift
        i ? ctx.lineTo(x, py) : ctx.moveTo(x, py)
      }
      ctx.strokeStyle = row % 3 ? 'rgba(255,255,240,.13)' : 'rgba(95,153,156,.09)'; ctx.lineWidth = .8; ctx.stroke()
    }
  }
  function ripples(time: number) {
    for (const ripple of rings.active(time)) {
      const age = time - ripple.born, x = ripple.x * width, y = ripple.y * height, fade = (1 - age / 3600) ** 1.7
      for (let i = 0; i < 3; i++) {
        const radius = age * .072 - i * 11
        if (radius < 1) continue
        ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .57, -.1, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(70,126,138,${fade * .36 * ripple.strength})`; ctx.lineWidth = .9; ctx.stroke()
        ctx.beginPath(); ctx.ellipse(x, y - 1.2, radius + 1, radius * .57, -.1, Math.PI, Math.PI * 1.88)
        ctx.strokeStyle = `rgba(248,255,247,${fade * .74})`; ctx.lineWidth = 1; ctx.stroke()
      }
      if (age < 300) for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * .4, travel = age * .048 * ripple.strength
        const px = x + Math.cos(angle) * travel, py = y - Math.sin(angle) * travel * .8 - age * .025 + age * age * .00013
        ctx.beginPath(); ctx.ellipse(px, py, 1, 2.5, angle, 0, Math.PI * 2); ctx.fillStyle = `rgba(225,246,240,${(1 - age / 300) * .8})`; ctx.fill()
      }
    }
  }
  function koi(time: number, index: number,pose:PondSwimmer) {
    const {x,y,angle}=pose
    const scale = width < 720 ? .7 : width > 1800 ? 1.2 : 1
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale); ctx.globalAlpha = .52
    const wag = Math.sin(time * .005 + index) * 7
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.bezierCurveTo(-38, -9 + wag, -46, -13 + wag, -49, -10 + wag); ctx.lineTo(-43, wag); ctx.lineTo(-49, 10 + wag); ctx.quadraticCurveTo(-37, 13 + wag, -26, 0)
    ctx.fillStyle = index % 2 ? '#9bbab3' : '#d5b08c'; ctx.fill()
    const body = ctx.createLinearGradient(0, -11, 0, 11); body.addColorStop(0, '#75998d'); body.addColorStop(.35, index === 1 ? '#c5d0bc' : '#eadbc3'); body.addColorStop(1, '#98b5a6')
    ctx.beginPath(); ctx.moveTo(32, 0); ctx.bezierCurveTo(16, -14, -14, -14, -29, 0); ctx.bezierCurveTo(-14, 14, 16, 14, 32, 0); ctx.fillStyle = body; ctx.fill()
    ctx.fillStyle = index === 1 ? '#5e7f75' : '#c58864'
    for (const [px, py, size] of [[17, -3, 7], [-3, 1, 9], [-16, -2, 5]]) { ctx.beginPath(); ctx.ellipse(px!, py!, size!, 5, .25, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = 'rgba(148,185,174,.6)'
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(9, side * 6); ctx.quadraticCurveTo(0, side * 23, -8, side * 16); ctx.lineTo(-4, side * 5); ctx.fill() }
    ctx.strokeStyle = 'rgba(246,251,227,.45)'; ctx.lineWidth = .5
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-18 + i * 5, -1, 4, -.8, .8); ctx.stroke() }
    ctx.beginPath(); ctx.arc(25, -4, 1.3, 0, Math.PI * 2); ctx.fillStyle = '#415f58'; ctx.fill(); ctx.restore()
  }
  function dragonfly(time: number, index: number) {
    const t = time * .00035 + index * 3, x = width * (index ? .88 : .12) + Math.sin(t) * 26, y = height * (index ? .45 : .68) + Math.sin(t * 1.7) * 16
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * .8) * .3); ctx.globalAlpha = .5
    for (const side of [-1, 1]) for (const direction of [-1, 1]) {
      ctx.save(); ctx.rotate(side * (.45 + Math.sin(time * .045) * .12)); ctx.beginPath(); ctx.ellipse(side * 14, direction * 4, 15, 3.4, side * .3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(240,251,240,.7)'; ctx.fill(); ctx.strokeStyle = 'rgba(104,149,151,.6)'; ctx.lineWidth = .6; ctx.stroke(); ctx.restore()
    }
    ctx.strokeStyle = '#789e9e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 22); ctx.stroke()
    ctx.fillStyle = '#587f81'; ctx.beginPath(); ctx.ellipse(0, -6, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  function draw(time: number) {
    ctx.save(); water(time)
    const scale = width < 720 ? .65 : width > 1800 ? 1.25 : 1
    ctx.save(); ctx.globalAlpha = .23; const pw = 165 * scale; ctx.drawImage(pavilion, width * .94 - pw * .5, height * .12, pw, pw * 2 / 3); ctx.restore()
    for(const pose of swimmers.sample(time,width,height)){
      if(pose.kind==='koi')koi(time,pose.index,pose)
      else drawShrimp(ctx,shrimp,time,pose.index,width,height,pose)
    }
    for (let i = 0; i < 8; i++) {
      const t = time * .00024 + i * 2.7, x = width * (i % 2 ? .945 : .055) + Math.sin(t) * 4 + Math.sin(t * 1.77) * 2
      const y = height * (.31 + Math.floor(i / 2) * .21) + Math.sin(t * .83) * 3 + Math.sin(t * 1.31) * 1.5
      const size = (i % 3 === 0 ? 118 : 90) * scale
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * .71) * .035 + Math.sin(t * 1.43) * .018); ctx.globalAlpha = .48
      ctx.drawImage(leaves[i%3]!, -size * .5, -size * .375, size, size * .75)
      if (i === 1 || i === 4 || i === 7) { ctx.globalAlpha = .67; ctx.drawImage(lotus, -size * .32, -size * .87, size * .68, size * .68) }
      if(i===2){ctx.globalAlpha=.64;ctx.drawImage(bud,-size*.2,-size*.82,size*.42,size*.67)}
      ctx.restore()
    }
    drawEgret(ctx,egret, width * .105, height * .83, scale, time)
    dragonfly(time, 0); if (width > 720) dragonfly(time, 1)
    ripples(time)
    ctx.strokeStyle = 'rgba(103,146,157,.19)'; ctx.lineWidth = .8
    for (let i = 0; i < 42; i++) {
      const x = ((i * 117.37) % 997) / 997 * width, y = ((time * .10 + i * 71) % (height + 40)) - 20
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13); ctx.stroke()
    }
    ctx.restore()
  }
  return { resize, interact, draw, reset }
}
