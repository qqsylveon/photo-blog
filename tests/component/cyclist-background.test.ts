// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import CyclistTransition from '../../app/components/site/CyclistTransition.vue'

it('keeps the source water moving during pending navigation and stops copying when effects are off', () => {
  vi.stubGlobal('ref', ref); vi.stubGlobal('watch', watch); vi.stubGlobal('onMounted', onMounted); vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  const frames: FrameRequestCallback[] = [], cancel = vi.fn()
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.push(callback); return frames.length }))
  vi.stubGlobal('cancelAnimationFrame', cancel)
  const paint = { drawImage: vi.fn(), clearRect: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(paint as any)
  const live = document.createElement('canvas'); live.dataset.ambientBackground = ''; live.dataset.running = 'true'; live.width = 640; live.height = 480; document.body.append(live)
  const wrapper = mount(CyclistTransition, { props: { snapshot: { html: '', scrollY: 0 }, running: false } })
  try {
    expect(paint.drawImage).toHaveBeenCalledOnce()
    expect(frames.length).toBeGreaterThan(0)
    frames.shift()!(performance.now() + 40)
    expect(paint.drawImage).toHaveBeenCalledTimes(2)
    live.dataset.running = 'false'
    frames.shift()!(performance.now() + 80)
    expect(paint.drawImage).toHaveBeenCalledTimes(2)
    expect(wrapper.get('canvas').attributes('width')).toBe('640')
  } finally { wrapper.unmount(); live.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() }
  expect(cancel).toHaveBeenCalled()
})

it('updates the outgoing atmosphere when effects are enabled without Canvas support', async () => {
  vi.stubGlobal('ref', ref); vi.stubGlobal('watch', watch); vi.stubGlobal('onMounted', onMounted); vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const live = document.createElement('div'), style = document.createElement('style')
  live.className = 'ambient-primer'; live.dataset.ambientPrimer = ''; live.dataset.enabled = 'false'
  style.textContent = '.ambient-primer[data-enabled="false"] { display:none; }'
  document.body.append(style, live)
  const wrapper = mount(CyclistTransition, { props: { snapshot: { html: '', scrollY: 0 }, running: false } })
  try {
    expect(wrapper.get('.cycling-primer > .ambient-primer').element.getAttribute('style')).toContain('display: none')
    live.dataset.enabled = 'true'
    await new Promise(resolve => setTimeout(resolve, 0))
    frames.shift()!(performance.now() + 40)
    expect((wrapper.get('.cycling-primer > .ambient-primer').element as HTMLElement).style.display).not.toBe('none')
  } finally { wrapper.unmount(); live.remove(); style.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() }
})

it('bounds the temporary background bitmap on high resolution screens', () => {
  vi.stubGlobal('ref', ref); vi.stubGlobal('watch', watch); vi.stubGlobal('onMounted', onMounted); vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const paint = { drawImage: vi.fn(), clearRect: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(paint as any)
  const live = document.createElement('canvas')
  live.dataset.ambientBackground = ''; live.dataset.running = 'true'; live.width = 7680; live.height = 4320
  document.body.append(live)
  const wrapper = mount(CyclistTransition, { props: { snapshot: { html: '', scrollY: 0 }, running: false } })
  try {
    expect(wrapper.get('canvas').attributes('width')).toBe('1920')
    expect(wrapper.get('canvas').attributes('height')).toBe('1080')
  } finally { wrapper.unmount(); live.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() }
})
