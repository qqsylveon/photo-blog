function sprite(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) paint(ctx)
  return canvas
}

export function createLeafSprite(variant=0) {
  return sprite(240,180,ctx=>{
    ctx.translate(120,96);ctx.scale(1,.72);ctx.rotate(variant*.72-.25)
    const leaf=new Path2D(),start=.26+variant*.025,end=Math.PI*2-.24
    leaf.moveTo(2,4);leaf.quadraticCurveTo(45,5,Math.cos(start)*92,Math.sin(start)*92)
    for(let i=0;i<=120;i++){
      const a=start+(end-start)*i/120,r=92+Math.sin(a*9+variant)*1.5+Math.sin(a*17)*.6
      leaf.lineTo(Math.cos(a)*r,Math.sin(a)*r)
    }
    leaf.quadraticCurveTo(45,-5,2,4);leaf.closePath()
    const fill=ctx.createRadialGradient(-25,-30,3,5,10,115)
    fill.addColorStop(0,'#c0d5a8');fill.addColorStop(.42,'#8fb88c');fill.addColorStop(.8,'#63947b');fill.addColorStop(1,'#487864')
    ctx.fillStyle=fill;ctx.fill(leaf);ctx.save();ctx.clip(leaf)
    for(let i=0;i<17;i++){
      const a=.47+i*(Math.PI*2-.72)/17,x=Math.cos(a)*92,y=Math.sin(a)*92
      ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(x*.25-y*.035,y*.25+x*.035,x*.66-y*.03,y*.66+x*.03,x,y)
      ctx.strokeStyle='rgba(55,111,84,.34)';ctx.lineWidth=1.25;ctx.stroke()
      ctx.beginPath();ctx.moveTo(-.6,-.6);ctx.quadraticCurveTo(x*.55-y*.025,y*.55+x*.025,x-.6,y-.6)
      ctx.strokeStyle='rgba(226,242,191,.62)';ctx.lineWidth=.65;ctx.stroke()
      for(const fraction of [.3,.5,.7])for(const side of [-1,1]){
        const fork=a+side*.16,r=92*(fraction+.2)
        ctx.beginPath();ctx.moveTo(x*fraction,y*fraction);ctx.quadraticCurveTo(Math.cos(fork)*r*.9,Math.sin(fork)*r*.9,Math.cos(fork)*r,Math.sin(fork)*r)
        ctx.strokeStyle='rgba(218,238,187,.45)';ctx.lineWidth=.42;ctx.stroke()
      }
    }
    ctx.restore();ctx.strokeStyle='rgba(66,116,88,.8)';ctx.lineWidth=1.15;ctx.stroke(leaf)
    // Rolled lip on the notch, with the centre vein still attached to the leaf.
    ctx.beginPath();ctx.moveTo(91,-23);ctx.quadraticCurveTo(44,-8,2,4);ctx.quadraticCurveTo(41,12,89,26)
    ctx.strokeStyle='rgba(228,241,190,.85)';ctx.lineWidth=1.8;ctx.stroke()
    ctx.beginPath();ctx.arc(-1,0,3.8,0,Math.PI*2);ctx.fillStyle='#b0ca96';ctx.fill()
    for(const [x,y,r] of [[-36,-29,3.8],[36,36,2.8],[-12,54,1.8]]){
      const drop=ctx.createRadialGradient(x!-r!*.3,y!-r!*.4,.3,x!,y!,r!)
      drop.addColorStop(0,'rgba(255,255,250,.95)');drop.addColorStop(.5,'rgba(224,244,222,.5)');drop.addColorStop(1,'rgba(45,100,81,.6)')
      ctx.fillStyle=drop;ctx.beginPath();ctx.arc(x!,y!,r!,0,Math.PI*2);ctx.fill()
      ctx.fillStyle='rgba(255,255,248,.9)';ctx.beginPath();ctx.arc(x!-r!*.28,y!-r!*.3,r!*.24,0,Math.PI*2);ctx.fill()
    }
  })
}

export function createLotusBudSprite(){
  return sprite(100,160,ctx=>{
    ctx.strokeStyle='#749a7c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(47,155);ctx.quadraticCurveTo(56,106,50,80);ctx.stroke()
    const blush=ctx.createLinearGradient(32,25,65,91);blush.addColorStop(0,'#d8a7bd');blush.addColorStop(.6,'#ecd3dc');blush.addColorStop(1,'#b77e9d')
    ctx.fillStyle=blush;ctx.strokeStyle='#b7839f';ctx.lineWidth=.8
    ctx.beginPath();ctx.moveTo(50,23);ctx.bezierCurveTo(22,46,27,80,50,87);ctx.bezierCurveTo(75,77,76,49,50,23);ctx.fill();ctx.stroke()
    ctx.beginPath();ctx.moveTo(50,26);ctx.quadraticCurveTo(36,59,50,86);ctx.quadraticCurveTo(65,58,50,26);ctx.stroke()
    ctx.strokeStyle='#8ba582';ctx.beginPath();ctx.moveTo(33,70);ctx.quadraticCurveTo(47,94,67,72);ctx.stroke()
  })
}
export function createLotusSprite() {
  return sprite(150, 150, ctx => {
    ctx.translate(75, 116)
    const petal = (angle: number, length: number, width: number, light: boolean) => {
      ctx.save(); ctx.rotate(angle)
      const gradient = ctx.createLinearGradient(0, -length, 0, 0)
      gradient.addColorStop(0, light ? '#e7b9d0' : '#d596b6'); gradient.addColorStop(.52, '#f0d8df'); gradient.addColorStop(1, '#bc859c')
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-width, -length * .2, -width * .7, -length * .66, 0, -length)
      ctx.bezierCurveTo(width * .55, -length * .66, width, -length * .2, 0, 0)
      ctx.fillStyle = gradient; ctx.fill(); ctx.strokeStyle = 'rgba(152,83,115,.5)'; ctx.lineWidth = .7; ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(-width * .1, -length * .5, 0, -length * .92); ctx.strokeStyle = 'rgba(255,244,240,.7)'; ctx.stroke(); ctx.restore()
    }
    for (const angle of [-1.25, -.9, -.5, 0, .5, .9, 1.25]) petal(angle, 58, 23, false)
    for (const angle of [-.75, -.35, .12, .52]) petal(angle, 74, 17, true)
    for (const angle of [-.23, .22]) petal(angle, 85, 12, true)
    ctx.fillStyle = '#c7a35e'; ctx.beginPath(); ctx.ellipse(0, -8, 10, 5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#74906a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, 20, -4, 30); ctx.stroke()
  })
}

export function createPavilionSprite() {
  return sprite(360, 240, ctx => {
    ctx.strokeStyle = '#6f8174'; ctx.lineWidth = 3
    for (const x of [88, 148, 212, 272]) { ctx.beginPath(); ctx.moveTo(x, 108); ctx.lineTo(x, 204); ctx.stroke() }
    ctx.fillStyle = '#71877b'
    ctx.beginPath(); ctx.moveTo(20, 114); ctx.quadraticCurveTo(98, 118, 180, 54); ctx.quadraticCurveTo(263, 118, 340, 114); ctx.quadraticCurveTo(299, 141, 265, 132); ctx.lineTo(95, 132); ctx.quadraticCurveTo(61, 141, 20, 114); ctx.fill()
    ctx.fillStyle = '#91a299'; ctx.beginPath(); ctx.moveTo(88, 72); ctx.quadraticCurveTo(139, 66, 180, 16); ctx.quadraticCurveTo(222, 66, 272, 72); ctx.quadraticCurveTo(230, 89, 180, 75); ctx.quadraticCurveTo(130, 89, 88, 72); ctx.fill()
    ctx.beginPath(); ctx.moveTo(180, 16); ctx.lineTo(180, 6); ctx.stroke()
    ctx.lineWidth = 1; ctx.strokeStyle = '#c5cbb4'
    for (let i = 0; i < 13; i++) { const x = 72 + i * 18; ctx.beginPath(); ctx.moveTo(180, 58); ctx.quadraticCurveTo(x, 114, x, 130); ctx.stroke() }
    ctx.strokeStyle = '#7e8974'; ctx.lineWidth = 2; ctx.strokeRect(78, 179, 204, 23)
    for (let x = 90; x < 280; x += 16) { ctx.beginPath(); ctx.moveTo(x, 180); ctx.lineTo(x, 201); ctx.stroke() }
    ctx.fillStyle = '#84917c'; ctx.fillRect(62, 205, 236, 6); ctx.fillRect(52, 216, 256, 5)
  })
}

export function createEgretSprite(){
  return sprite(220,260,ctx=>{
    ctx.translate(90,170);ctx.lineCap='round';ctx.lineJoin='round'
    // Long dark tarsi, visible hocks and three fine toes touching the water.
    ctx.strokeStyle='#64766b';ctx.lineWidth=2
    ctx.beginPath();ctx.moveTo(-1,13);ctx.lineTo(-5,37);ctx.lineTo(-4,64);ctx.moveTo(13,11);ctx.lineTo(20,35);ctx.lineTo(12,65);ctx.stroke()
    ctx.lineWidth=1.05;ctx.beginPath();ctx.moveTo(-4,64);ctx.lineTo(-13,68);ctx.moveTo(-4,64);ctx.lineTo(7,67);ctx.moveTo(-4,64);ctx.lineTo(-1,70);ctx.moveTo(12,65);ctx.lineTo(23,68);ctx.moveTo(12,65);ctx.lineTo(6,69);ctx.moveTo(12,65);ctx.lineTo(15,71);ctx.stroke()
    const feather=ctx.createLinearGradient(-18,-14,17,18)
    feather.addColorStop(0,'#fffff7');feather.addColorStop(.5,'#f3f7f0');feather.addColorStop(1,'#bccfc7')
    ctx.fillStyle=feather;ctx.strokeStyle='rgba(129,157,145,.55)';ctx.lineWidth=.7
    ctx.beginPath();ctx.moveTo(-32,4);ctx.bezierCurveTo(-21,-15,4,-18,21,-7);ctx.bezierCurveTo(36,8,15,23,-10,15);ctx.quadraticCurveTo(-28,17,-43,16);ctx.lineTo(-29,7);ctx.fill();ctx.stroke()
    ctx.beginPath();ctx.moveTo(-28,0);ctx.bezierCurveTo(-8,-13,17,-7,16,6);ctx.quadraticCurveTo(2,19,-29,11);ctx.fill();ctx.stroke()
    ctx.strokeStyle='rgba(155,177,165,.55)';ctx.lineWidth=.55
    for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(-24+i*2,3+i*.6);ctx.quadraticCurveTo(-4+i*2,6+i*.8,6+i*1.8,12+i*.14);ctx.stroke()}
    // A real S-neck tapers from the breast to a small, alert head.
    const neck=()=>{ctx.beginPath();ctx.moveTo(19,2);ctx.bezierCurveTo(39,-20,37,-39,24,-52);ctx.bezierCurveTo(5,-70,15,-97,33,-93)}
    neck();ctx.strokeStyle='#b7cac0';ctx.lineWidth=9;ctx.stroke()
    neck();ctx.strokeStyle='#f7faf2';ctx.lineWidth=7;ctx.stroke()
    ctx.strokeStyle='rgba(139,165,150,.55)';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(18,-6);ctx.bezierCurveTo(32,-28,30,-39,23,-48);ctx.stroke()
    ctx.fillStyle='#f8fbf4';ctx.beginPath();ctx.ellipse(36,-93,9,5.7,.08,0,Math.PI*2);ctx.fill()
    ctx.strokeStyle='#edf5ea';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(29,-96);ctx.quadraticCurveTo(20,-101,16,-99);ctx.moveTo(31,-97);ctx.quadraticCurveTo(23,-104,19,-103);ctx.stroke()
    const bill=ctx.createLinearGradient(42,-95,72,-91);bill.addColorStop(0,'#b6ad72');bill.addColorStop(.65,'#c9b477');bill.addColorStop(1,'#61776b')
    ctx.fillStyle=bill;ctx.beginPath();ctx.moveTo(42,-96);ctx.lineTo(75,-90);ctx.lineTo(43,-90);ctx.closePath();ctx.fill()
    ctx.strokeStyle='rgba(95,114,82,.65)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(43,-93);ctx.lineTo(72,-90.5);ctx.stroke()
    ctx.fillStyle='#a3ad76';ctx.beginPath();ctx.ellipse(41,-95,3,2,0,0,Math.PI*2);ctx.fill()
    ctx.fillStyle='#364e45';ctx.beginPath();ctx.arc(39,-95,1.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f9fff7';ctx.beginPath();ctx.arc(39.4,-95.4,.4,0,Math.PI*2);ctx.fill()
    // Fine scapular plumes, not heavy parallel stripes.
    ctx.strokeStyle='rgba(247,252,241,.9)';ctx.lineWidth=.55
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-8,-6+i);ctx.bezierCurveTo(-20,1+i*2,-27,15+i,-40,20+i*.5);ctx.stroke()}
  })
}

export function drawEgret(ctx:CanvasRenderingContext2D,bird:HTMLCanvasElement,x:number,y:number,scale:number,time:number,visibility=1){
  ctx.save();ctx.translate(x,y+70*scale);ctx.scale(scale,-scale*.34);ctx.globalAlpha=.08*visibility;ctx.drawImage(bird,-90,-240);ctx.restore()
  ctx.save();ctx.translate(x,y+70*scale);ctx.rotate(Math.sin(time*.00032)*.004);ctx.scale(scale,scale);ctx.globalAlpha=.73*visibility;ctx.drawImage(bird,-90,-240);ctx.restore()
  ctx.save();ctx.strokeStyle='rgba(104,148,135,.2)';ctx.lineWidth=.7
  for(let i=0;i<2;i++){ctx.beginPath();ctx.ellipse(x+2*scale,y+71*scale,(26+i*12+Math.sin(time*.0006+i)*2)*scale,(4+i*3)*scale,0,0,Math.PI*2);ctx.stroke()}
  ctx.restore()
}
