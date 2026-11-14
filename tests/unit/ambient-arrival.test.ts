// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest'
import {createAmbientRenderer} from '../../app/utils/ambient-renderer'
const scenes=vi.hoisted(()=>({pond:{resize:vi.fn(),reset:vi.fn(),interact:vi.fn(),draw:vi.fn()},night:{draw:vi.fn()}}))
vi.mock('../../app/utils/ambient-pond',()=>({createPondScene:()=>scenes.pond}))
vi.mock('../../app/utils/ambient-night',()=>({createNightScene:()=>scenes.night}))
beforeEach(()=>vi.clearAllMocks())
function renderer(){return createAmbientRenderer({getContext:()=>({clearRect:vi.fn(),setTransform:vi.fn()}),getBoundingClientRect:()=>({width:1440,height:900,left:0,top:0})} as unknown as HTMLCanvasElement)}

it('unfolds from the first rendered frame instead of the page clock and preserves progress on resize',()=>{
  const scene=renderer()
  scene.draw(50000)
  expect(scenes.pond.draw).toHaveBeenLastCalledWith(50000,0)
  scene.draw(50900)
  expect(scenes.pond.draw).toHaveBeenLastCalledWith(50900,900)
  scene.resize();scene.draw(51800)
  expect(scenes.pond.draw).toHaveBeenLastCalledWith(51800,1800)
})
it('restarts scene arrival on resume or an actual theme change, not routine synchronization',()=>{
  const scene=renderer()
  scene.draw(100);scene.setTheme('pond');scene.draw(600)
  expect(scenes.pond.draw).toHaveBeenLastCalledWith(600,500)
  scene.setTheme('night');scene.draw(1000)
  expect(scenes.night.draw).toHaveBeenLastCalledWith(1000,1440,900,0)
  scene.clear();scene.draw(5000)
  expect(scenes.night.draw).toHaveBeenLastCalledWith(5000,1440,900,0)
})
