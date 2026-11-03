import { onScopeDispose, readonly, ref, type Ref } from 'vue'
import {ABOUT_CURTAIN_MS} from '~/utils/route-motion-timing'

export type CurtainPhase = 'idle' | 'preparing' | 'covering' | 'covered' | 'revealing'

type CurtainRoute = { path: string }
type CurtainHook = (to: CurtainRoute, from: CurtainRoute, failure?: unknown) => void | Promise<void>

interface CurtainRouter {
  beforeEach: (hook: CurtainHook) => () => void
  afterEach: (hook: CurtainHook) => () => void
  onError: (hook: (error: unknown, to: CurtainRoute, from: CurtainRoute) => void) => () => void
}

interface RouteCurtainTiming {
  nextFrame: () => Promise<void>
  wait: (duration: number) => Promise<void>
  reducedMotion: () => boolean
  snapshot?: () => { html: string; scrollY: number }
}

const defaultTiming: RouteCurtainTiming = {
  nextFrame: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  wait: duration => new Promise(resolve => setTimeout(resolve, duration)),
  reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  snapshot: () => {
    const clone = document.querySelector('.site-shell')?.cloneNode(true) as HTMLElement | undefined
    clone?.querySelectorAll('.route-curtain, canvas, [data-ambient-primer], script, iframe').forEach(element => element.remove())
    clone?.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
    return { html: clone?.outerHTML ?? '', scrollY: window.scrollY }
  }
}

export const isCurtainTarget = (path: string): boolean => path === '/gallery' || path === '/about'

export const createRouteCurtainController = (
  router: CurtainRouter,
  timing: RouteCurtainTiming = defaultTiming
 ) => {
  const state = ref<CurtainPhase>('idle')
  const target = ref<'gallery' | 'about' | null>(null)
  const snapshot = ref({ html: '', scrollY: 0 })
  let disposed = false
  let generation = 0, pendingRoute: CurtainRoute | undefined
  const reset = () => {
    generation++
    pendingRoute = undefined
    state.value = 'idle'
    target.value = null
    snapshot.value = { html: '', scrollY: 0 }
  }

  const removeBefore = router.beforeEach((to, from) => {
    if (disposed) return
    if (to.path === from.path) return
    reset()
    if (!isCurtainTarget(to.path) || from.path.startsWith('/admin') || timing.reducedMotion()) return
    pendingRoute = to
    target.value = to.path === '/gallery' ? 'gallery' : 'about'
    snapshot.value = target.value === 'about' ? timing.snapshot?.() ?? { html: '', scrollY: 0 } : { html: '', scrollY: 0 }
    // Signature artwork accompanies navigation; it never adds an artificial route delay.
    state.value = 'covered'
  })

  const removeAfter = router.afterEach(async (to, from, failure) => {
    if (disposed) return
    if (failure && to.path === from.path) { reset(); return }
    if (to !== pendingRoute || to.path === from.path) return
    if (failure) { reset(); return }
    pendingRoute = undefined
    const current = generation, duration = target.value === 'gallery' ? 1100 : ABOUT_CURTAIN_MS
    await timing.nextFrame()
    if (disposed || current !== generation) return
    state.value = 'revealing'
    await timing.wait(duration)
    if (!disposed && current === generation) reset()
  })
  const removeError = router.onError((_error, to) => { if (!disposed && to === pendingRoute) reset() })

  return {
    phase: readonly(state) as Readonly<Ref<CurtainPhase>>,
    target: readonly(target),
    snapshot: readonly(snapshot),
    dispose: () => {
      disposed = true
      reset()
      removeBefore()
      removeAfter()
      removeError()
    }
  }
}

export const useRouteCurtain = () => {
  const serverPhase = readonly(ref<CurtainPhase>('idle')) as Readonly<Ref<CurtainPhase>>
  if (import.meta.server) return { phase: serverPhase, target: readonly(ref<'gallery' | 'about' | null>(null)), snapshot: readonly(ref({ html: '', scrollY: 0 })) }

  const controller = createRouteCurtainController(useRouter() as unknown as CurtainRouter)
  onScopeDispose(controller.dispose)

  return { phase: controller.phase, target: controller.target, snapshot: controller.snapshot }
}
