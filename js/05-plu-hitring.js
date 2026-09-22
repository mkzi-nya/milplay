/* Rendering sync patch — 2026-08-08
 * - reproduces shaders/hit_ring.frag in a cached Canvas2D alpha mask
 * - uses source hit-ring progress quantization (60 frames) and source ring color/alpha
 * - corrects source Particle random-parameter ordering
 * - note textures are selected purely by type / AP / simultaneous flags; the
 *   hand-order sprite feature is not part of this player.
 */
const __RENDER_PATCH_VERSION='2026-08-08-reference-1.0.0-hit-ring-and-ex-hand-v1';
const __RENDER_PATCH_SOURCE_COMMIT='210386f98646f0ca59c6770e791d925885e8336c';

/* One engine-wide shader seed for hit-ring effects. */
const __plu100SeedWords=(()=>{const a=new Uint32Array(2);try{crypto.getRandomValues(a)}catch{a[0]=(Math.random()*4294967296)>>>0;a[1]=(Math.random()*4294967296)>>>0}return a})();
const __plu100RingSeed=__plu100SeedWords[0]/4294967296;
const __plu100FxRoot=__plu100SeedWords[1]>>>0;
function __plu100Mix32(x){x=(x+0x9e3779b9)>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);return (x^(x>>>16))>>>0}
function __plu100Unit(x){return __plu100Mix32(x)/4294967296}
function __plu100EffectSeed(n){return __plu100Mix32(__plu100FxRoot^__pluHash32(String(n.key)+'|'+String(n.globalIdx)))}
function __plu100EffectRotation(n){return 360*__plu100Unit(__plu100EffectSeed(n)^0xa531f23d)}

/* Particle construction follows C++ make_particle exactly in parameter order:
 * rotation, initial_speed, size-random, scale.x, scale.y, gravity. */
__pluParticleParams=function(n,index){
  const seed=__plu100EffectSeed(n),u=k=>__plu100Unit(seed^Math.imul((index+1)>>>0,0x9e3779b9)^Math.imul((k+1)>>>0,0x7f4a7c15));
  const rotation=360*u(0),speed=.3+(.72-.3)*u(1);
  return{rotation,speed,size:(speed**.22)*(.6+.1*u(2))/42,sx:1.5+.6*u(3),sy:-.5+u(4),gravity:.9+.4*u(5)};
};

/* Canvas2D port of shaders/hit_ring.frag. The fragment shader depends only on
 * normalized UV, a single engine seed and a 60-step progress value, so one
 * normalized mask per step is sufficient and can be scaled to the actual ring. */
const __plu100RingMaskSize=256,__plu100RingMasks=new Map();
function __plu100Fract(x){return x-Math.floor(x)}
function __plu100Rand2(x,y){return __plu100Fract(Math.sin(x*12.9898+y*78.233)*43758.5453)}
function __plu100Noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,
    a=__plu100Rand2(ix,iy),b=__plu100Rand2(ix+1,iy),c=__plu100Rand2(ix,iy+1),d=__plu100Rand2(ix+1,iy+1),
    ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),ab=a+(b-a)*ux,cd=c+(d-c)*ux;
  return ab+(cd-ab)*uy;
}
function __plu100CircularNoise(u,v,seed){
  const cx=u-.5,cy=v-.5,radius=Math.hypot(cx,cy)*50;
  let angle=Math.abs(Math.atan2(cy,cx));if(v>.5)angle+=Math.sin(angle)*2;
  const sx=radius+seed*100,sy=angle+seed*100;
  return __plu100Noise(sx,sy)*.7+__plu100Noise(sx*2,sy*2)*.3+__plu100Noise(sx*4,sy*4)*.1;
}
function __plu100RingMask(textureIndex){
  textureIndex=clamp(Math.trunc(textureIndex),0,59);let cached=__plu100RingMasks.get(textureIndex);if(cached)return cached;
  const N=__plu100RingMaskSize,c=document.createElement('canvas');c.width=N;c.height=N;const x=c.getContext('2d',{alpha:true}),im=x.createImageData(N,N),d=im.data,threshold=textureIndex/59;
  for(let py=0;py<N;py++)for(let px=0;px<N;px++){
    /* Fragment coordinates are pixel centers in the Flutter shader. */
    const u=(px+.5)/N,v=(py+.5)/N,r=Math.hypot(u-.5,v-.5);if(r<.43||r>.5)continue;
    if(__plu100CircularNoise(u,v,__plu100RingSeed)<threshold)continue;
    const o=(py*N+px)*4;d[o]=d[o+1]=d[o+2]=255;d[o+3]=255;
  }
  x.putImageData(im,0,0);__plu100RingMasks.set(textureIndex,c);return c;
}
/* The ring tint colour is a pure function of the quantized progress index / 59, so one
 * tinted composite per step can be cached forever (MilLune caches tinted textures the
 * same way via #apply_color_at_image). This removes an offscreen clear+draw+fill from
 * every one of the ~36 simultaneous hit rings in dense drag sections. */
const __plu100TintedRings=new Map();
function __plu100DrawRingMask(cx,cy,size,rotationDeg,color,textureIndex){
  if(!(size>0))return;const N=__plu100RingMaskSize;textureIndex=clamp(Math.trunc(textureIndex),0,59);
  const key=textureIndex+':'+color.slice(0,3).join(',');
  let tint=__plu100TintedRings.get(key);
  if(!tint){
    const mask=__plu100RingMask(textureIndex),c=document.createElement('canvas');c.width=N;c.height=N;const x=c.getContext('2d',{alpha:true});
    x.globalCompositeOperation='source-over';x.globalAlpha=1;x.drawImage(mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle=`rgba(${color[0]},${color[1]},${color[2]},1)`;x.fillRect(0,0,N,N);x.globalCompositeOperation='source-over';
    tint=c;const limit=window.__milIsLowMemoryMode?.()?48:180;if(__plu100TintedRings.size>=limit)__plu100TintedRings.delete(__plu100TintedRings.keys().next().value);__plu100TintedRings.set(key,tint);
  }
  ctx.save();ctx.translate(cx,cy);ctx.rotate(rotationDeg*Math.PI/180);ctx.imageSmoothingEnabled=true;ctx.drawImage(tint,-size/2,-size/2,size,size);ctx.restore();
}

/* 判定特效的位置是判定瞬间 note 的实际落点，不随 note 移动。
   __pluNoteFrame 会逐帧重算中心，因此这里在判定时刻锁定落点并吸附到线头。 */
function __pluAnchorEffectNote(n,sec){
  if(!n||n.z_hitTime>0)return n;
  const rt=state.runtime,w=els.stage.width,h=els.stage.height,st=typeof transformLine==='function'?transformLine(rt,n.lineIdx,sec,w,h):null,f=st?__pluNoteFrame(rt,n,sec,st,w,h):null;
  const center=st&&f?gpEffectAnchor(f.center.x,st.center.x,f.center.y,st.center.y,st.scale):null;
  Object.defineProperties(n,{z_hitTime:{configurable:true,value:sec},z_hitX:{configurable:true,value:center?center.x:null},z_hitY:{configurable:true,value:center?center.y:null},z_hitTransform:{configurable:true,value:st}});
  return n;
}
/* 把落点吸附到判定线头部：线头沿线的局部 +x 方向越过中心。 */
function gpEffectAnchor(x,ox,y,oy,scale){
  const dx=x-ox,dy=y-oy,len=Math.hypot(dx,dy);if(!(len>1e-9))return{x,y};
  const ux=dx/len,uy=dy/len,d=LINE_HEAD_CONNECT_POINT*Math.abs(scale||1);
  return{x:ox+ux*d,y:oy+uy*d};
}
window.__pluAnchorEffectNote=__pluAnchorEffectNote;
__pluDrawHitRing=function(rt,n,sec,st,w,h){
  if(!state.hitEffects||n.isFake||sec<n.startSec||sec>n.startSec+.5)return;
  __pluAnchorEffectNote(n,clamp(sec,n.startSec,n.startSec+.5));
  const f=__pluNoteFrame(rt,n,sec,st,w,h);if(!f)return;const p=(sec-n.startSec)/.5,lineHeadBase=(w+h)*.0223*(state.noteScale||1),size=lineHeadBase*4.632*(1-(1-p)**3)*f.scale;if(!(size>0))return;
  const color=__pluParticleColor(.065+p*.4),textureIndex=clamp(Math.floor(p*60),0,59),px=n.z_hitX==null?f.center.x:n.z_hitX,py=n.z_hitY==null?f.center.y:n.z_hitY;
  __plu100DrawRingMask(px,py,size,__plu100EffectRotation(n),color,textureIndex);
};

/* Keep source particle math, but use the corrected source-order random parameters. */
__pluDrawOneParticle=function(f,n,sec,emission,index,w,h){
  const p=clamp((sec-emission)/.5,0,1),a=__pluParticleAlpha(p);if(a<=0)return;const q=__pluParticleParams(n,index),noteScaling=f.scale*(state.noteScale||1),baseSize=q.size*(w+h),radius=p*q.speed*q.speed*(p*p/3-p+1)*(w+h),theta=q.rotation*Math.PI/180,ox=n.z_hitX==null?f.center.x:n.z_hitX,oy=n.z_hitY==null?f.center.y:n.z_hitY,x=ox+Math.cos(theta)*radius*noteScaling,y=oy+Math.sin(theta)*radius*noteScaling+p*p*q.gravity*.025*(w+h)*noteScaling,rx=((p+1)**(-q.sx)*1.34/(p+1))*baseSize*noteScaling,ry=((p+1)**(-q.sy)*.25/(p+1))*baseSize*noteScaling,c=__pluParticleColor(p);if(rx<=0||ry<=0||__milRectOutsideView(x-rx*2,y-ry*2,x+rx*2,y+ry*2,w,h))return;const travelAngle=Math.atan2(y-oy,x-ox)*180/Math.PI,renderRotation=(q.rotation+(q.rotation-travelAngle)*2)*Math.PI/180;ctx.save();ctx.translate(x,y);ctx.rotate(renderRotation);ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${a})`;ctx.beginPath();ctx.ellipse(0,0,Math.abs(rx),Math.abs(ry),0,0,Math.PI*2);ctx.fill();ctx.restore();
};

window.__plu100PatchSelfTest=function(){const fail=[],ok=(v,m)=>{if(!v)fail.push(m)};
  ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:true,isHold:false,note:{_hand:'r'}})==='extap_double','EX simultaneous Tap must use extap_double');
  ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:true,isHold:true,note:{_hand:'l'}})==='exhold_double','EX simultaneous Hold must use exhold_double');
  ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:false,isMore:true,isHold:false,note:{_hand:'l'}})==='tap_double','ordinary simultaneous Tap must use tap_double');
  ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:true,isHold:false,note:{}})==='extap_double','EX simultaneous no-hand Tap must preserve extap_double');
  ok(noteTextureKey({type:NOTE_HIT,isFake:false,isAlwaysPerfect:true,isMore:false,isHold:true,note:{}})==='exhold','EX no-hand Hold must preserve exhold');
  const m0=__plu100RingMask(0).getContext('2d').getImageData(0,0,__plu100RingMaskSize,__plu100RingMaskSize).data,m59=__plu100RingMask(59).getContext('2d').getImageData(0,0,__plu100RingMaskSize,__plu100RingMaskSize).data;let a0=0,a59=0;for(let i=3;i<m0.length;i+=4){a0+=m0[i]>0;a59+=m59[i]>0}ok(a0>0,'hit-ring mask must contain ring pixels');ok(a59<a0,'60-step shader progress must dissolve ring pixels');
  const q=__pluParticleParams({key:'test',globalIdx:0},0);ok(q.rotation>=0&&q.rotation<360&&q.speed>=.3&&q.speed<.72&&q.sx>=1.5&&q.sx<2.1&&q.sy>=-.5&&q.sy<.5&&q.gravity>=.9&&q.gravity<1.3,'particle source distributions invalid');return{ok:fail.length===0,version:__RENDER_PATCH_VERSION,sourceCommit:__RENDER_PATCH_SOURCE_COMMIT,ringPixelsStart:a0,ringPixelsEnd:a59,failures:fail}}
