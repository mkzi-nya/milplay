/* Renderer completion: package pairing, render buckets, HUD. */
const __pluNormalizeMilthmV1=normalizeMilthm;
normalizeMilthm=function(raw){
  const out=__pluNormalizeMilthmV1(raw);if(out&&out._milthm&&Array.isArray(out.animations)){
    for(const a of out.animations){const s=a?._source||{};if(Object.prototype.hasOwnProperty.call(s,'IsCustomEase'))a.isCustomEase=!!s.IsCustomEase;if(Array.isArray(s.CustomEaseArr))a.customEaseArr=[...s.CustomEaseArr];if(Object.prototype.hasOwnProperty.call(s,'isCustomEase'))a.isCustomEase=!!s.isCustomEase;if(Array.isArray(s.customEaseArr))a.customEaseArr=[...s.customEaseArr]}
  }return out;
};

const __pluPrecomputeV2=precompute;
precompute=function(rt){
  __pluPrecomputeV2(rt);if(typeof markStageResize==='function')markStageResize();  rt.__pluNonHoldStarts=rt.notes.filter(n=>!n.isHold&&!n.isFake&&n.type!==NOTE_FRACTURE).sort((a,b)=>a.startSec-b.startSec);rt.__pluHolds=rt.notes.filter(n=>n.isHold&&!n.isFake).sort((a,b)=>a.startSec-b.startSec);
  /* Particle bursts in dense drag sections are redrawn as independent ellipses every
   * frame, so bound the simultaneous work.  The stride is frozen per note from the local
   * emitter density (notes within a +/-0.5 s window) and applied by a stable per-note
   * hash in js/03, so a burst never flickers between frames; normal passages keep the
   * full 8/10 sparks. */
  {
    const arr=rt.__pluNonHoldStarts;
    let lo=0,hi=0;for(let i=0;i<arr.length;i++){
      const t=arr[i].startSec;while(lo<i&&arr[lo].startSec<t-.5)lo++;while(hi<arr.length&&arr[hi].startSec<=t+.5)hi++;
      const active=hi-lo;arr[i].__pluParticleStride=active<=24?1:(active<=48?2:3);
    }
  }
  /* Active Hold hit-effects: avoid scanning every Hold from song start on every frame. */
  rt.__pluLongFxHolds=[];rt.__pluHoldFxBuckets=new Map();for(const n of rt.__pluHolds){const i0=Math.floor(Math.max(0,n.startSec)),i1=Math.floor(Math.max(0,n.endSec+.5));if(i1-i0>64){rt.__pluLongFxHolds.push(n);continue}for(let i=i0;i<=i1;i++){let q=rt.__pluHoldFxBuckets.get(i);if(!q)rt.__pluHoldFxBuckets.set(i,q=[]);q.push(n)}}
};
// Balanced interval tree: one entry per note, independent of song duration.
function __pluActiveNotesAt(rt,layer,sec){
  if(!rt.__activeTrees)return rt.__pluLayerNotes?.[layer]||[];
  const out=rt.__activeScratch[layer];out.length=0;
  function visit(node){
    if(!node||node.maxEnd<sec)return;
    visit(node.left);
    if(node.note.activeFrom<=sec){if(node.note.activeTo>=sec)out.push(node.note);visit(node.right)}
  }
  visit(rt.__activeTrees[layer]);
  // Preserve authored draw order, including overlapping alpha sprites.
  if(rt.chart?._rwc)out.sort((a,b)=>a.__drawOrder-b.__drawOrder);return out;
}

function __pluTweenGet(anim,time,combo){const p=clamp((time-anim.last)/.15,0,1);return combo?1+.07*Math.sin(p*Math.PI):anim.from+(anim.to-anim.from)*p}
function __pluTweenSet(anim,time,target,combo){if(anim.to!==target){const current=__pluTweenGet(anim,time,combo);anim.from=combo?1:current;anim.to=target;anim.last=time}return __pluTweenGet(anim,time,combo)}
drawCombo=function(rt,sec,w,h){
  const combo=rt.comboAt(sec),total=rt.comboTimes.length,targetScore=total?clamp(Math.ceil(1010000/total*combo),0,1010000):1010000;
  if(!rt.__pluHud)rt.__pluHud={lastTime:sec,score:{from:0,to:0,last:sec},combo:{from:1,to:combo,last:sec}};const hud=rt.__pluHud;if(sec<hud.lastTime){hud.score={from:0,to:0,last:sec};hud.combo={from:1,to:combo,last:sec}}hud.lastTime=sec;
  const score=Math.max(0,Math.floor(__pluTweenSet(hud.score,sec,targetScore,false))),comboScale=__pluTweenSet(hud.combo,sec,combo,true),scoreText=String(score).padStart(7,'0');
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=Math.max(2,w*.002);ctx.fillStyle='rgba(255,255,255,.98)';ctx.textBaseline='middle';ctx.textAlign='center';ctx.font=`700 ${Math.max(16,w*.0201)}px ui-sans-serif,system-ui`;ctx.fillText('ALL PERFECT',w*.5,w*.03594);ctx.font=`800 ${Math.max(20,w*.02634*comboScale)}px ui-sans-serif,system-ui`;ctx.fillText(String(combo),w*.5,w*.06771);
  ctx.textAlign='right';ctx.font=`800 ${Math.max(20,w*.02684)}px ui-monospace,SFMono-Regular,Consolas,monospace`;ctx.fillText(scoreText,w*.915,w*.03958);ctx.fillStyle='rgba(255,255,255,.75)';ctx.font=`600 ${Math.max(14,w*.02014)}px ui-sans-serif,system-ui`;ctx.fillText('100.00%',w*.915,w*.06684);
  const progress=rt.duration>0?clamp(sec/rt.duration,0,1):0;ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillRect(0,0,w*progress,Math.max(2,w*.0046875));ctx.restore();
};

render=function(){
  resizeCanvas();const w=els.stage.width,h=els.stage.height;ctx.setTransform(1,0,0,1,0,0);drawBg(w,h);state.visibleHit=[];state.inspectHit=[];const rt=state.runtime;
  if(rt){const sec=clamp(state.currentTime,0,rt.duration),play=state.appMode==='play';ctx.save();ctx.translate(state.panX,state.panY);ctx.scale(state.viewScale,state.viewScale);const lineStates=[];for(let li=0;li<rt.lineCount;li++)lineStates.push(transformLine(rt,li,sec,w,h));
    /* Layer order follows Pluviora src/pluviora.cpp:2139-2153 (MIT): foreground
       follows gameplay, then HUD. Picture rendering itself is absent in Pluviora. */
    drawStoryboardLayer(rt,0,sec,w,h);drawBackgroundDim(w,h);drawStoryboardLayer(rt,1,sec,w,h);
    const nonholds=rt.__pluNonHoldStarts||[],nhStart=__pluLowerByStart(nonholds,sec-.5);for(let i=nhStart;i<nonholds.length&&nonholds[i].startSec<=sec;i++)__pluDrawHitRing(rt,nonholds[i],sec,lineStates[nonholds[i].lineIdx],w,h);
    const holds=rt.__pluHolds||[],hRingStart=__pluLowerByStart(holds,sec-.5);for(let i=hRingStart;i<holds.length&&holds[i].startSec<=sec;i++)__pluDrawHitRing(rt,holds[i],sec,lineStates[holds[i].lineIdx],w,h);
    /* Manual judgement effects are incremental active entries, analogous to RainPlayer's
       pooled active particle objects; autoplay continues to use scheduled effects. */
    window.__gpDrawManualEffects?.(rt,sec,w,h,lineStates);
    for(let i=nhStart;i<nonholds.length&&nonholds[i].startSec<=sec;i++)__pluDrawParticles(rt,nonholds[i],sec,lineStates[nonholds[i].lineIdx],w,h);
    const fxHolds=rt.__pluHoldFxBuckets?.get(Math.floor(Math.max(0,sec)))||[];for(const n of fxHolds)if(n.startSec<=sec&&n.endSec+.5>=sec)__pluDrawParticles(rt,n,sec,lineStates[n.lineIdx],w,h);
    for(const n of rt.__pluLongFxHolds||[])if(n.startSec<=sec&&n.endSec+.5>=sec)__pluDrawParticles(rt,n,sec,lineStates[n.lineIdx],w,h);
    for(let layer=0;layer<3;layer++)for(const n of __pluActiveNotesAt(rt,layer,sec)){if(n.activeFrom<=sec&&n.activeTo>=sec)drawNote(rt,n,sec,lineStates[n.lineIdx],w,h)}
    /* The judgement line is the visual endpoint of the note path.  It must be
       composited over notes so that, at contact, the line visibly cuts through
       the note instead of disappearing behind its opaque centre.  Hit effects
       are intentionally emitted before this pass as well: the thin line remains
       readable at the exact contact frame, matching the reference capture. */
    for(const st of lineStates)drawLineState(st,w,h);
    drawStoryboardLayer(rt,2,sec,w,h);
    ctx.restore();drawCombo(rt,sec,w,h);if(!play){state.visibleHit=state.visibleHit.map(v=>({...v,...chartToScreen(v.x,v.y),cx:v.x,cy:v.y,r:v.r*state.viewScale}));state.inspectHit=state.inspectHit.map(screenMapHit)}else{state.visibleHit.length=0;state.inspectHit.length=0}}
  drawOverlay(w,h);
};

/* lowerBound overload used above without changing the existing numeric helper. */
function __pluLowerByStart(arr,value){let lo=0,hi=arr.length;while(lo<hi){const mid=(lo+hi)>>1;if(arr[mid].startSec<value)lo=mid+1;else hi=mid}return lo}
