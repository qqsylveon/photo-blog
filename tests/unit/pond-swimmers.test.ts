import {describe,expect,it} from 'vitest'
import {createPondSwimmers} from '../../app/utils/pond-swimmers'

const angleDelta=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))

describe('independent pond wandering',()=>{
  it.each([[393,852,4],[844,393,6],[2560,1440,6]])('roams through the centre and full height at %ix%i without sustained piles',(width,height,count)=>{
    const pond=createPondSwimmers(417),ranges=Array.from({length:count!},()=>({min:1,max:0})),overlapRuns=new Map<string,number>()
    let centreVisits=0,longestOverlap=0,opposingHeadings=0,valid=true
    for(let time=0;time<=480000;time+=50){
      const poses=pond.sample(time,width!,height!)
      valid=valid&&poses.length===count!
      for(let i=0;i<poses.length;i++){
        const p=poses[i]!,r=ranges[i]!
        valid=valid&&[p.x,p.y,p.angle].every(Number.isFinite)
        valid=valid&&p.x>0&&p.x<width!
        valid=valid&&p.y>0&&p.y<height!
        r.min=Math.min(r.min,p.y/height!);r.max=Math.max(r.max,p.y/height!)
        if(Math.abs(p.x/width!-.5)<.16&&Math.abs(p.y/height!-.5)<.16)centreVisits++
        for(let j=0;j<i;j++){
          const other=poses[j]!,key=i+':'+j
          // Brief crossings and antennae overlap are natural; body piles must not persist.
          const overlap=Math.hypot(p.x-other.x,p.y-other.y)<(p.radius+other.radius)*.32
          const run=overlap?(overlapRuns.get(key)??0)+50:0
          overlapRuns.set(key,run);longestOverlap=Math.max(longestOverlap,run)
          if(angleDelta(p.angle,other.angle)>2.1)opposingHeadings++
        }
      }
    }
    expect(valid).toBe(true)
    expect(centreVisits).toBeGreaterThan(200)
    expect(opposingHeadings).toBeGreaterThan(500)
    expect(longestOverlap).toBeLessThan(12000)
    for(const r of ranges){expect(r.min).toBeLessThan(.36);expect(r.max).toBeGreaterThan(.67)}
  })
  it('keeps smooth frames through wandering, turns and encounters',()=>{
    const pond=createPondSwimmers(96)
    let previous=pond.sample(0,2560,1440),maxTravel=0,maxTurn=0
    for(let time=16;time<240000;time+=16){
      const poses=pond.sample(time,2560,1440)
      for(let i=0;i<poses.length;i++){
        maxTravel=Math.max(maxTravel,Math.hypot(poses[i]!.x-previous[i]!.x,poses[i]!.y-previous[i]!.y))
        maxTurn=Math.max(maxTurn,angleDelta(poses[i]!.angle,previous[i]!.angle))
      }
      previous=poses
    }
    expect(maxTravel).toBeLessThan(2);expect(maxTurn).toBeLessThan(.025)
  })
  it.each([[719,720],[720,719]])('preserves existing residents across %ipx→%ipx changes',(before,after)=>{
    const pond=createPondSwimmers(23)
    for(let t=0;t<30000;t+=50)pond.sample(t,before,852)
    const a=pond.sample(30000,before,852),b=pond.sample(30000,after,852)
    for(const next of b){
      const previous=a.find(p=>p.kind===next.kind&&p.index===next.index)
      if(!previous)continue
      expect(Math.hypot(next.x-previous.x,next.y-previous.y)).toBeLessThan(2)
      expect(angleDelta(next.angle,previous.angle)).toBeLessThan(.001)
    }
  })
  it('resumes a hidden tab without teleporting or simulating the entire missing hour',()=>{
    const pond=createPondSwimmers(94),a=pond.sample(1000,2560,1440),b=pond.sample(3601000,2560,1440)
    for(let i=0;i<a.length;i++)expect(Math.hypot(a[i]!.x-b[i]!.x,a[i]!.y-b[i]!.y)).toBeLessThan(8)
  })
  it('varies each visit while keeping seeded scenes isolated and independent of rendering frequency',()=>{
    const a=createPondSwimmers(17),b=createPondSwimmers(17),c=createPondSwimmers(319)
    a.sample(0,1280,900);b.sample(0,1280,900)
    for(let t=10;t<=60000;t+=10)a.sample(t,1280,900)
    for(let t=50;t<=60000;t+=50)b.sample(t,1280,900)
    const x=a.sample(60000,1280,900),y=b.sample(60000,1280,900),z=c.sample(60000,1280,900)
    for(let i=0;i<x.length;i++){
      expect(Math.hypot(x[i]!.x-y[i]!.x,x[i]!.y-y[i]!.y)).toBeLessThan(.01)
      expect(angleDelta(x[i]!.angle,y[i]!.angle)).toBeLessThan(.001)
    }
    expect(Math.hypot(x[0]!.x-z[0]!.x,x[0]!.y-z[0]!.y)).toBeGreaterThan(40)
  })
})