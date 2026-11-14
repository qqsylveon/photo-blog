// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest'
import {createHomeEntry,AMBIENT_READY} from '../../app/utils/home-entry'

const entries:ReturnType<typeof createHomeEntry>[]=[]
function entry(){const node=document.createElement('main');document.body.append(node);const control=createHomeEntry(node);entries.push(control);return {node,control}}
function ambient(){const canvas=document.createElement('canvas');canvas.dataset.ambientBackground='';document.body.append(canvas);return canvas}
afterEach(()=>{entries.splice(0).forEach(control=>control.dispose());document.body.innerHTML='';delete document.documentElement.dataset.homeEntry;vi.useRealTimers()})

describe('home entry lifecycle',()=>{
  it('waits for the actual ambient readiness event before releasing a pending entry',async()=>{
    const canvas=ambient(),{node,control}=entry()
    let ready=false;const waiting=control.whenAmbientReady().then(value=>{ready=value})
    await Promise.resolve();expect(ready).toBe(false)
    canvas.dataset.ambientReady='true';window.dispatchEvent(new Event(AMBIENT_READY));await waiting
    expect(ready).toBe(true);control.animate()
    expect(node.dataset.motionMode).toBe('animated')
    expect(document.documentElement.dataset.homeEntry).toBe('animated')
  })
  it('releases stalled backgrounds to static content and rejects a late readiness result',async()=>{
    vi.useFakeTimers();const canvas=ambient(),{node,control}=entry()
    const waiting=control.whenAmbientReady()
    await vi.advanceTimersByTimeAsync(4100)
    expect(await waiting).toBe(false)
    expect(node.dataset.motionMode).toBe('static');expect(control.pending()).toBe(false)
    canvas.dataset.ambientReady='true';window.dispatchEvent(new Event(AMBIENT_READY))
    expect(node.dataset.motionMode).toBe('static')
  })
  it('cancels abandoned waits without clearing the next page entry',async()=>{
    const canvas=ambient(),old=entry(),waiting=old.control.whenAmbientReady(),next=entry()
    old.control.dispose();expect(await waiting).toBe(false)
    expect(document.documentElement.dataset.homeEntry).toBe('pending')
    expect(next.control.pending()).toBe(true)
    canvas.dataset.ambientReady='true';window.dispatchEvent(new Event(AMBIENT_READY))
    expect(old.node.dataset.motionMode).toBe('preparing')
    next.control.static();expect(next.node.dataset.motionMode).toBe('static')
  })
})