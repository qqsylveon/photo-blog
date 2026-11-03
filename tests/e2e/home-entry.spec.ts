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
})