import { expect, test } from '@playwright/test'

test('keeps the rider and curved reveal moving without application animation callbacks', async ({ page, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 2560, height: 1440 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '关于我', exact: true }).click()
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'revealing')
  const result = await page.evaluate(async () => {
    const native = requestAnimationFrame, held: FrameRequestCallback[] = []
    window.requestAnimationFrame = callback => { held.push(callback); return -held.length }
    try {
      // Drain an already-queued application callback before measuring independent motion.
      await new Promise<void>(resolve => native(() => native(() => resolve())))
      const rider = document.querySelector('.cycling-rider')!, source = document.querySelector('.cycling-source')!
      const content = document.querySelector('.cycling-source-content')!
      const before = [rider, source, content].map(node => node.getBoundingClientRect().left)
      await new Promise(resolve => setTimeout(resolve, 320))
      const after = [rider, source, content].map(node => node.getBoundingClientRect().left)
      return { before, after, width: innerWidth }
    } finally {
      window.requestAnimationFrame = native
      held.forEach(callback => native(callback))
    }
  })
  expect(result.before[0]! - result.after[0]!).toBeGreaterThan(result.width * .08)
  expect(result.before[1]! - result.after[1]!).toBeGreaterThan(result.width * .08)
  expect(Math.abs(result.before[2]! - result.after[2]!)).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'idle')
  await expect(page.locator('.cycling-rider')).toHaveCount(0)
})

test('covers the outgoing page while pending and clears a resized viewport', async ({ page, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 2560, height: 1440 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/gallery')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  await page.evaluate(() => {
    const router = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router
    router.beforeResolve((to: { path: string }) => to.path === '/about' ? new Promise<void>(resolve => { (window as any).__releaseCyclingResize = resolve }) : undefined)
  })
  const navigation = page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '关于我', exact: true }).click()
  try {
    await expect(page.locator('.cycling-source')).toBeVisible()
    await page.waitForFunction(() => typeof (window as any).__releaseCyclingResize === 'function')
    const coverage = await page.locator('.cycling-source').boundingBox()
    expect(coverage!.x).toBeLessThanOrEqual(0)
    expect(coverage!.x + coverage!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width)
  } finally { await page.evaluate(() => (window as any).__releaseCyclingResize?.()) }
  await navigation
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'revealing')
  await page.setViewportSize(isMobile ? { width: 320, height: 640 } : { width: 760, height: 740 })
  await expect.poll(() => page.locator('.cycling-source-content').evaluate(node => Math.abs(node.getBoundingClientRect().left))).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'idle')
  await expect(page.locator('.cycling-rider')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '关于我', exact: true })).toBeVisible()
})
