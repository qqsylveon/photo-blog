import {describe,expect,it} from 'vitest'
import {shrimpRig} from '../../app/utils/ambient-shrimp'
describe('shrimp motion',()=>{
  it('keeps all leg and cheliped segments connected with fixed lengths throughout a gait',()=>{
    const length=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)
    for(let time=0;time<10000;time+=127){
      const rig=shrimpRig(time,1)
      expect(rig.legs).toHaveLength(8)
      expect(rig.claws).toHaveLength(2)
      for(const leg of rig.legs){expect(length(leg.root,leg.joint)).toBeCloseTo(13,5);expect(length(leg.joint,leg.tip)).toBeCloseTo(17,5)}
      for(const claw of rig.claws){expect(length(claw.root,claw.joint)).toBeCloseTo(30,5);expect(length(claw.joint,claw.tip)).toBeCloseTo(34,5);expect(claw.tip.x).toBeGreaterThan(45)}
    }
  })
  it('alternates contralateral feet and moves the joints without discontinuities',()=>{
    const a=shrimpRig(100,0),b=shrimpRig(116,0)
    expect(a.legs[0]!.tip.x-a.legs[0]!.root.x).not.toBeCloseTo(a.legs[1]!.tip.x-a.legs[1]!.root.x)
    for(let i=0;i<a.legs.length;i++){
      expect(Math.hypot(a.legs[i]!.tip.x-b.legs[i]!.tip.x,a.legs[i]!.tip.y-b.legs[i]!.tip.y)).toBeLessThan(1)
      expect(Math.hypot(a.legs[i]!.joint.x-b.legs[i]!.joint.x,a.legs[i]!.joint.y-b.legs[i]!.joint.y)).toBeLessThan(1)
    }
  })
})
