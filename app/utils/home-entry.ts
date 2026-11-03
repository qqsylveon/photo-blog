const ENTRY_READY='journal:home-entry-ready'
const ENTRY_EXPIRED='journal:home-entry-expired'
export const AMBIENT_READY='journal:ambient-ready'
const MAX_WAIT=4000

// Opt in before SSR paints; a failed client must leave the server copy readable.
export const homeEntryBootstrap=`(function(){try{if(location.pathname!=='/'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;var h=document.documentElement;h.dataset.homeEntry='pending';var done=function(){clearTimeout(t);removeEventListener('${ENTRY_READY}',done)},t=setTimeout(function(){done();if(h.dataset.homeEntry==='pending'){h.dataset.homeEntry='static';dispatchEvent(new Event('${ENTRY_EXPIRED}'))}},${MAX_WAIT});addEventListener('${ENTRY_READY}',done)}catch(e){}})()`

let owner:symbol|undefined
export function createHomeEntry(element:HTMLElement){
  const token=Symbol(),html=document.documentElement
  owner=token
  let active=html.dataset.homeEntry!=='static',alive=true,timer:ReturnType<typeof setTimeout>|undefined
  let cancelAmbient=()=>{}
  const current=()=>alive&&owner===token
  function finish(mode:'animated'|'static'){
    if(!current())return
    active=false;clearTimeout(timer);cancelAmbient()
    element.dataset.motionMode=mode;html.dataset.homeEntry=mode
    window.dispatchEvent(new Event(ENTRY_READY))
  }
  const expire=()=>finish('static')
  window.addEventListener(ENTRY_EXPIRED,expire)
  if(active){element.dataset.motionMode='preparing';html.dataset.homeEntry='pending';timer=setTimeout(expire,MAX_WAIT)}
  else finish('static')
  function whenAmbientReady():Promise<boolean>{
    const canvas=document.querySelector<HTMLCanvasElement>('[data-ambient-background]')
    if(!canvas||canvas.dataset.ambientReady==='true')return Promise.resolve(current()&&active)
    return new Promise(resolve=>{
      const done=(ready:boolean)=>{window.removeEventListener(AMBIENT_READY,onReady);cancelAmbient=()=>{};resolve(ready)}
      const onReady=()=>{if(canvas.dataset.ambientReady==='true')done(current()&&active)}
      cancelAmbient=()=>done(false)
      window.addEventListener(AMBIENT_READY,onReady)
      onReady()
    })
  }
  function dispose(){
    clearTimeout(timer);cancelAmbient();window.removeEventListener(ENTRY_EXPIRED,expire)
    if(current()){delete html.dataset.homeEntry;owner=undefined;window.dispatchEvent(new Event(ENTRY_READY))}
    alive=false;active=false
  }
  return {pending:()=>current()&&active,whenAmbientReady,animate:()=>finish('animated'),static:expire,dispose}
}