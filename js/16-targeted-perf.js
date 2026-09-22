(()=>{
'use strict';
const __TARGET_PATCH='2026-08-13-algebra-background-review-v7';

/* ---------------- UI state / status ---------------- */
state.__playShowHands=false;
const __targetUpdateModeUI=updateModeUI;
updateModeUI=function(){
  __targetUpdateModeUI();
  const play=state.appMode==='play';
  if(els.playModeBar)els.playModeBar.style.display=play?'flex':'';
  if(els.showHandsLabel)els.showHandsLabel.style.display=play?'inline-flex':'none';
  if(els.showHandsToggle)els.showHandsToggle.checked=play?state.__playShowHands===true:state.showHandTextures!==false;
};
const __targetSetAppMode=setAppMode;
setAppMode=function(mode){
  const leavingPlay=state.appMode==='play';
  if(leavingPlay)state.__playShowHands=state.showHandTextures===true;
  __targetSetAppMode(mode);
  if(mode==='play')state.showHandTextures=state.__playShowHands===true;
  else state.showHandTextures=true;
  updateModeUI();render();
};
els.showHandsToggle?.addEventListener('change',()=>{if(state.appMode==='play')state.__playShowHands=!!els.showHandsToggle.checked;});

/* Only actual errors create a status row. Warnings/progress/success remain available
   to the console but don't make the upload card jump in height. */
setStatus=function(message,type=''){
  const text=String(message??'');
  const quietInfra=/(?:自动保存失败|本地保存不可用|IndexedDB)/i.test(text);
  const looksError=!quietInfra&&(type==='err'||/(?:解析失败|加载失败|读取失败|没有找到可用(?:谱面|文件)|无法(?:解析|读取|加载)|不支持的谱面|错误[:：])/i.test(text));
  if(els.status){
    els.status.className='status'+(looksError?' err':'');
    els.status.textContent=looksError?text:'';
  }
  if(typeof __milLogStatus==='function')__milLogStatus(text,looksError?'err':type);
  if(!looksError&&text&&(type==='warn'||quietInfra))console.warn('[Milthm]',text);
};
if(els.restoreBar)els.restoreBar.classList.remove('show');

/* dw/dh 已是 backing 像素，不再乘 DPR。编辑视图的额外缩放计入目标采样，
   同时受当前可用源切片、面积和长边预算约束，不为小音符分配整张原图缓冲。 */
let __targetTintCanvas=null,__targetTintCtx=null;
__milTintSlice=function(img,sx,sy,sw,sh,dx,dy,dw,dh,color){
  const iw=Number(img?.naturalWidth||img?.width)||0,ih=Number(img?.naturalHeight||img?.height)||0;
  if(!iw||!ih||![sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite)||!sw||!sh||Math.abs(dw)<1e-6||Math.abs(dh)<1e-6)return;
  if(color[0]===255&&color[1]===255&&color[2]===255){ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);return}
  const zoom=Math.abs(Number(state.viewScale))||1,
        rw=Math.max(1,Math.min(Math.floor(Math.min(iw,Math.abs(sw))),Math.ceil(Math.abs(dw)*zoom))),
        rh=Math.max(1,Math.min(Math.floor(Math.min(ih,Math.abs(sh))),Math.ceil(Math.abs(dh)*zoom))),
         tintSide=state.lowMemory?RENDER_QUALITY.lowMemoryTintSide:RENDER_QUALITY.maxTintSide,tintPixels=state.lowMemory?RENDER_QUALITY.lowMemoryTintPixels:RENDER_QUALITY.maxTintPixels,
         scale=Math.min(1,tintSide/Math.max(rw,rh),Math.sqrt(tintPixels/(rw*rh))),
        tw=Math.max(1,Math.floor(rw*scale)),th=Math.max(1,Math.floor(rh*scale));
  if(!__targetTintCanvas){__targetTintCanvas=document.createElement('canvas');__targetTintCtx=__targetTintCanvas.getContext('2d',{alpha:true,willReadFrequently:false})}
  // 先缩小再扩宽，长条横竖切换时也不产生超预算的中间缓冲。
  if(__targetTintCanvas.width!==tw){__targetTintCanvas.height=1;__targetTintCanvas.width=tw}if(__targetTintCanvas.height!==th)__targetTintCanvas.height=th;
  const g=__targetTintCtx;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.clearRect(0,0,tw,th);g.drawImage(img,sx,sy,sw,sh,0,0,tw,th);
  g.globalCompositeOperation='multiply';g.fillStyle=`rgb(${color[0]},${color[1]},${color[2]})`;g.fillRect(0,0,tw,th);
  g.globalCompositeOperation='destination-in';g.drawImage(img,sx,sy,sw,sh,0,0,tw,th);g.globalCompositeOperation='source-over';ctx.drawImage(__targetTintCanvas,0,0,tw,th,dx,dy,dw,dh);
};

/* ---------------- Note texture fixes ---------------- */
/* Hand-order sprites are not part of the player. Texture selection is purely semantic:
   fracture / drag / hold / tap, with the ordinary simultaneous (_double) and EX variants. */
noteTextureKey=function(n){
  if(n.type===NOTE_FRACTURE)return 'fracture';
  if(n.type===NOTE_DRAG)return n.isMore?'drag_double':'drag';
  return milNoteKey(n.type,n.isAlwaysPerfect&&!n.isFake,n.isMore,n.isHold);
};

function __targetDecorativeFakeEnd(rt,n){
  return Number.isFinite(n.__targetDecorativeFakeEnd)?n.__targetDecorativeFakeEnd:n.startSec;
}
const __targetDrawNoteBase=drawNote;
drawNote=function(rt,n,sec,st,w,h){
  let dn=n;
  if(n.isFake&&!n.isHold){
    const decorativeEnd=__targetDecorativeFakeEnd(rt,n);
    if(decorativeEnd>n.startSec+1e-6){
      if(sec>decorativeEnd)return;
      if(sec>=n.startSec){
        /* Algebra uses a single Fake Tap as a reusable visual line-head. Once its
           authored hit time passes, keep only that unique head parked on the line;
           the line's real WholeTransparency decides exactly which heads are visible. */
        dn=Object.create(n);dn.startSec=decorativeEnd;dn.endSec=decorativeEnd;dn.floorStart=rt.lineValue(n.lineIdx,SPEED,sec);dn.floorEnd=dn.floorStart;
      }
    }else if(sec>=n.startSec)return;
  }
  __targetDrawNoteBase(rt,dn,sec,st,w,h);
};

/* Self-contained storyboard helpers. The previous Algebra renderer lives inside a
   separate IIFE, so its private __alg* helpers are intentionally not reused here. */
function __targetStoryColor(rt,sb,sec,alpha){
  const c=rgbaFromUint(rt.sbValue(sb,COLOR,sec));
  c[3]=Math.max(0,Math.min(255,c[3]*alpha));
  return c;
}
function __targetIntrinsic(data,img){
  let w=0,h=0;
  try{
    const rec=storyCache.get(String(data||''));
    w=Number(rec?.sourceWidth||rec?.width||0);h=Number(rec?.sourceHeight||rec?.height||0);
  }catch{}
  if(!(w>0))w=Number(img?.naturalWidth||img?.videoWidth||img?.width||0);
  if(!(h>0))h=Number(img?.naturalHeight||img?.videoHeight||img?.height||0);
  return{w,h};
}
function __targetTextPx(w,h){return 300*.1125*Math.max(w/800,h/600)}
function __targetDrawBuiltinPrimitive(kind,cx,cy,dw,dh,deg,color){
  const alpha=Math.max(0,Math.min(1,(Number(color?.[3])||0)/255));if(alpha<=0)return;
  ctx.save();ctx.translate(cx,cy);ctx.rotate((Number(deg)||0)*Math.PI/180);ctx.scale(dw<0?-1:1,dh<0?-1:1);ctx.globalAlpha*=alpha;ctx.fillStyle=`rgb(${color?.[0]??255},${color?.[1]??255},${color?.[2]??255})`;
  const aw=Math.abs(dw),ah=Math.abs(dh),x=-aw/2,y=-ah/2;
  if(kind==='builtin.round_rect'){
    const r=Math.min(aw,ah)*.18;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,aw,ah,r):(ctx.rect(x,y,aw,ah));ctx.fill();
  }else ctx.fillRect(x,y,aw,ah);
  ctx.restore();
}

/* ---------------- Storyboard intrinsic-size fixes ---------------- */
function __targetSbBaseSize(data,intrinsic,w,h){
  if(data==='builtin.line'){
    /* Algebra authors use builtin.line as an effectively unbounded background line.
       10000 Mil units mirrors the source LinePrefab body length and safely spans the
       viewport at every authored rotation while SB_WIDTH=0 can still hide it. */
    return{w:milX(10000,w),h:milX(4,w)};
  }
  if(data==='builtin.tap'||data==='builtin.tap_double'||data==='builtin.extap'||data==='builtin.extap_double'){
    /* Algebra uses builtin note pictures beside builtin.rect objects with the same Size
       values. Their authored logical footprint is therefore the same 300-Mil primitive
       box, not the 923px source bitmap and not the much smaller gameplay-note prefab.
       Preserve the source texture's transparent padding, but normalize its visible alpha
       bounds to a 300-Mil square. This lands between the previous two wrong extremes:
       raw 923px (too large) and gameplay-note width (too small). */
    const visibleRatio=(data.endsWith('_double')?757:510)/923;
    const logicalVisibleW=milX(300,w);
    const fullW=logicalVisibleW/visibleRatio;
    const ar=(intrinsic?.w>0&&intrinsic?.h>0)?intrinsic.h/intrinsic.w:1;
    return{w:fullW,h:fullW*ar};
  }
  const bw=milX(intrinsic.w,w);return{w:bw,h:bw/intrinsic.w*intrinsic.h};
}

// Unity's quad uses two affine triangles. Clip each triangle before mapping the
// source texture; negative scales and concave quads keep their authored topology.
function __targetDrawQuad(rt,sb,sec,img,cx,cy,dw,dh,deg,color){
  const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height;
  if(!(sw>0&&sh>0))return;
  const p=[[18,19],[20,21],[14,15],[16,17]].map(([x,y])=>[rt.sbValue(sb,x,sec)*dw,-rt.sbValue(sb,y,sec)*dh]);
  if(!p.flat().every(Number.isFinite))return;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(deg*Math.PI/180);ctx.globalAlpha*=color[3]/255;
  for(const ids of [[0,2,1],[1,2,3]]){
    const uv=[[0,0],[sw,0],[0,sh],[sw,sh]],a=uv[ids[0]],b=uv[ids[1]],c=uv[ids[2]],A=p[ids[0]],B=p[ids[1]],C=p[ids[2]];
    const u=b[0]-a[0],v=b[1]-a[1],s=c[0]-a[0],t=c[1]-a[1],det=u*t-s*v;
    const xx=((B[0]-A[0])*t-(C[0]-A[0])*v)/det,xy=((C[0]-A[0])*u-(B[0]-A[0])*s)/det;
    const yx=((B[1]-A[1])*t-(C[1]-A[1])*v)/det,yy=((C[1]-A[1])*u-(B[1]-A[1])*s)/det;
    if(Math.abs(xx*yy-xy*yx)<1e-12)continue;
    ctx.save();ctx.beginPath();ctx.moveTo(...A);ctx.lineTo(...B);ctx.lineTo(...C);ctx.closePath();ctx.clip();
    ctx.transform(xx,yx,xy,yy,A[0]-xx*a[0]-xy*a[1],A[1]-yx*a[0]-yy*a[1]);
    __milTintSlice(img,0,0,sw,sh,0,0,sw,sh,color);ctx.restore();
  }
  ctx.restore();
}
drawStoryboardLayer=function(rt,layer,sec,w,h,distorted=false){
  if(!rt||!rt.storyboards)return;const list=rt.__storyByLayer?.[layer]||rt.storyboards;
  for(const sb of list){
    if(sb.layer!==layer)continue;
    const hidden=isItemHidden('storyboard',sb.index);if(hidden&&!state.showHidden)continue;
    const alpha=clamp(rt.sbValue(sb,TRANSPARENCY,sec),0,1);if(alpha<=0)continue;
    const drawAlpha=hidden?Math.min(.45,alpha):alpha;
    const px=milX(rt.sbValue(sb,POS_X,sec),w),py=milY(rt.sbValue(sb,POS_Y,sec),h),rx=milX(rt.sbValue(sb,REL_X,sec),w),ry=milY(rt.sbValue(sb,REL_Y,sec),h),center=localToScreen(w,h,px+rx,py+ry),size=Number(rt.sbValue(sb,SIZE,sec)),rotDeg=Number(rt.sbValue(sb,ROTATION,sec)),sx=Number(rt.sbValue(sb,SB_WIDTH,sec)),sy=Number(rt.sbValue(sb,SB_HEIGHT,sec)),color=__targetStoryColor(rt,sb,sec,drawAlpha);
    if(![center.x,center.y,size,rotDeg,sx,sy].every(Number.isFinite)||Math.abs(size*sx)<1e-8||Math.abs(size*sy)<1e-8)continue;
    if(sb.type===0){
      const data=String(sb.data||'');
      if(sb.distorted){
        const image=storyImage(data);if(!image)continue;
        const intrinsic=__targetIntrinsic(data,image),base=(data==='builtin.rect'||data==='builtin.round_rect')?{w:milX(300,w),h:milX(300,w)}:__targetSbBaseSize(data,intrinsic,w,h);
        __targetDrawQuad(rt,sb,sec,image,center.x,center.y,base.w*size*sx,base.h*size*sy,-rotDeg,color);
        continue;
      }
      if(data==='builtin.rect'||data==='builtin.round_rect'){
        const baseW=milX(300,w),baseH=baseW,dw=baseW*size*sx,dh=baseH*size*sy,rad=.5*Math.hypot(Math.abs(dw),Math.abs(dh));
        if(center.x+rad<-8||center.x-rad>w+8||center.y+rad<-8||center.y-rad>h+8)continue;
        __targetDrawBuiltinPrimitive(data,center.x,center.y,dw,dh,-rotDeg,color);
        if(hidden)drawHiddenHalo(center.x,center.y,Math.max(Math.abs(dw),Math.abs(dh))/2);
        if(state.appMode!=='play')state.inspectHit.push({kind:'storyboard',label:'故事板',id:sb.index,hiddenKey:itemKey('storyboard',sb.index),sb,x:center.x,y:center.y,w:Math.abs(dw),h:Math.abs(dh),rot:-rotDeg});
        continue;
      }
      const img=storyImage(data);if(!img)continue;const d=__targetIntrinsic(data,img);if(!(d.w>0&&d.h>0))continue;
      const base=__targetSbBaseSize(data,d,w,h),dw=base.w*size*sx,dh=base.h*size*sy,rad=.5*Math.hypot(Math.abs(dw),Math.abs(dh));
      if(center.x+rad<-8||center.x-rad>w+8||center.y+rad<-8||center.y-rad>h+8)continue;
      __milDrawRotTinted(img,center.x,center.y,dw,dh,-rotDeg,1,color);
      if(hidden)drawHiddenHalo(center.x,center.y,Math.max(Math.abs(dw),Math.abs(dh))/2);
      if(state.appMode!=='play')state.inspectHit.push({kind:'storyboard',label:'故事板',id:sb.index,hiddenKey:itemKey('storyboard',sb.index),sb,x:center.x,y:center.y,w:Math.abs(dw),h:Math.abs(dh),rot:-rotDeg});
    }else if(sb.type===1){
      const text=String(sb.data||''),base=__targetTextPx(w,h);ctx.save();ctx.translate(center.x,center.y);ctx.rotate(-rotDeg*Math.PI/180);ctx.scale(size*sx,size*sy);ctx.globalAlpha*=color[3]/255;ctx.fillStyle=`rgb(${color[0]},${color[1]},${color[2]})`;ctx.font=`400 ${Math.max(1,base)}px ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,0,0);const mw=Math.max(base*.5,ctx.measureText(text||' ').width),mh=base*1.15;ctx.restore();
      const iw=Math.abs(mw*size*sx),ih=Math.abs(mh*size*sy);if(hidden)drawHiddenHalo(center.x,center.y,Math.max(iw,ih)/2);
      if(state.appMode!=='play')state.inspectHit.push({kind:'storyboard',label:'故事板文字',id:sb.index,hiddenKey:itemKey('storyboard',sb.index),sb,x:center.x,y:center.y,w:iw,h:ih,rot:-rotDeg});
    }
  }
};

/* Algebra's anomaly sections have no schema-level HUD animation.  The supplied game
 * recording and chart do, however, agree on the authored foreground `beats*.png`
 * cards: while one is visible, the native player hides combo / score / progress and
 * the pause glyph.  Treat this as an authored cinematic marker rather than a chart
 * title, black-image, or arbitrary opacity heuristic.  It also covers beats1–4 and
 * beats1-answer without changing normal opaque storyboards. */
function __targetHudVisible(rt,sec){
  if(!rt||state.appMode!=='play')return true;
  for(const sb of rt.storyboards||[]){
    if(sb.type!==0||sb.layer!==2||!/^beats\d+(?:-answer)?\.png$/i.test(String(sb.data||'')))continue;
    if(Number(rt.sbValue(sb,TRANSPARENCY,sec))>.001)return false;
  }
  return true;
}
window.MilHud={...(window.MilHud||{}),isVisible:__targetHudVisible};
const __targetDrawCombo=drawCombo;
drawCombo=function(rt,sec,w,h){
  state.hudVisible=__targetHudVisible(rt,sec);
  if(!state.hudVisible)return;
  return __targetDrawCombo(rt,sec,w,h);
};

/* ---------------- Reference judgement-line prefab geometry ----------------
   Unity's LinePrefab uses a 25.567076 square head, a 1.855675-wide × 10000 body,
   and an 11.54 body anchor offset. Its CanvasScaler is 800×600 in Shrink mode.
   Keep these dimensions separate from storyboard builtin.line. */
function __targetUnityUiScale(w,h){return Math.max(Math.max(1,w)/800,Math.max(1,h)/600)}
drawLineState=function(st,w,h){
  if(!Number.isFinite(st.absScale)||st.absScale<=1e-9)return;
  const bodyHidden=isItemHidden('line',st.lineIdx),headHidden=isItemHidden('lineHead',st.lineIdx),bodyAlpha=st.transparency*st.bodyAlpha,headAlpha=st.transparency*st.headAlpha,cx=st.center.x,cy=st.center.y;
  const ui=__targetUnityUiScale(w,h)*(state.noteScale||1)*st.absScale,
        headSize=25.567076*ui,lineWidth=1.855675*ui,connect=11.54*ui,bodyLen=10000*ui,
        ang=-st.rotation*Math.PI/180;
  if(bodyAlpha>.001&&(!bodyHidden||state.showHidden)){
    const ux=Math.cos(ang),uy=Math.sin(ang),nx=-uy,ny=ux,sx=cx+ux*connect,sy=cy+uy*connect,ex=cx+ux*(connect+bodyLen),ey=cy+uy*(connect+bodyLen),hw=lineWidth/2;
    ctx.save();ctx.fillStyle=bodyHidden?'rgba(255,255,255,.45)':cssRgba(st.color,bodyAlpha);ctx.beginPath();ctx.moveTo(sx+nx*hw,sy+ny*hw);ctx.lineTo(ex+nx*hw,ey+ny*hw);ctx.lineTo(ex-nx*hw,ey-ny*hw);ctx.lineTo(sx-nx*hw,sy-ny*hw);ctx.closePath();ctx.fill();ctx.restore();
    if(state.appMode!=='play')state.inspectHit.push({kind:'line',label:'判定线',id:st.lineIdx,hiddenKey:itemKey('line',st.lineIdx),x1:sx,y1:sy,x2:ex,y2:ey,lineWidth});
  }
  if(headAlpha>.001&&(!headHidden||state.showHidden)){
    const head=imgFor('line_head');if(head&&head.naturalWidth)__milDrawRotTinted(head,cx,cy,headSize,headSize,180-st.rotation,headHidden?Math.min(.45,headAlpha):headAlpha,st.color);else{ctx.strokeStyle=cssRgba(st.color,headHidden?Math.min(.45,headAlpha):headAlpha);ctx.lineWidth=Math.max(.25,lineWidth/2);ctx.beginPath();ctx.arc(cx,cy,headSize/2,0,Math.PI*2);ctx.stroke()}
    if(headHidden)drawHiddenHalo(cx,cy,headSize/2);if(state.appMode!=='play')state.inspectHit.push({kind:'lineHead',label:'判定圈',id:st.lineIdx,hiddenKey:itemKey('lineHead',st.lineIdx),x:cx,y:cy,r:headSize/2});
  }
};

/* Score/HUD caching is owned by js/09-score.js and js/10-gameplay.js. */

/* ---------------- Active-note index / performance ---------------- */
function __targetEarliestAuthoredPreTime(rt,n,base){
  const tracks=rt.events.get(BEARER_NOTE)?.get(n.animIdx);if(!tracks)return base;
  let a=base;
  for(const key of [POS_X,POS_Y,REL_X,REL_Y,FLOW,SIZE,ROTATION,TRANSPARENCY]){
    const tr=tracks.get(key);if(!tr?.events?.length)continue;
    const first=tr.events[0].startSec;if(Number.isFinite(first)&&first<n.startSec&&first<a)a=Math.max(0,first-.05);
  }
  return a;
}
function __targetRebuildActiveIndex(rt){
  rt.__pluLayerNotes=[[],[],[]];const dur=Math.max(0,Number(rt.duration)||0);
  /* A handful of Algebra lines deliberately contain exactly one fake Tap and then
     reuse that line later by toggling WholeTransparency. Treat only those as visual
     line-head anchors. This avoids reviving the dozens of transient fake taps on the
     main gameplay lines (the source of the 108/125/135 s clutter). */
  const fakePerLine=new Map();
  for(const n of rt.notes)if(n.isFake&&!n.isHold){let q=fakePerLine.get(n.lineIdx);if(!q)fakePerLine.set(n.lineIdx,q=[]);q.push(n)}
  for(const [li,q] of fakePerLine){
    if(q.length!==1)continue;const n=q[0],tr=rt.events.get(BEARER_LINE)?.get(li)?.get(WHOLE_ALPHA);if(!tr?.events?.length)continue;
    const after=tr.events.filter(e=>e.startSec>n.startSec+1e-6),hasLaterVisible=after.some(e=>Math.max(Number(e.fv)||0,Number(e.tv)||0)>.001);
    if(!hasLaterVisible)continue;const last=tr.events[tr.events.length-1];if(last.startSec>n.startSec+.18)n.__targetDecorativeFakeEnd=Math.min(dur,last.endSec||last.startSec);
  }
  for(const n of rt.notes){
    const layer=noteLayer(n);rt.__pluLayerNotes[layer]?.push(n);
    // No fixed lookahead: negative/zero speed and authored positions can be visible at any time.
    if(n.isFake&&!n.isHold){const e=__targetDecorativeFakeEnd(rt,n);n.activeTo=e>n.startSec+1e-6?Math.max(n.activeTo,e):Math.min(n.activeTo,n.startSec)}
  }
  rt.notes.forEach((n,i)=>{n.__drawOrder=i});
  function tree(notes,lo=0,hi=notes.length){
    if(lo>=hi)return null;const mid=(lo+hi)>>1,note=notes[mid],left=tree(notes,lo,mid),right=tree(notes,mid+1,hi);
    return {note,left,right,maxEnd:Math.max(note.activeTo,left?.maxEnd??-Infinity,right?.maxEnd??-Infinity)};
  }
  rt.__activeTrees=rt.__pluLayerNotes.map(notes=>tree([...notes].sort((a,b)=>a.activeFrom-b.activeFrom||a.__drawOrder-b.__drawOrder)));
  rt.__activeScratch=[[],[],[]];
}
const __targetPrecompute=precompute;
precompute=function(rt){__targetPrecompute(rt);__targetRebuildActiveIndex(rt)};
/* Re-index the already loaded chart too, because this patch is appended after initial
   function definitions and can also be injected into a live review page. */
if(state.runtime)__targetRebuildActiveIndex(state.runtime);

/* Default landing state. Editor still keeps its always-visible hand annotations, while
   play mode owns a separate remembered checkbox value (false on first load). */
state.appMode='play';state.__playShowHands=false;state.showHandTextures=false;document.body.dataset.mode='play';
if(els.showHandsToggle)els.showHandsToggle.checked=false;
updateModeUI();updateControls();

window.__targetedReviewSelfTest=function(){
  const failures=[],ok=(v,m)=>{if(!v)failures.push(m)};
  try{
    const anchor=state.runtime?.notes?.find(n=>n.isFake&&!n.isHold&&__targetDecorativeFakeEnd(state.runtime,n)>n.startSec);if(anchor)ok(anchor.activeTo>=__targetDecorativeFakeEnd(state.runtime,anchor)-1e-6,'decorative fake head indexed through reuse window');
    const drag={type:NOTE_DRAG,isMore:true,isAlwaysPerfect:true,note:{_hand:'r'}};ok(noteTextureKey(drag)==='drag_double','AP Drag uses ordinary drag_double');
    const plainDrag={type:NOTE_DRAG,isMore:false,isAlwaysPerfect:false,note:{_hand:'l'}};ok(noteTextureKey(plainDrag)==='drag','Drag ignores hand order');
    const b=__targetSbBaseSize('builtin.extap',{w:923,h:923},1280,720);ok(b.w>350&&b.w<370,'builtin extap uses 300-Mil visible storyboard footprint');ok(Math.abs(b.w*.5*(510/923)-100)<1,'Algebra 188s Size=.5 extap has 100px visible diameter at 1280x720');
    const l=__targetSbBaseSize('builtin.line',{w:512,h:1},1280,720);ok(l.w>6000&&l.h>2,'builtin line effectively unbounded');
    if(String(document.getElementById('songTitle')?.textContent||'').toLowerCase().includes('algebra')){
      const decorative=state.runtime.notes.filter(n=>n.isFake&&!n.isHold&&__targetDecorativeFakeEnd(state.runtime,n)>n.startSec);
      const activeAt=t=>decorative.filter(n=>transformLine(state.runtime,n.lineIdx,t,1280,720).wholeAlpha>.001).length;
      ok(activeAt(108)===0,'Algebra 108s has no persistent fake heads');
      ok(activeAt(135)===2,'Algebra 135s has exactly two authored persistent fake heads');
      ok(activeAt(155)===3,'Algebra 155.000s has exactly three authored persistent fake heads');
      ok(activeAt(155.30)===4,'Algebra 155.300s reveals the fourth authored persistent fake head');
      const transient=state.runtime.notes.find(n=>n.isFake&&!n.isHold&&n.lineIdx===0);if(transient)ok(__targetDecorativeFakeEnd(state.runtime,transient)<=transient.startSec+1e-6,'main-line transient fake tap is not persisted');
    }
    ok(Math.abs(__targetUnityUiScale(1280,720)-1.6)<1e-6,'Unity CanvasScaler Shrink scale');
    ok(state.appMode==='play'&&state.__playShowHands===false,'default play / hands off');
    ok(!els.showHandsLabel&&!els.showHandsToggle,'hand-order toggle removed from DOM');
    ok(!els.restoreBar?.querySelector('button'),'obsolete restore/ignore buttons removed');
    /* Independent score oracles live in tests/score.test.cjs. */
  }catch(e){failures.push(e?.stack||String(e))}
  return{ok:!failures.length,version:__TARGET_PATCH,failures};
};
render();
})();
