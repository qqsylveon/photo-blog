import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { irisBundle } from './helpers/iris-bundle'
import { routeFixtureImages } from './helpers/fixture-images'

test.beforeEach(async ({ page }) => {
  await routeFixtureImages(page)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
})

test('browses the public journal across themes, gallery filters, photo links, and about', async ({ page }) => {
  // Allow cold development chunk compilation plus three intentional route curtains.
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /有些片刻没有故事/ })).toBeVisible()
  // Slow cold starts may intentionally release readable text through the bounded fallback.
  // The cold-popup tests verify animated first paint separately, with controlled script loading.
  await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode', /^(animated|static)$/)
  await expect(page.locator('[data-featured-photo-id]')).toHaveCount(0)
  const curtain = page.locator('[data-route-curtain]')
  await expect(curtain).toHaveAttribute('data-state', 'idle')

  for (const [name, theme] of [['深色', 'dark'], ['浅色', 'light'], ['跟随系统', 'system']] as const) {
    await page.getByRole('button', { name }).click()
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
    if (theme !== 'system') await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  }

  const galleryNavigation = page.getByRole('link', { name: /进入摄影集/ }).click()
  await expect(curtain).not.toHaveAttribute('data-state', 'idle')
  await galleryNavigation
  await expect(page).toHaveURL(/\/gallery$/)
  await expect(page.getByRole('heading', { name: '摄影集', level: 1 })).toBeVisible()
  await expect(curtain).toHaveAttribute('data-state', 'idle')
  await page.getByRole('link', { name: '自然' }).click()
  await expect(page).toHaveURL(/category=nature/)
  await expect(page.locator('[data-photo-id^="winter-"]')).toHaveCount(3)
  await expect(page.locator('[data-photo-id^="river-"]')).toHaveCount(0)

  await page.goto('/gallery?photo=winter-1')
  await expect(page).toHaveURL(/\/gallery\?photo=winter-1/)
  await expect(curtain).toHaveAttribute('data-state', 'idle')
  await expect(page.locator('[data-photo-id^="winter-"]')).toHaveCount(3)
  const imageAlts = await page.locator('main img').evaluateAll(images => images.map(image => image.getAttribute('alt')))
  expect(imageAlts.every(alt => alt !== null)).toBe(true)
  await expect(page.getByRole('dialog', { name: '照片详情' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0)
  await page.getByRole('button', { name: /关闭/ }).click()
  await expect(page.getByRole('dialog', { name: '照片详情' })).toBeHidden()

  const aboutNavigation = page.getByRole('link', { name: '关于我' }).click()
  await expect(curtain).not.toHaveAttribute('data-state', 'idle')
  await aboutNavigation
  await expect(page.getByRole('heading', { name: '关于我', level: 1 })).toBeVisible()
  const aboutTitle = await page.locator('.about-page h1').evaluate(node => parseFloat(getComputedStyle(node).fontSize))
  const aboutStatement = await page.locator('.about-page__statement').evaluate(node => parseFloat(getComputedStyle(node).fontSize))
  expect(aboutTitle).toBeGreaterThan(aboutStatement)
  await expect(page.locator('.about-page__body')).toContainText('骑行')
  await expect(page.locator('.about-page__body')).toContainText('谢谢你')
  await expect(page.locator('.about-page__footer')).toHaveCount(0)
  await expect(curtain).toHaveAttribute('data-state', 'idle')
})

test('opens legacy record bookmarks in the gallery', async ({ page }) => {
  await page.goto('/stories/winter-light')
  await expect(page).toHaveURL(/\/gallery$/)
  await expect(page.getByRole('heading', { name: '摄影集', level: 1 })).toBeVisible()
})

test('keeps all homepage content visible with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode', 'static')
  await expect(page.getByRole('heading', { name: /有些片刻没有故事/ })).toBeVisible()
  await expect(page.locator('.home-featured, .home-about')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /进入摄影集/ })).toBeVisible()
})

test('keeps the enlarged navigation and category labels readable on the viewport', async ({ page }) => {
  await page.goto('/gallery')
  const navigation = page.getByRole('navigation', { name: '主导航' })
  for (const name of ['首页', '摄影集', '关于我']) {
    const link = navigation.getByRole('link', { name, exact: true })
    await expect(link).toHaveCSS('font-size', '20px')
    await expect(link).toBeInViewport()
  }
  await expect(page.locator('[data-category="nature"]')).toHaveCSS('font-size', '18px')
  expect(await page.locator('.gallery-heading h1').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(104)
  expect(await page.locator('.gallery-heading > p').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(18)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('keeps the homepage to its quotation and larger gallery entrance', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  await expect(page.locator('.home-page > *').first()).toHaveClass('gallery-invitation')
  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.locator('.home-hero')).toHaveCount(0)
  await expect(page.locator('.home-page > section')).toHaveCount(1)
  await expect(page.locator('.home-featured, .home-about, .gallery-invitation__note')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /进入摄影集/ })).toHaveCSS('font-size', '20px')
  await expect(page.locator('body')).not.toContainText(/\u676d\u5dde|hang[\s_-]*zhou/i)
  await expect(page.locator('.site-footer__registration')).toHaveText('备案信息待更新')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('places the shared footer at the document bottom on home, gallery and about', async ({ page, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 1236, height: 1244 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const path of ['/', '/gallery', '/about']) {
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
    const geometry = await page.locator('.site-footer').evaluate(node => ({ bottom: node.getBoundingClientRect().bottom + scrollY, documentBottom: Math.max(document.documentElement.scrollHeight, innerHeight), position: getComputedStyle(node).position }))
    expect(Math.abs(geometry.bottom - geometry.documentBottom)).toBeLessThanOrEqual(2)
    expect(geometry.position).not.toBe('fixed')
  }
})

test('opens the gallery from a closed iris below navigation while ambient motion continues', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Keep the iris closed until the destination is ready, then reveal the photographs progressively.
  await page.evaluate(() => {
    const router = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router
    let first = true
    router.beforeResolve(async (to: { path: string }) => {
      if (to.path === '/gallery' && first) {
        first = false
        await new Promise<void>(resolve => { (window as any).__releaseGalleryEntry = resolve })
      }
    })
  })
  for (const theme of ['深色', '浅色']) {
    await page.getByRole('button', { name: theme }).click()
    // Observe the transient phase inside the browser, before protocol calls or screenshots
    // can outlast it on a busy machine. This still requires an actual revealing transition.
    await page.evaluate(() => {
      const scene = document.querySelector('.aperture-scene')!
      scene.removeAttribute('data-observed-reveal')
      const observer = new MutationObserver(() => {
        if (scene.getAttribute('data-aperture-phase') === 'revealing') {
          scene.setAttribute('data-observed-reveal', 'true')
          observer.disconnect()
        }
      })
      observer.observe(scene, { attributes: true, attributeFilter: ['data-aperture-phase'] })
    })
    const navigation = page.getByRole('link', { name: /进入摄影集/ }).click()
    const iris = page.locator('.aperture-scene')
    await expect(iris).toBeVisible()
    const faceBrightness = await iris.evaluate(node => { const hex=getComputedStyle(node).getPropertyValue('--iris-face').trim(); return [1,3,5].reduce((sum,index)=>sum+parseInt(hex.slice(index,index+2),16),0) })
    if (theme === '深色') expect(faceBrightness).toBeLessThan(220)
    else expect(faceBrightness).toBeGreaterThan(600)
    await expect(page.locator('.camera-scene')).toHaveCount(0)
    await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running', 'true')
    const header = page.locator('.site-header'), curtain = page.locator('[data-route-curtain]')
    expect((await curtain.boundingBox())!.y).toBeGreaterThanOrEqual((await header.boundingBox())!.height)
    await expect(curtain).toHaveCSS('pointer-events', 'none')
    if (theme === '深色') {
      await expect(iris).toHaveAttribute('data-aperture-phase', 'covered')
      await page.waitForTimeout(1800)
      await expect(iris).toHaveAttribute('data-aperture-phase', 'covered')
      const painted = await sharp(await iris.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const shades = [.15, .45, .8].flatMap(x => [.15, .45, .8].map(y => painted.data[(Math.floor(y * painted.info.height) * painted.info.width + Math.floor(x * painted.info.width)) * painted.info.channels]!))
      expect(Math.max(...shades) - Math.min(...shades)).toBeGreaterThan(4)
      if (process.env.IRIS_VISUAL) await page.screenshot({ path: '.superpowers/iris-preview/live-closed.png' })
      await page.evaluate(() => { (window as any).__releaseGalleryEntry() })
    }
    await navigation
    await expect(page).toHaveURL(/\/gallery$/)
    await expect(iris).toHaveAttribute('data-observed-reveal', 'true')
    if (process.env.IRIS_VISUAL) {
      await iris.evaluate(node => node.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 380 }))
      await page.screenshot({ path: `.superpowers/iris-preview/live-${theme}-380.png` })
    }
    await expect(page.getByRole('heading', { name: '摄影集', exact: true })).toBeVisible()
    await page.locator('[data-photo-id="winter-1"]').click()
    await expect(page.getByRole('dialog', { name: '照片详情' })).toBeVisible()
    await page.getByRole('button', { name: /关闭/ }).click()
    await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'idle')
    await expect(iris).toBeHidden()
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '首页', exact: true }).click()
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '关于我', exact: true }).click()
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'revealing')
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running', 'true')
  await expect(page.locator('.cycling-ambient')).toBeVisible()
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state', 'idle')
  expect(errors).toEqual([])
})

test('rasterized iris remains closed, opens centrally and clears every supported viewport', async ({page}) => {
  test.setTimeout(60_000)
  await page.addScriptTag({content:await irisBundle()})
  const results=await page.evaluate(async()=>{
    const module=(window as any).IrisTest
    const results=[],disposedPixels=[]
    for(const mode of ['auto','2d']){
      const renderer=module.createIrisRenderer(mode)
      if(!renderer)throw new Error('Canvas renderer unavailable')
      const canvas=renderer.canvas as HTMLCanvasElement
      document.body.append(canvas)
      try{
        const gl=renderer.kind==='webgl'?canvas.getContext('webgl'):null
        const ctx=gl?null:canvas.getContext('2d')!
        for(const [w,h] of [[3840,2088],[1000,928],[393,788]]){
          renderer.resize(w,h,3)
          const frame=(time:number,palette:any)=>{
            renderer.draw(time,palette)
            let pixels:ArrayLike<number>
            if(gl){const data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);pixels=data}
            else pixels=ctx!.getImageData(0,0,canvas.width,canvas.height).data
            const pixel=(x:number,y:number)=>{const px=Math.min(canvas.width-1,Math.floor(x*canvas.width)),py=Math.min(canvas.height-1,Math.floor(y*canvas.height));return ( (gl?canvas.height-1-py:py)*canvas.width+px)*4}
            const opaque=(x:number,y:number)=>pixels[pixel(x,y)+3]!>220
            const points=[.01,.25,.5,.75,.99].flatMap(x=>[.01,.25,.5,.75,.99].map(y=>opaque(x,y)))
            const rim=Array.from({length:72},(_,i)=>opaque(.5+Math.cos(i*Math.PI/36)*.46,.5+Math.sin(i*Math.PI/36)*.46))
            const shades=[.15,.45,.8].flatMap(x=>[.15,.45,.8].map(y=>pixels[pixel(x,y)]!))
            return{center:opaque(.5,.5),covered:points.filter(Boolean).length,rim:rim.every(Boolean),variation:Math.max(...shades)-Math.min(...shades)}
          }
          for(const palette of [{tip:'#b5c7bf',face:'#dce5df',edge:'#bfcfc7'},{tip:'#14241d',face:'#35443b',edge:'#1d2d24'}]){
            const closed=frame(0,palette),early=frame(180/1100,palette),middle=frame(.5,palette),open=frame(1,palette)
            results.push({kind:renderer.kind,pixels:canvas.width*canvas.height,closed,early,middle,open})
          }
        }
      }finally{renderer.dispose();renderer.dispose();renderer.resize(3840,2160,3);renderer.draw(.5);disposedPixels.push(canvas.width*canvas.height)}
    }
    return {frames:results,disposedPixels}
  })
  expect(results.disposedPixels).toEqual([1,1])
  for(const result of results.frames){
    expect(result.pixels).toBeLessThanOrEqual(result.kind==='webgl'?1500000:650000)
    expect(result.closed.center).toBe(true);expect(result.closed.covered,JSON.stringify(result)).toBe(25);expect(result.closed.variation).toBeGreaterThan(4)
    expect(result.early.rim).toBe(true)
    expect(result.middle.center).toBe(false);expect(result.middle.covered).toBeGreaterThan(0);expect(result.middle.covered).toBeLessThan(25)
    expect(result.open.covered).toBe(0)
  }
})

test('reuses the iris canvas across navigation and falls back after GPU context loss',async({page})=>{
  const canvas=page.locator('.aperture-canvas')
  await expect(canvas).toHaveCount(1)
  const original=await canvas.elementHandle()
  await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'摄影集',exact:true}).click()
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state','idle')
  expect(await canvas.evaluate((node,first)=>node===first,original)).toBe(true)
  await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'首页',exact:true}).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(()=>{const router=(document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router;router.beforeResolve(async(to:{path:string})=>{if(to.path==='/gallery')await new Promise(resolve=>setTimeout(resolve,1400))})})
  const navigation=page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'摄影集',exact:true}).click()
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state','covered')
  const lost=await canvas.evaluate((node:HTMLCanvasElement)=>{if(node.dataset.renderer!=='webgl')return false;node.getContext('webgl')!.getExtension('WEBGL_lose_context')?.loseContext();return true})
  if(lost) await page.waitForTimeout(60)
  await expect(canvas).toHaveAttribute('data-renderer','2d')
  expect(await canvas.evaluate((node:HTMLCanvasElement)=>node.width*node.height)).toBeLessThanOrEqual(650000)
  expect(await canvas.evaluate((node:HTMLCanvasElement)=>node.width*node.height)).toBeGreaterThan(100000)
  await navigation
  await expect(page.locator('[data-route-curtain]')).toHaveAttribute('data-state','idle')
})
test('switches decorative backgrounds without blocking navigation and persists the visitor choice', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const toggle = page.getByRole('button', { name: '背景特效', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running', 'true')
  await page.getByRole('button', { name: '深色', exact: true }).click()
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-scene', 'night')
  await page.getByRole('button', { name: '浅色', exact: true }).click()
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-scene', 'pond')
  await page.mouse.move(80, 330)
  await page.mouse.move(260, 460, { steps: 12 })
  await page.waitForTimeout(120)
  await toggle.click()
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running', 'false')
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running', 'true')
  expect(await page.locator('[data-ambient-background]').evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none')
  expect(errors).toEqual([])
})

test('uses more of a large monitor and lets categories scroll clear of photographs', async ({ page, isMobile }) => {
  if (!isMobile) {
    await page.setViewportSize({ width: 2560, height: 1440 })
    await page.goto('/about')
    await expect(page.locator('html')).toHaveAttribute('data-app-ready','true')
    expect((await page.locator('.about-page').boundingBox())!.width).toBeGreaterThanOrEqual(1800)
    expect(await page.locator('.about-page__body').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(20)
    expect(await page.locator('[data-ambient-background]').evaluate((node: HTMLCanvasElement) => node.width * node.height)).toBeLessThanOrEqual(2510000)
  }
  await page.goto('/gallery')
  const grid = page.locator('.gallery-grid')
  if (!isMobile) expect((await grid.boundingBox())!.width).toBeGreaterThanOrEqual(1800)
  const filter = page.locator('.category-filter')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true')
  await filter.scrollIntoViewIfNeeded()
  const y = await filter.evaluate(node => node.getBoundingClientRect().bottom + scrollY + 500)
  await page.mouse.move(300,600)
  // Damping and mobile emulation need not turn a wheel delta into equal CSS pixels.
  await page.mouse.wheel(0,Math.max(2400,y))
  await expect.poll(() => filter.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
