<script setup lang="ts">
import { createAmbientLoop } from '~/utils/ambient-loop'
import { createAmbientRenderer } from '~/utils/ambient-renderer'
import { AMBIENT_READY } from '~/utils/home-entry'
const { enabled } = useAmbientPreference()
const canvas = ref<HTMLCanvasElement | null>(null), running = ref(false), scene = ref<'night' | 'pond'>('pond')
let cleanup = () => {}
onMounted(() => {
  const markReady = () => {
    if (!canvas.value) return
    canvas.value.dataset.ambientReady = 'true'
    window.dispatchEvent(new Event(AMBIENT_READY))
  }
  if (!canvas.value?.getContext('2d')) { markReady(); return }
  const renderer = createAmbientRenderer(canvas.value), loop = createAmbientLoop(renderer.draw)
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const sync = () => {
    const wasRunning = running.value
    scene.value = document.documentElement.dataset.theme === 'dark' ? 'night' : 'pond'
    renderer.setTheme(scene.value)
    const blocked = Boolean(document.querySelector('.photo-lightbox, dialog[open]'))
    running.value = enabled.value && !document.hidden && !motion.matches && !blocked
    if (running.value) {
      if (!wasRunning) nextTick(() => {
        if (!canvas.value || !running.value) return
        renderer.resize()
        renderer.draw(performance.now())
        markReady()
        loop.start()
      })
      else loop.start()
    } else { loop.stop(); renderer.clear(); markReady() }
  }
  const themeObserver = new MutationObserver(sync), overlayObserver = new MutationObserver(sync)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  overlayObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'data-state'] })
  const stopWatch = watch(enabled, sync)
  const resize = () => { renderer.resize(); sync() }
  const pointer = (event: PointerEvent) => { if (running.value && scene.value === 'pond') renderer.interact(event.clientX, event.clientY, performance.now(), event.type === 'pointerdown') }
  window.addEventListener('pointermove', pointer, { passive: true }); window.addEventListener('pointerdown', pointer, { passive: true })
  window.addEventListener('resize', resize); document.addEventListener('visibilitychange', sync); motion.addEventListener('change', sync)
  sync()
  cleanup = () => { loop.dispose(); themeObserver.disconnect(); overlayObserver.disconnect(); stopWatch(); window.removeEventListener('pointermove', pointer); window.removeEventListener('pointerdown', pointer); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync) }
})
onBeforeUnmount(() => cleanup())
</script>
<template><canvas ref="canvas" v-show="running" class="ambient-background" data-ambient-background :data-running="running" :data-scene="scene" aria-hidden="true"></canvas></template>
