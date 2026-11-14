import { describe, expect, it, vi } from 'vitest'

import {
  createRouteCurtainController,
  isCurtainTarget
} from '../../app/composables/useRouteCurtain'

type RouteHook = (to: { path: string }, from: { path: string }, failure?: unknown) => void | Promise<void>

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const createRouter = () => {
  let beforeHook: RouteHook = () => undefined
  let afterHook: RouteHook = () => undefined
  const removeBefore = vi.fn()
  const removeAfter = vi.fn()
  const removeError = vi.fn()
  const routes = new Map<string, { path: string }>()

  return {
    router: {
      beforeEach: vi.fn((hook: RouteHook) => {
        beforeHook = hook
        return removeBefore
      }),
      onError: vi.fn(() => removeError),
      afterEach: vi.fn((hook: RouteHook) => {
        afterHook = hook
        return removeAfter
      })
    },
    before: (path: string, fromPath = '/') => { const to = { path }; routes.set(path, to); return beforeHook(to, { path: fromPath }) },
    after: (path: string, fromPath = '/', failure?: unknown) => afterHook(routes.get(path) ?? { path }, { path: fromPath }, failure),
    removeBefore,
    removeAfter,
    removeError
  }
}

describe('route curtain targets', () => {
  it.each(['/gallery', '/about'])('targets %s', (path) => {
    expect(isCurtainTarget(path)).toBe(true)
  })

  it.each(['/', '/stories/winter-light', '/gallery/nature', '/about/me'])('does not target %s', (path) => {
    expect(isCurtainTarget(path)).toBe(false)
  })
})

describe('createRouteCurtainController', () => {
  it('releases the shorter about signature after2300ms',async()=>{
    const fake=createRouter(),wait=vi.fn(()=>Promise.resolve())
    createRouteCurtainController(fake.router,{nextFrame:()=>Promise.resolve(),wait,reducedMotion:()=>false})
    await fake.before('/about');await fake.after('/about')
    expect(wait).toHaveBeenCalledWith(2300)
  })
  it('lets gallery navigation continue immediately and runs its short signature over the destination', async () => {
    const fake = createRouter()
    const reveal = deferred()
    const wait = vi.fn(() => reveal.promise)
    const controller = createRouteCurtainController(fake.router, {
      nextFrame: () => Promise.resolve(),
      wait,
      reducedMotion: () => false
    })

    const navigation = fake.before('/gallery')
    await Promise.resolve()
    expect(wait).not.toHaveBeenCalled()
    await navigation
    expect(controller.phase.value).toBe('covered')

    const afterNavigation = Promise.resolve(fake.after('/gallery'))
    await Promise.resolve()
    expect(controller.phase.value).toBe('revealing')
    expect(wait).toHaveBeenCalledWith(1100)

    reveal.resolve()
    await afterNavigation
    expect(controller.phase.value).toBe('idle')
  })

  it('allows another destination immediately and ignores the earlier animation completion', async () => {
    const fake = createRouter(), oldReveal = deferred(), newReveal = deferred()
    const controller = createRouteCurtainController(fake.router, {
      nextFrame: () => Promise.resolve(),
      wait: vi.fn().mockImplementationOnce(() => oldReveal.promise).mockImplementationOnce(() => newReveal.promise),
      reducedMotion: () => false
    })
    await fake.before('/gallery')
    const first = fake.after('/gallery')
    await Promise.resolve()
    const second = fake.before('/about', '/gallery')
    await Promise.resolve()
    expect(controller.target.value).toBe('about')
    expect(controller.phase.value).toBe('covered')
    await second
    const after = fake.after('/about', '/gallery')
    await Promise.resolve()
    oldReveal.resolve(); await first
    expect(controller.target.value).toBe('about')
    expect(controller.phase.value).toBe('revealing')
    newReveal.resolve(); await after
    expect(controller.phase.value).toBe('idle')
  })

  it('clears failed navigation and lets a non-target navigation dismiss the signature', async () => {
    const fake = createRouter(), reveal = deferred()
    const controller = createRouteCurtainController(fake.router, { nextFrame: () => Promise.resolve(), wait: () => reveal.promise, reducedMotion: () => false })
    await fake.before('/gallery')
    await fake.after('/gallery', '/', new Error('navigation aborted'))
    expect(controller.phase.value).toBe('idle')
    await fake.before('/gallery')
    const after = fake.after('/gallery'); await Promise.resolve()
    await fake.before('/', '/gallery')
    expect(controller.phase.value).toBe('idle')
    reveal.resolve(); await after
    expect(controller.phase.value).toBe('idle')
  })

  it('dismisses pending artwork when the visitor returns to the still-active page', async () => {
    const fake = createRouter()
    const controller = createRouteCurtainController(fake.router, { nextFrame: () => Promise.resolve(), wait: () => Promise.resolve(), reducedMotion: () => false })
    await fake.before('/gallery')
    await fake.after('/', '/', new Error('duplicated current route'))
    expect(controller.phase.value).toBe('idle')
    await fake.after('/gallery', '/', new Error('cancelled pending route'))
    expect(controller.phase.value).toBe('idle')
  })

  it('does not delay navigation or animate when reduced motion is requested', async () => {
    const fake = createRouter()
    const nextFrame = vi.fn(() => Promise.resolve())
    const wait = vi.fn(() => Promise.resolve())
    const controller = createRouteCurtainController(fake.router, {
      nextFrame,
      wait,
      reducedMotion: () => true
    })

    await fake.before('/about')
    await fake.after('/about')

    expect(controller.phase.value).toBe('idle')
    expect(nextFrame).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('keeps non-target routes idle and unregisters both router hooks', async () => {
    const fake = createRouter()
    const wait = vi.fn(() => Promise.resolve())
    const controller = createRouteCurtainController(fake.router, {
      nextFrame: () => Promise.resolve(),
      wait,
      reducedMotion: () => false
    })

    await fake.before('/stories/winter-light')
    await fake.after('/stories/winter-light')
    expect(controller.phase.value).toBe('idle')
    expect(wait).not.toHaveBeenCalled()

    controller.dispose()
    expect(fake.removeBefore).toHaveBeenCalledOnce()
    expect(fake.removeAfter).toHaveBeenCalledOnce()
    expect(fake.removeError).toHaveBeenCalledOnce()
  })

  it('does not animate query-only navigation within a curtain target page', async () => {
    const fake = createRouter()
    const wait = vi.fn(() => Promise.resolve())
    const controller = createRouteCurtainController(fake.router, {
      nextFrame: () => Promise.resolve(),
      wait,
      reducedMotion: () => false
    })

    await fake.before('/gallery', '/gallery')
    await fake.after('/gallery', '/gallery')

    expect(controller.phase.value).toBe('idle')
    expect(wait).not.toHaveBeenCalled()
  })
})
