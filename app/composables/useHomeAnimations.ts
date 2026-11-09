import { onMounted, onScopeDispose, type Ref } from 'vue'
import { createHomeEntry } from '../utils/home-entry'

export const useHomeAnimations = (root: Ref<HTMLElement | null>): void => {
  let disposed = false
  let entry: ReturnType<typeof createHomeEntry> | undefined
  let cleanup: (() => void) | undefined

  onMounted(async () => {
    const element = root.value
    if (!element || typeof window === 'undefined') return

    entry = createHomeEntry(element)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      entry.static()
      return
    }

    if (!entry.pending()) return
    try {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger')
      ])
      if (disposed || !root.value || !entry.pending() || !await entry.whenAmbientReady()) return

      gsap.registerPlugin(ScrollTrigger)

      const context = gsap.context(() => {
        const galleryInvitation = root.value?.querySelector<HTMLElement>('[data-home-motion="gallery-invitation"]')
        if (galleryInvitation) {
          gsap.timeline({
            defaults: { ease: 'power3.out', immediateRender: true, lazy: false },
            scrollTrigger: {
              trigger: galleryInvitation,
              start: 'top 78%',
              toggleActions: 'play reverse play reverse'
            }
          })
            .from(galleryInvitation.querySelectorAll('[data-home-motion="gallery-character"]'), { opacity: 0, yPercent: 115, duration: 1.95, stagger: { amount: 1.15 } }, .22)
            .from(galleryInvitation.querySelectorAll('[data-home-motion="gallery-copy"]'), { opacity: 0, y: 10, duration: 1.4, stagger: .2 }, 1.85)
        }

      }, root.value)

      cleanup = () => context.revert()
      entry.animate()
    } catch {
      cleanup?.()
      entry.static()
    }
  })

  onScopeDispose(() => {
    disposed = true
    cleanup?.()
    entry?.dispose()
  })
}
