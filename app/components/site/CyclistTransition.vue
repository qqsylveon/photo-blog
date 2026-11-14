<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import artwork from '~/assets/artwork/cyclist.svg?raw'
import { cyclingFrame, legPose } from '~/utils/cycling-geometry'
import { ABOUT_RIDE_MS } from '~/utils/route-motion-timing'
const props = defineProps<{ snapshot: { html: string; scrollY: number }; running: boolean }>()
const root = ref<HTMLElement | null>(null), source = ref<HTMLElement | null>(null), surface = ref<HTMLElement | null>(null), bike = ref<HTMLElement | null>(null), ambient = ref<HTMLCanvasElement | null>(null), primer = ref<HTMLElement | null>(null)
let raf = 0, start = 0
let draw: (elapsed: number) => void = () => {}
let paintAmbient = () => {}, lastPaint = -Infinity
let begin = () => {}, cleanup = () => {}
onMounted(() => {
  const liveAmbient = document.querySelector<HTMLCanvasElement>('[data-ambient-background]'), ambientContext = ambient.value?.getContext('2d')
  const livePrimer = document.querySelector<HTMLElement>('[data-ambient-primer]')
  const primerCopy = livePrimer?.cloneNode(true) as HTMLElement | undefined
  if (primerCopy && primer.value) {
    primerCopy.removeAttribute('data-ambient-primer')
    const liveRipples = livePrimer!.querySelector<SVGElement>('.ambient-primer__ripples'), copiedRipples = primerCopy.querySelector<SVGElement>('.ambient-primer__ripples')
    if (liveRipples && copiedRipples) {
      const style = getComputedStyle(liveRipples)
      copiedRipples.style.transform = style.transform; copiedRipples.style.opacity = style.opacity
    }
    primer.value.append(primerCopy)
  }
  const svg = bike.value!.querySelector('svg')!, crank = svg.querySelector<SVGGElement>('.crank')!
  svg.insertBefore(crank, svg.querySelector('.rider--far'))
  crank.innerHTML = '<circle cx="232" cy="176" r="12" stroke-width="5"/><path class="crank-arms" stroke-width="5"/><path class="pedal-near" stroke="#334038" stroke-width="4"/><path class="pedal-far" stroke="#334038" stroke-width="4"/>'
  const legs = ['near', 'far'].map(side => {
    const rig = svg.querySelector(`.rider-upper--${side}`)!
    rig.removeAttribute('class')
    rig.innerHTML = '<path class="thigh" fill="none" stroke="#d38b64" stroke-width="14" stroke-linecap="round"/><path class="shorts" fill="none" stroke="#18221e" stroke-width="20" stroke-linecap="round"/><path class="calf" fill="none" stroke="#d38b64" stroke-width="12" stroke-linecap="round"/><g class="foot"><path d="M7 -15L7 -6" stroke="#e7e1d5" stroke-width="10" stroke-linecap="round"/><path d="M-14 -6Q-17 -2 -15 0H15Q20 0 16 -4L6 -9Z" fill="#f0e8d9"/><path d="M-15 0H16" stroke="#68766c" stroke-width="2"/></g>'
    return {
      side,
      thigh: rig.querySelector('.thigh')!, shorts: rig.querySelector('.shorts')!,
      calf: rig.querySelector('.calf')!, foot: rig.querySelector('.foot')!,
      pedal: crank.querySelector(`.pedal-${side}`)!
    }
  })
  const arms = crank.querySelector('.crank-arms')!, wheels = [...svg.querySelectorAll<SVGElement>('.wheel')]
  let width = 0, height = 0, spriteWidth = 0, motions: Animation[] = []
  let appearanceDirty = true, appearanceAnimating = false
  const syncAppearance = () => {
    if (primerCopy && livePrimer) {
      const style = getComputedStyle(livePrimer)
      primerCopy.style.opacity = style.opacity; primerCopy.style.display = style.display
    }
    if (ambient.value && liveAmbient) ambient.value.style.opacity = getComputedStyle(liveAmbient).opacity
    appearanceAnimating = [liveAmbient, livePrimer].some(node => node?.getAnimations?.().some(animation => animation.playState === 'running'))
    appearanceDirty = false
  }
  const appearanceObserver = new MutationObserver(() => { appearanceDirty = true })
  for (const node of [liveAmbient, livePrimer]) {
    if (node) appearanceObserver.observe(node, { attributes: true, attributeFilter: ['data-running', 'data-presented', 'data-ready', 'data-enabled', 'style'] })
  }
  paintAmbient = () => {
    // Mirror both live layers at their current opacity, without restarting their arrival.
    if (appearanceDirty || appearanceAnimating) syncAppearance()
    if (ambient.value && ambientContext && liveAmbient) {
      // Only the decorative outgoing background is mirrored. Bound its temporary
      // bitmap independently of monitor DPI; photographs stay at full resolution.
      const scale = Math.min(1, 1920 / Math.max(1, liveAmbient.width, liveAmbient.height))
      const copyWidth = Math.max(1, Math.round(liveAmbient.width * scale)), copyHeight = Math.max(1, Math.round(liveAmbient.height * scale))
      if (ambient.value.width !== copyWidth || ambient.value.height !== copyHeight) {
        ambient.value.width = copyWidth; ambient.value.height = copyHeight
      }
      ambientContext.clearRect(0, 0, copyWidth, copyHeight)
      if (liveAmbient.dataset.running === 'true') ambientContext.drawImage(liveAmbient, 0, 0, copyWidth, copyHeight)
    }
  }
  const travelFrames = () => {
    const first = cyclingFrame(width, spriteWidth, 0), last = cyclingFrame(width, spriteWidth, ABOUT_RIDE_MS)
    return [
      [source.value!, [first, last].map(frame => ({ transform: `translate3d(${frame.seam - first.seam}px,0,0)` }))],
      [surface.value!, [first, last].map(frame => ({ transform: `translate3d(${first.seam - frame.seam}px,0,0)` }))],
      [bike.value!, [first, last].map(frame => ({ transform: `translate3d(${frame.x}px,-55%,0)` }))]
    ] as const
  }
  const setTravel = (elapsed: number) => {
    const frame = cyclingFrame(width, spriteWidth, elapsed), offset = frame.seam - cyclingFrame(width, spriteWidth, 0).seam
    source.value!.style.transform = `translate3d(${offset}px,0,0)`
    surface.value!.style.transform = `translate3d(${-offset}px,0,0)`
    bike.value!.style.transform = `translate3d(${frame.x}px,-55%,0)`
  }
  const measure = () => {
    if (!root.value || !bike.value || !source.value || !surface.value) return
    const nextWidth = root.value.clientWidth, nextHeight = root.value.clientHeight, nextSprite = bike.value.clientWidth
    if (width === nextWidth && height === nextHeight && spriteWidth === nextSprite) return
    width = nextWidth; height = nextHeight; spriteWidth = nextSprite
    const fold = Math.min(width * .14, 180), leading = spriteWidth * .42 + 24, points = ['0 0']
    // Keep this curved mask fixed. Only its transform moves during the ride,
    // while the inner surface counter-translates to hold the old page still.
    for (let i = 0; i <= 24; i++) {
      const q = i / 24
      points.push(`${width + leading + fold * (2 * q - 1) ** 2}px ${q * height}px`)
    }
    points.push(`0 ${height}px`)
    source.value.style.width = `${width + leading + fold}px`
    source.value.style.clipPath = `polygon(${points.join(',')})`
    surface.value.style.width = `${width}px`
    if (motions.length) travelFrames().forEach(([, frames], index) => (motions[index]!.effect as KeyframeEffect).setKeyframes([...frames]))
    else setTravel(props.running ? Math.min(ABOUT_RIDE_MS, performance.now() - start) : 0)
  }
  draw = elapsed => {
    if (!bike.value) return
    const frame = cyclingFrame(width, spriteWidth, elapsed)
    if (!motions.length) setTravel(elapsed)
    bike.value.style.visibility = frame.finished ? 'hidden' : 'visible'
    arms.setAttribute('d', `M${frame.far.x} ${frame.far.y}L${frame.near.x} ${frame.near.y}`)
    for (const { side, thigh, shorts, calf, foot, pedal: pedalPath } of legs) {
      const pedal = side === 'near' ? frame.near : frame.far
      const { hip, knee, ankle } = legPose(side === 'near' ? { x: 276, y: 71 } : { x: 272, y: 69 }, pedal)
      thigh.setAttribute('d', `M${hip.x} ${hip.y}L${knee.x} ${knee.y}`)
      shorts.setAttribute('d', `M${hip.x} ${hip.y}L${hip.x + (knee.x - hip.x) * .6} ${hip.y + (knee.y - hip.y) * .6}`)
      calf.setAttribute('d', `M${knee.x} ${knee.y}L${ankle.x} ${ankle.y}`)
      foot.setAttribute('transform', `translate(${pedal.x} ${pedal.y})`)
      pedalPath.setAttribute('d', `M${pedal.x - 10} ${pedal.y + 2}h20`)
    }
    wheels.forEach(wheel => { wheel.style.transform = `rotate(${frame.angle * 180 / Math.PI}deg)` })
  }
  begin = () => {
    motions.forEach(motion => motion.cancel()); motions = []
    start = performance.now()
    setTravel(0)
    if (typeof source.value!.animate === 'function') {
      const origin = document.timeline.currentTime
      motions = travelFrames().map(([node, frames]) => {
        const motion = node.animate([...frames], { duration: ABOUT_RIDE_MS, easing: 'linear', fill: 'both' })
        motion.startTime = origin
        return motion
      })
    }
  }
  start = performance.now()
  measure(); draw(0); paintAmbient(); lastPaint = performance.now()
  const size = new ResizeObserver(measure)
  size.observe(root.value!); size.observe(bike.value!)
  if (props.running) begin()
  raf = requestAnimationFrame(tick)
  cleanup = () => { size.disconnect(); appearanceObserver.disconnect(); motions.forEach(motion => motion.cancel()) }
})
function tick(now: number) {
  if (now - lastPaint >= 1000 / 30) { paintAmbient(); lastPaint = now }
  if (props.running) draw(Math.min(ABOUT_RIDE_MS, now - start))
  if (!props.running || now - start < ABOUT_RIDE_MS) raf = requestAnimationFrame(tick)
}
watch(() => props.running, running => { if (running) begin() }, { flush: 'post' })
onBeforeUnmount(() => { cancelAnimationFrame(raf); cleanup() })
</script>
<template><div ref="root" class="cyclist-scene"><div ref="source" class="cycling-source" inert><div ref="surface" class="cycling-source-surface"><div ref="primer" class="cycling-primer" aria-hidden="true"/><canvas ref="ambient" class="cycling-ambient" aria-hidden="true"/><div class="cycling-source-content" :style="{ transform: `translateY(-${snapshot.scrollY}px)` }" v-html="snapshot.html" /></div></div><div ref="bike" class="cycling-rider" v-html="artwork" /></div></template>
<style>
.cyclist-scene { position:absolute; inset:0; overflow:hidden; }
.cycling-source { position:absolute; inset:0; background:var(--color-bg); overflow:hidden; will-change:transform; contain:paint; }
.cycling-source-surface { position:absolute; top:0; left:0; height:100%; will-change:transform; }
.cycling-primer { position:absolute; inset:0; isolation:isolate; pointer-events:none; }
.cycling-primer * { animation:none!important; transition:none!important; }
.cycling-ambient { position:absolute; inset:0; width:100%; height:100%; opacity:.85; pointer-events:none; }
.cycling-source-content { position:relative; width:100%; transform-origin:top left; }
.cycling-source-content * { animation:none!important; transition:none!important; }
.cycling-source-content .site-header { visibility:hidden; }
.cycling-rider { position:absolute; top:50%; left:0; width:clamp(290px,30vw,440px); aspect-ratio:2; color:#111916; transform:translate3d(120vw,-55%,0); will-change:transform; }
.cycling-rider svg { width:100%; height:100%; overflow:visible; display:block; }
.cycling-rider .wheel { transform-box:view-box; }
.cycling-rider .wheel-front { transform-origin:118px 176px; }
.cycling-rider .wheel-rear { transform-origin:338px 176px; }
@media(max-width:720px){.cycling-rider{width:72vw}}
</style>
