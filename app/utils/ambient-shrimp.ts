type Point={x:number;y:number}
type Limb={root:Point;joint:Point;tip:Point}

/** Two bones meet at the same joint; neither feet nor claws detach during a step. */
function articulate(root:Point,tip:Point,upper:number,lower:number,side:number):Limb {
  const dx=tip.x-root.x,dy=tip.y-root.y,d=Math.hypot(dx,dy)
  const along=(upper*upper-lower*lower+d*d)/(2*d),offset=Math.sqrt(Math.max(0,upper*upper-along*along))
  return {root,tip,joint:{x:root.x+dx/d*along-dy/d*offset*side,y:root.y+dy/d*along+dx/d*offset*side}}
}

export function shrimpRig(time:number,index:number) {
  const phase=time*.0042+index*1.31,legs:Limb[]=[],claws:(Limb&{opening:number})[]=[]
  for(let i=0;i<4;i++)for(const side of [-1,1]){
    const step=phase+i*.92+(side===1?Math.PI:0),root={x:12-i*8,y:side*4}
    legs.push(articulate(root,{x:root.x+7*Math.cos(step),y:side*(22+2.5*Math.sin(step))},13,17,side))
  }
  for(const side of [-1,1]){
    const reach=phase*.43+side*.8
    claws.push({...articulate({x:16,y:side*4},{x:60+3*Math.sin(reach),y:side*(28+2*Math.cos(reach))},30,34,side),opening:.16+.1*(.5+.5*Math.sin(phase*.54+side))})
  }
  return {legs,claws,phase}
}

/** A straight translucent freshwater prawn, cached at 2x for fine shell detail. */
export function createShrimpSprite() {
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=192
  const ctx=canvas.getContext('2d')!
  ctx.scale(2,2);ctx.translate(80,48)
  const shell=ctx.createLinearGradient(0,-16,0,15)
  shell.addColorStop(0,'rgba(235,243,215,.86)');shell.addColorStop(.37,'rgba(172,197,175,.55)');shell.addColorStop(1,'rgba(91,135,120,.48)')
  ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=.8
  ctx.beginPath();ctx.moveTo(31,-3);ctx.bezierCurveTo(25,-15,3,-16,-12,-10);ctx.bezierCurveTo(-28,-8,-47,-7,-62,-3);ctx.lineTo(-64,3);ctx.bezierCurveTo(-47,6,-28,8,-13,10);ctx.bezierCurveTo(5,15,25,12,31,3);ctx.closePath()
  ctx.fillStyle=shell;ctx.fill();ctx.strokeStyle='rgba(65,107,95,.68)';ctx.stroke()
  ctx.save();ctx.clip()
  // Restrained organs and digestive tract remain visible through the shell.
  ctx.fillStyle='rgba(48,81,68,.22)';ctx.beginPath();ctx.ellipse(9,-1,14,7,.03,0,Math.PI*2);ctx.fill()
  ctx.strokeStyle='rgba(70,108,86,.35)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(13,-2);ctx.bezierCurveTo(-10,-4,-33,-1,-61,0);ctx.stroke()
  for(let i=0;i<6;i++){
    const x=-8-i*9,thickness=10-i*.9
    ctx.strokeStyle='rgba(65,110,97,.6)';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x,-thickness);ctx.quadraticCurveTo(x+5,0,x,thickness);ctx.stroke()
    ctx.strokeStyle='rgba(245,249,227,.75)';ctx.beginPath();ctx.moveTo(x+1,-thickness);ctx.quadraticCurveTo(x+6,0,x+1,thickness);ctx.stroke()
  }
  ctx.strokeStyle='rgba(245,250,228,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(23,-8);ctx.bezierCurveTo(3,-15,-19,-5,-58,-3);ctx.stroke()
  ctx.strokeStyle='rgba(63,103,88,.45)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(4,-12);ctx.quadraticCurveTo(12,-1,4,12);ctx.stroke()
  ctx.fillStyle='rgba(62,99,81,.24)'
  for(let i=0;i<29;i++){const x=-55+i*2.7,y=Math.sin(i*2.37)*3.7;ctx.beginPath();ctx.arc(x,y,.38+i%3*.15,0,Math.PI*2);ctx.fill()}
  ctx.restore()
  // Relaxed uropods continue the abdomen rather than curling under it.
  ctx.fillStyle='rgba(160,192,156,.53)';ctx.strokeStyle='rgba(72,116,98,.6)';ctx.lineWidth=.65
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(-61,0);ctx.quadraticCurveTo(-67,side*9,-77,side*9);ctx.lineTo(-79,side*5);ctx.quadraticCurveTo(-72,side,-63,-side);ctx.closePath();ctx.fill();ctx.stroke()
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-63,0);ctx.lineTo(-76,side*(3+i*2));ctx.stroke()}
  }
  ctx.beginPath();ctx.moveTo(-61,-2);ctx.lineTo(-79,-2);ctx.lineTo(-81,0);ctx.lineTo(-79,2);ctx.lineTo(-61,2);ctx.fill();ctx.stroke()
  ctx.beginPath();ctx.moveTo(24,-5);ctx.lineTo(48,-4);ctx.lineTo(31,2);ctx.closePath();ctx.fill();ctx.stroke()
  for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(29+i*2.6,-4.8);ctx.lineTo(30+i*2.6,-6.7);ctx.stroke()}
  ctx.lineWidth=1.2;ctx.strokeStyle='rgba(68,108,89,.8)';ctx.beginPath();ctx.moveTo(23,-6);ctx.lineTo(29,-12);ctx.moveTo(27,4);ctx.lineTo(33,8);ctx.stroke()
  for(const eye of [{x:29,y:-12},{x:33,y:8}]){
    ctx.fillStyle='#284b3d';ctx.beginPath();ctx.arc(eye.x,eye.y,1.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(237,247,228,.85)';ctx.beginPath();ctx.arc(eye.x+.4,eye.y-.6,.55,0,Math.PI*2);ctx.fill()
  }
  return canvas
}

function drawLimb(ctx:CanvasRenderingContext2D,limb:Limb,width:number) {
  ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(limb.root.x,limb.root.y);ctx.lineTo(limb.joint.x,limb.joint.y);ctx.lineTo(limb.tip.x,limb.tip.y);ctx.stroke()
  ctx.fillStyle='rgba(82,117,101,.7)';ctx.beginPath();ctx.arc(limb.joint.x,limb.joint.y,width*.65,0,Math.PI*2);ctx.fill()
}

export function drawShrimp(ctx:CanvasRenderingContext2D,sprite:HTMLCanvasElement,time:number,index:number,width:number,height:number,position:{x:number;y:number;angle:number},visibility=1) {
  const pose=position,rig=shrimpRig(time,index),scale=width<720?.62:width>1800?1.1:.9
  ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);ctx.scale(scale,scale)
  ctx.globalAlpha=(pose.x>width*.22&&pose.x<width*.78&&pose.y<height*.72?.3:.57)*visibility
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(71,119,104,.82)'
  for(const leg of rig.legs){drawLimb(ctx,leg,.72);ctx.beginPath();ctx.moveTo(leg.tip.x,leg.tip.y);ctx.lineTo(leg.tip.x+2.3,leg.tip.y);ctx.stroke()}
  for(const claw of rig.claws){
    drawLimb(ctx,claw,1.15)
    const direction=Math.atan2(claw.tip.y-claw.joint.y,claw.tip.x-claw.joint.x)
    ctx.save();ctx.translate(claw.tip.x,claw.tip.y);ctx.rotate(direction)
    ctx.fillStyle='rgba(149,177,148,.46)';ctx.beginPath();ctx.ellipse(3,0,4.8,1.7,0,0,Math.PI*2);ctx.fill()
    for(const side of [-1,1]){ctx.save();ctx.rotate(side*claw.opening);ctx.beginPath();ctx.moveTo(1,side);ctx.quadraticCurveTo(9,side*2.7,16,side*.6);ctx.lineWidth=.8;ctx.stroke();ctx.restore()}
    ctx.restore()
  }
  // Small pleopods flick below the abdomen; the body itself stays extended.
  ctx.strokeStyle='rgba(87,132,109,.52)';ctx.lineWidth=.6
  for(let i=0;i<4;i++)for(const side of [-1,1]){const x=-17-i*9,sweep=Math.sin(rig.phase+i*.8)*2;ctx.beginPath();ctx.moveTo(x,side*6);ctx.quadraticCurveTo(x-4+sweep,side*12,x-8+sweep,side*10);ctx.stroke()}
  ctx.drawImage(sprite,-80,-48,192,96)
  ctx.strokeStyle='rgba(72,119,104,.69)';ctx.lineWidth=.55
  for(const side of [-1,1]){
    const sway=Math.sin(rig.phase*.3+side)*3
    ctx.beginPath();ctx.moveTo(31,side*2);ctx.bezierCurveTo(56,side*8,73,side*31+sway,112,side*41+sway);ctx.stroke()
    ctx.beginPath();ctx.moveTo(32,side*3);ctx.quadraticCurveTo(64,side*14,86,side*18+sway);ctx.stroke()
    ctx.beginPath();ctx.moveTo(30,side*2);ctx.quadraticCurveTo(36,side*5,39,side*(5+Math.sin(rig.phase+side)));ctx.stroke()
  }
  ctx.restore()
}
