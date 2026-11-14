import {expect,test,type BrowserContext,type Page} from '@playwright/test'
import {defaultSiteCopy} from '../../shared/notebook'

async function adminSiteLink(page:Page){
  // Authenticate only the source tab's UI. Never create accounts or sessions on
  // the backend: the configured port may belong to an already-running server.
  await page.route('**/api/admin/**',async route=>{
    if(route.request().method()!=='GET'){await route.abort('blockedbyclient');return}
    const path=new URL(route.request().url()).pathname
    const body=path.endsWith('/auth/me')?{id:'preview-only',username:'preview-owner'}
      :path.endsWith('/auth/state')?{initialized:true,canSetup:false}
      :path.endsWith('/site-content')?defaultSiteCopy
      :{heroMode:'manual',heroPhotoId:null,featuredPhotoIds:[],photos:[]}
    await route.fulfill({json:body})
  })
  // Enter via an unauthenticated SSR page, then let the real client middleware
  // consume the mocked session before mounting the actual admin layout/link.
  await page.goto('/admin/login')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true')
  await page.evaluate(async()=>{
    const app=(document.querySelector('#__nuxt') as any).__vue_app__
    await app.config.globalProperties.$router.push('/admin/settings')
  })
  await expect(page.getByRole('link',{name:'查看网站 ↗',exact:true})).toBeVisible()
}
async function holdScripts(context:BrowserContext,source?:Page){
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  await context.route('**/*',async route=>{
    if(route.request().resourceType()==='script'&&route.request().frame().page()!==source)await gate
    await route.continue()
  })
  return release
}

test('preserves home content positions in the outgoing about snapshot',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready','true')
  const selectors=['.gallery-invitation h1','.text-link--large','.site-footer']
  const before=await page.evaluate(selectors=>{
    // The geometry assertion concerns layout, independently of the idle breathing transform.
    document.querySelector<HTMLElement>('.gallery-invitation h1')!.style.animation='none'
    const router=(document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router
    router.beforeResolve((to:{path:string})=>to.path==='/about'?new Promise<void>(resolve=>{(window as any).__releaseSnapshotLayout=resolve}):undefined)
    ;(window as any).__snapshotLayoutAfterSwap=[]
    const shell=document.querySelector('.site-shell')!
    const observer=new MutationObserver(()=>{
      const copy=document.querySelector('.cycling-source-content')
      if(shell.classList.contains('site-shell--notebook')&&copy){
        ;(window as any).__snapshotLayoutAfterSwap=selectors.map(selector=>copy.querySelector(selector)!.getBoundingClientRect().top)
        observer.disconnect()
      }
    })
    observer.observe(shell,{attributes:true,attributeFilter:['class']})
    return selectors.map(selector=>document.querySelector(selector)!.getBoundingClientRect().top)
  },selectors)
  const navigation=page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'关于我',exact:true}).click()
  try{
    await expect(page.locator('.cycling-source-content')).toBeVisible()
    await page.waitForFunction(()=>typeof (window as any).__releaseSnapshotLayout==='function')
    const after=await page.locator('.cycling-source-content').evaluate((root,selectors)=>selectors.map(selector=>root.querySelector(selector)!.getBoundingClientRect().top),selectors)
    after.forEach((top,index)=>expect(Math.abs(top-before[index]!),'snapshot layout must not jump: '+selectors[index]).toBeLessThanOrEqual(1))
  }finally{await page.evaluate(()=>{(window as any).__releaseSnapshotLayout?.()});await navigation}
  await expect.poll(()=>page.evaluate(()=>(window as any).__snapshotLayoutAfterSwap.length)).toBe(3)
  const afterSwap=await page.evaluate(()=>(window as any).__snapshotLayoutAfterSwap as number[])
  afterSwap.forEach((top,index)=>expect(Math.abs(top-before[index]!),'snapshot must stay stable after target layout swap').toBeLessThanOrEqual(1))
})

test('keeps the painted background visible during a resize before the next animation frame',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('photo-journal-theme','dark'))
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto('/')
  await expect(page.locator('[data-ambient-background]')).toHaveCSS('opacity','0.85')
  const result=await page.evaluate(async()=>{
    const native=requestAnimationFrame,captured:FrameRequestCallback[]=[]
    window.requestAnimationFrame=callback=>{captured.push(callback);return 0}
    try{
      await new Promise<void>(resolve=>native(()=>native(()=>resolve())))
      const canvas=document.querySelector<HTMLCanvasElement>('[data-ambient-background]')!,ctx=canvas.getContext('2d')!
      const painted=()=>{const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!>0)return true;return false}
      const before=painted()
      canvas.style.width='calc(100% - 1px)'
      window.dispatchEvent(new Event('resize'))
      return {before,after:painted()}
    }finally{window.requestAnimationFrame=native;captured.forEach(callback=>native(callback))}
  })
  expect(result).toEqual({before:true,after:true})
})

for(const theme of ['light','dark'])test('crossfades a themed first-paint atmosphere into the live scene in '+theme,async({page,context})=>{
  await context.addInitScript(value=>{
    localStorage.setItem('photo-journal-theme',value)
    const frames:{primer:number;canvas:number;painted:boolean}[]=[]
    ;(window as any).__ambientArrivalFrames=frames
    const sample=()=>{
      const primer=document.querySelector('[data-ambient-primer]'),canvas=document.querySelector('[data-ambient-background]')
      if(primer&&canvas&&frames.length<3600)frames.push({primer:Number(getComputedStyle(primer).opacity),canvas:Number(getComputedStyle(canvas).opacity),painted:canvas.getAttribute('data-ambient-ready')==='true'})
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  },theme)
  const release=await holdScripts(context)
  try{
    await page.goto('/',{waitUntil:'commit'})
    const primer=page.locator('[data-ambient-primer]'),canvas=page.locator('[data-ambient-background]')
    await expect(primer).toBeVisible({timeout:2000})
    await expect(primer.locator(`[data-primer-scene="${theme}"]`)).toBeVisible()
    await expect(primer).toHaveCSS('opacity','1')
    await expect(canvas).toHaveCSS('opacity','0')
    release()
    await expect(canvas).toHaveAttribute('data-ambient-ready','true')
    await expect(canvas).toHaveCSS('opacity','0.85')
    await expect(primer).toHaveCSS('opacity','0')
    await expect(primer.locator('.ambient-primer__ripples')).toHaveCSS('animation-play-state','paused')
    await expect(canvas).toHaveCSS('animation-duration','0.9s')
    await expect(canvas).toHaveCSS('animation-timing-function','cubic-bezier(0.22, 0.61, 0.36, 1)')
    const frames=await page.evaluate(()=>(window as any).__ambientArrivalFrames as {primer:number;canvas:number;painted:boolean}[])
    // CSS opacity runs in the compositor even when cold module work delays JS RAF callbacks.
    expect(frames.some(frame=>frame.canvas>.03&&frame.canvas<.8),'background should fade, not pop into view; samples='+frames.length+' tail='+JSON.stringify(frames.slice(-6))).toBe(true)
    expect(frames.some(frame=>frame.canvas>0&&!frame.painted),'never reveal an unpainted canvas').toBe(false)
    expect(frames.some(frame=>frame.primer>.1&&frame.canvas>.1),'primer and live scene should overlap during the handoff').toBe(true)
  }finally{release()}
})

test('respects disabled effects before client scripts load',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('photo-journal-ambient','off'))
  const release=await holdScripts(context)
  try{
    await page.goto('/',{waitUntil:'commit'})
    const primer=page.locator('[data-ambient-primer]')
    await primer.waitFor({state:'attached'})
    await expect(page.getByRole('navigation',{name:'主导航'})).toBeVisible()
    await expect(primer).toBeHidden()
    release()
    await expect(page.locator('html')).toHaveAttribute('data-app-ready','true')
    await expect(primer).toBeHidden()
    await page.getByRole('button',{name:'背景特效'}).click()
    await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running','true')
    await expect(page.locator('[data-ambient-background]')).toHaveCSS('opacity','0.85')
  }finally{release()}
})

for(const phase of ['settled','mid-arrival'])test('preserves the ambient blend when opening about from '+phase,async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto('/')
  await expect(page.locator('[data-ambient-background]')).toHaveCSS('opacity','0.85')
  const before=await page.evaluate(phase=>{
    const primer=document.querySelector<HTMLElement>('[data-ambient-primer]')!,canvas=document.querySelector<HTMLElement>('[data-ambient-background]')!
    if(phase==='mid-arrival')for(const element of [primer,canvas])for(const animation of element.getAnimations()){animation.pause();animation.currentTime=350}
    return {primer:Number(getComputedStyle(primer).opacity),canvas:Number(getComputedStyle(canvas).opacity)}
  },phase)
  // Keep the outgoing page in place while inspecting the actual snapshot composition.
  await page.evaluate(()=>{
    const router=(document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router
    router.beforeResolve((to:{path:string})=>to.path==='/about'?new Promise<void>(resolve=>{(window as any).__releaseAboutBlend=resolve}):undefined)
  })
  const navigation=page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'关于我',exact:true}).click()
  try{
    await expect(page.locator('.cycling-source')).toBeVisible()
    await expect.poll(async()=>Number(await page.locator('.cycling-ambient').evaluate(node=>getComputedStyle(node).opacity))).toBeCloseTo(before.canvas,2)
    const mirroredPrimer=page.locator('.cycling-source .ambient-primer')
    await expect(mirroredPrimer).toHaveCount(1)
    expect(Number(await mirroredPrimer.evaluate(node=>getComputedStyle(node).opacity))).toBeCloseTo(before.primer,2)
    await expect(page.locator('.cycling-source-content [data-ambient-primer]')).toHaveCount(0)
  }finally{
    await page.evaluate(()=>{(window as any).__releaseAboutBlend?.()})
    await navigation
  }
})

test('previews the header concurrently without changing administrator state',async({page,context})=>{
  // Any accidental API-client auth write is refused by the server's origin policy.
  const api=page.request,original=api.post
  api.post=(url,options)=>original.call(api,url,{...options,headers:{...options?.headers,...(String(url).includes('/api/admin/auth/')?{'sec-fetch-site':'cross-site'}:{})}})
  const before=await (await page.request.get('/api/admin/auth/state')).json()
  const other=await context.newPage()
  try{
    await Promise.all([adminSiteLink(page),adminSiteLink(other)])
    const after=await (await page.request.get('/api/admin/auth/state')).json()
    expect(after.initialized).toBe(before.initialized)
    await expect(page.getByRole('link',{name:'查看网站 ↗',exact:true})).toBeVisible()
    await expect(other.getByRole('link',{name:'查看网站 ↗',exact:true})).toBeVisible()
  }finally{api.post=original;await other.close()}
})
for(const theme of ['light','dark'])test('opens the admin website link without a static flash in '+theme,async({page,context})=>{
  await context.addInitScript(value=>localStorage.setItem('photo-journal-theme',value),theme)
  await adminSiteLink(page)
  await context.addInitScript(()=>{
    const frames:{visible:boolean;painted:boolean;note:string}[]=[]
    ;(window as any).__homeEntryFrames=frames
    const sample=()=>{
      const glyph=document.querySelector('.home-glyph'),canvas=document.querySelector<HTMLCanvasElement>('[data-ambient-background]')
      if(glyph&&frames.length<600){
        const style=getComputedStyle(glyph)
        frames.push({visible:style.visibility!=='hidden'&&parseFloat(style.opacity)>.05,painted:canvas?.dataset.ambientReady==='true',note:JSON.stringify({time:performance.now(),opacity:style.opacity,visibility:style.visibility,transform:style.transform,mode:document.querySelector('[data-home-motion-root]')?.getAttribute('data-motion-mode'),entry:document.documentElement.dataset.homeEntry})})
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  const release=await holdScripts(context,page)
  let front:Page|undefined
  try{
    const opened=page.waitForEvent('popup')
    await page.getByRole('link',{name:'查看网站 ↗',exact:true}).click()
    front=await opened
    const glyph=front.locator('.home-glyph').first()
    await glyph.waitFor({state:'attached'})
    await expect(glyph).toBeHidden({timeout:1500})
    release()
    await expect(front.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode','animated')
    const background=front.locator<HTMLCanvasElement>('[data-ambient-background]')
    await expect(background).toHaveAttribute('data-running','true')
    await expect(background).toHaveAttribute('data-ambient-ready','true')
    // First text reveal may only happen after an actual background frame exists.
    expect(await background.evaluate(node=>{
      const ctx=node.getContext('2d')!
      const pixels=ctx.getImageData(0,0,node.width,node.height).data
      for(let i=3;i<pixels.length;i+=4)if(pixels[i]!>0)return true
      return false
    })).toBe(true)
    await expect(front.locator('html')).toHaveAttribute('data-theme',theme)
    await expect(glyph).toBeVisible()
    await expect.poll(()=>front!.evaluate(()=>((window as any).__homeEntryFrames as {visible:boolean}[]).filter(frame=>frame.visible).length)).toBeGreaterThan(30)
    const frames=await front.evaluate(()=>(window as any).__homeEntryFrames as {visible:boolean;painted:boolean}[])
    expect(frames.some(frame=>frame.visible&&!frame.painted)).toBe(false)
    const first=frames.findIndex(frame=>frame.visible)

    expect(frames.slice(first).every(frame=>frame.visible),'home text must not rewind: '+JSON.stringify(frames.filter((frame,i)=>i===0||frame.visible!==frames[i-1]!.visible))).toBe(true)
  }finally{release();await front?.close()}
})

test('fails open to readable SSR text without restarting when delayed scripts finally load',async({page,context})=>{
  const release=await holdScripts(context)
  try{
    await page.goto('/',{waitUntil:'commit'})
    const glyph=page.locator('.home-glyph').first()
    await glyph.waitFor({state:'attached'})
    await expect(glyph).toBeHidden({timeout:1200})
    await expect(glyph).toBeVisible({timeout:6500})
    release()
    await expect(page.locator('html')).toHaveAttribute('data-app-ready','true')
    await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode','static')
    await expect(glyph).toBeVisible()
    expect(await glyph.evaluate(node=>getComputedStyle(node).opacity)).toBe('1')
  }finally{release()}
})

test('keeps homepage text readable without JavaScript',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,javaScriptEnabled:false})
  try{
    const page=await context.newPage();await page.goto('/')
    await expect(page.locator('[data-ambient-primer]')).toBeVisible()
    await expect(page.locator('.home-glyph').first()).toBeVisible()
    await expect(page.getByRole('link',{name:/进入摄影集/})).toBeVisible()
  }finally{await context.close()}
})

test('honours reduced motion and does not wait for disabled background effects',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('photo-journal-ambient','off'))
  await page.goto('/')
  await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode','animated')
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running','false')
  await expect(page.locator('.home-glyph').first()).toBeVisible()
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload()
  await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode','static')
  await expect(page.locator('.home-glyph').first()).toBeVisible()
  // The saved opt-out still wins when reduced motion is requested.
  await expect(page.locator('[data-ambient-primer]')).toBeHidden()
  await page.getByRole('button',{name:'背景特效'}).click()
  await expect(page.locator('[data-ambient-primer]')).toHaveCSS('opacity','1')
  await expect(page.locator('.ambient-primer__ripples')).toHaveCSS('animation-name','none')
})
test('keeps content readable when the animation dependency fails',async({page,context})=>{
  let blocked=false
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await context.route('**/*',async route=>{
    if(route.request().resourceType()==='script'&&route.request().url().includes('gsap')){blocked=true;await route.abort('failed')}
    else await route.continue()
  })
  await page.goto('/')
  await expect.poll(()=>blocked).toBe(true)
  await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode','static')
  await expect(page.locator('.home-glyph').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('starts the text even when Canvas is unavailable',async({page,context})=>{
  await context.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext=function(type:string,...args:any[]){return type==='2d'?null:original.apply(this,[type,...args] as any)} as typeof original
  })
  await page.goto('/')
  await expect(page.locator('[data-home-motion-root]')).toHaveAttribute('data-motion-mode','animated')
  await expect(page.locator('.home-glyph').first()).toBeVisible()
  await expect(page.locator('[data-ambient-background]')).toHaveAttribute('data-running','false')
  await expect(page.locator('[data-ambient-primer]')).toHaveCSS('opacity','1')
})
