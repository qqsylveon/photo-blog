export type PondSwimmer={kind:'koi'|'shrimp';index:number;x:number;y:number;angle:number;radius:number}
type Resident=PondSwimmer&{random:()=>number;targetX:number;targetY:number;age:number;deadline:number;pace:number;speed:number;rest:number}
const STEP=1/120,TAU=Math.PI*2
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
function randomStream(seed:number){
  let state=seed>>>0
  return ()=>{state+=0x6D2B79F5;let n=state;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296}
}
function radius(kind:PondSwimmer['kind'],width:number){
  return kind==='shrimp'?82*(width<720?.62:width>1800?1.1:.9):49*(width<720?.7:width>1800?1.2:1)
}

/** Each scene owns its random streams and steering state. Neighbours only affect
 * short-range avoidance: there is no shared route, orbit, lane or phase slot. */
export function createPondSwimmers(seed=Math.floor(Math.random()*4294967296)){
  let residents:Resident[]=[],width=0,height=0,lastTime:number|undefined,remainder=0
  function goal(p:Resident){
    let x=0,y=0
    for(let attempt=0;attempt<8;attempt++){
      x=.12+p.random()*.76;y=.12+p.random()*.76
      if(Math.hypot(x-p.x/width,y-p.y/height)>.3)break
    }
    p.targetX=x*width;p.targetY=y*height;p.age=0
    p.pace=.75+p.random()*.55
    p.deadline=Math.hypot(p.targetX-p.x,p.targetY-p.y)/Math.max(9,Math.sqrt(width*height)/55)*2+12
    p.rest=p.random()<.22?.6+p.random()*1.8:0
  }
  function resize(w:number,h:number){
    if(!residents.length){
      width=w;height=h
      const placement=randomStream(seed)
      for(let i=0;i<6;i++){
        // Random best-of candidates spread the initial view, never a prescribed shape.
        let x=0,y=0,best=-1
        for(let n=0;n<24;n++){
          const px=(.13+placement()*.74)*w,py=(.13+placement()*.74)*h
          const distance=residents.length?Math.min(...residents.map(p=>Math.hypot(px-p.x,py-p.y))):placement()
          if(distance>best){best=distance;x=px;y=py}
        }
        const random=randomStream(seed^Math.imul(i+1,0x9E3779B9)),kind=i%2?'shrimp':'koi'
        const p:Resident={kind,index:Math.floor(i/2),x,y,angle:random()*TAU,radius:radius(kind,w),random,targetX:0,targetY:0,age:0,deadline:0,pace:1,speed:0,rest:0}
        residents.push(p);goal(p);p.angle=Math.atan2(p.targetY-y,p.targetX-x);p.speed=12*p.pace
      }
      return
    }
    for(const p of residents){p.x*=w/width;p.y*=h/height;p.targetX*=w/width;p.targetY*=h/height;p.radius=radius(p.kind,w)}
    width=w;height=h
  }
  function step(){
    const count=width<720?4:6,base=clamp(Math.sqrt(width*height)/43,14,38)
    const next=residents.slice(0,count).map(p=>{
      p.age+=STEP;p.rest=Math.max(0,p.rest-STEP)
      const dx=p.targetX-p.x,dy=p.targetY-p.y,distance=Math.hypot(dx,dy)
      if(distance<Math.max(18,base*.8)||p.age>p.deadline)goal(p)
      const tx=p.targetX-p.x,ty=p.targetY-p.y,d=Math.hypot(tx,ty)||1
      let vx=tx/d,vy=ty/d
      for(let j=0;j<count;j++){
        const other=residents[j]!
        if(p===other)continue
        // Look slightly ahead, then yield gradually instead of correcting positions.
        const ox=p.x-other.x+(Math.cos(p.angle)*p.speed-Math.cos(other.angle)*other.speed)*.8
        const oy=p.y-other.y+(Math.sin(p.angle)*p.speed-Math.sin(other.angle)*other.speed)*.8
        const separation=Math.hypot(ox,oy)||.01,safe=(p.radius+other.radius)*.9
        if(separation<safe){
          const force=(1-separation/safe)**2*5
          vx+=ox/separation*force;vy+=oy/separation*force
        }
      }
      const padX=Math.min(width*.13,p.radius*.7),padY=Math.min(height*.13,p.radius*.7),look=base*3
      vx+=Math.max(0,1-(p.x-padX)/look)*3-Math.max(0,1-(width-padX-p.x)/look)*3
      vy+=Math.max(0,1-(p.y-padY)/look)*3-Math.max(0,1-(height-padY-p.y)/look)*3
      const desired=Math.atan2(vy,vx),turn=Math.atan2(Math.sin(desired-p.angle),Math.cos(desired-p.angle))
      const angle=p.angle+clamp(turn*1.7,-.85,.85)*STEP
      const cruise=base*p.pace*(p.kind==='shrimp'?.76:1),arrival=clamp(d/(base*3),.22,1)
      const targetSpeed=p.rest>0?cruise*.08:cruise*arrival*(1-.45*Math.min(1,Math.abs(turn)/Math.PI))
      const speed=p.speed+(targetSpeed-p.speed)*(1-Math.exp(-STEP*1.6))
      return {angle,speed,x:clamp(p.x+Math.cos(angle)*speed*STEP,padX,width-padX),y:clamp(p.y+Math.sin(angle)*speed*STEP,padY,height-padY)}
    })
    next.forEach((pose,i)=>Object.assign(residents[i]!,pose))
  }
  function sample(time:number,w:number,h:number):PondSwimmer[]{
    if(![time,w,h].every(Number.isFinite)||w<=0||h<=0)return []
    if(w!==width||h!==height)resize(w,h)
    if(lastTime!==undefined)remainder+=clamp((time-lastTime)/1000,0,.1)
    lastTime=time
    // Bound resume work and use the same small simulation step on 30/60/120Hz displays.
    while(remainder+1e-9>=STEP){step();remainder-=STEP}
    return residents.slice(0,w<720?4:6).map(({kind,index,x,y,angle,radius})=>({kind,index,x,y,angle,radius}))
  }
  return {sample}
}