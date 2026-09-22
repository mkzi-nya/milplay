(()=>{
'use strict';
/* RainPlayerUnity-compatible ordinary-note gameplay.  MilPlayment.cs in the supplied
 * project implements Hit/Drag/Hold only; Fracture/Lightning is deliberately kept out
 * of ordinary judgement/score because the supplied Milthm semantics define it as a
 * separate judgement sequence and the supplied Unity player has no Fracture playment. */
const GP_WINDOWS={Exact:.035,Perfect:.070,Great:.105,Good:.140,Bad:.155};
const GP_ACC={Exact:1,Perfect:.9,Great:.6,Good:.3,Bad:.15,Miss:0};
const GP_HIT_STATES=new Set(['Exact','Perfect','Great','Good']);
const GP_STEP=1/120;
// Compatibility policy: original DLL contains signatures only, not the temporal
// predicate. Keep the provisional +/-50 ms lightning window explicit and isolated.
const GP_LIGHTNING_WINDOW=.05;
const GP_EL_COLORS={normal:[220,202,255],good:[122,233,197],bad:[255,0,0]};
const gp={
  rt:null,entries:new Map(),touches:new Map(),combo:0,maxCombo:0,accSum:0,fullAcc:0,
  cuts:{Exact:0,Perfect:0,Great:0,Good:0,Bad:0,Miss:0},allCombo:0,judgeSequence:[],
  touchHoldEnd:0,holdLasts:-1e9,lastFixed:-GP_STEP,indicatorBalls:[],autoplay:false
};
const gpKeys=new Set();
/* Drop every held synthetic/pointer touch and keyboard lane. Called whenever the
 * timeline or mode changes, playback pauses, or the window loses focus, so a stale
 * key id can never wedge a lane and swallow the next keydown. */
function gpReleaseInput(){gpKeys.clear();gp.touches.clear();gp.touchHoldEnd=0;gp.holdLasts=-1e9}
state.realGameplay=gp;
state.autoplay=false;

function gpIsPlay(){return state.appMode==='play'&&!!state.runtime}
function gpOrdinary(n){return !!n&&!n.isFake&&n.type!==NOTE_FRACTURE&&(n.type===NOTE_HIT||n.type===NOTE_DRAG)}
function gpEntry(n){
  let e=gp.entries.get(n.key);
  if(!e){e={judgeState:'Miss',judgeTime:n.startSec+Math.max(GP_WINDOWS.Bad*2,.14),judgeHited:false,judgeIsMiss:false,judgeMissTime:n.endSec,
    headJudged:false,dragPrejudge:false,prejudgeTime:0,judgeHoldLastCheck:0,prejudgeTouches:new Set(),gaveEndCombo:false,judgeIsGood:false,
    hitParticleOffset:0,seekHeld:false};gp.entries.set(n.key,e)}
  return e;
}
function gpSubmitAcc(v){gp.accSum+=Number(v)||0;gp.fullAcc++}
function gpAddCombo(){gp.combo++;gp.maxCombo=Math.max(gp.maxCombo,gp.combo)}
function gpRemoveCombo(){gp.combo=0}
function gpCut(name){
  gp.cuts[name]=(gp.cuts[name]||0)+1;
  const code={Exact:'e',Perfect:'p',Great:'g',Good:'n',Bad:'b',Miss:'m'}[name];
  if(code)gp.judgeSequence.push(code);
}
function gpJudgeState(n,offset){
  /* Reference grader (WASM func 290) uses strict f64.lt at every threshold, so a
   * value exactly on a boundary falls through to the next (worse) grade, and the
   * Bad window is [0.140, 0.155) with >=0.155 a Miss.  AP notes are forced to
   * Exact only while the offset is inside the Good window (a < 0.140); at or
   * beyond it they are a Miss, matching the reference's note-flag select. */
  const a=Math.abs(offset);let s=a<GP_WINDOWS.Exact?'Exact':a<GP_WINDOWS.Perfect?'Perfect':a<GP_WINDOWS.Great?'Great':a<GP_WINDOWS.Good?'Good':a<GP_WINDOWS.Bad?'Bad':'Miss';
  if(n.isAlwaysPerfect)s=GP_HIT_STATES.has(s)?'Exact':'Miss';
  return s;
}
function gpCallback(name,offset,at=state.currentTime){
  if(name==='Exact')return;
  const kind=name==='Perfect'?'normal':((name==='Great'||name==='Good')?'good':'bad');
  gp.indicatorBalls.push({name,offset:Number(offset)||0,at:Number(at)||0,kind});
  if(gp.indicatorBalls.length>48)gp.indicatorBalls.splice(0,gp.indicatorBalls.length-48);
}
function gpOrdinaryComboTimes(rt=state.runtime){const out=[];for(const n of rt?.notes||[]){if(!gpOrdinary(n))continue;out.push(n.startSec);if(n.isHold)out.push(n.endSec)}out.sort((a,b)=>a-b);return out}
function gpOrdinaryComboAt(sec){const a=gp.comboTimes||[];let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<=sec)lo=m+1;else hi=m}return lo}
function gpFresh(rt=state.runtime){
  gp.rt=rt;gp.entries=new Map();gp.touches.clear();gpKeys.clear();gp.combo=0;gp.maxCombo=0;gp.accSum=0;gp.fullAcc=0;gp.judgeSequence=[];
  gp.lightning=(rt?.notes||[]).filter(n=>n.type===NOTE_FRACTURE&&!n.isFake).sort((a,b)=>a.startSec-b.startSec);
  gp.lightningCursor=0;gp.lightningResults=new Map();gp.lightningPass=0;gp.lightningMiss=0;
  gp.comboTimes=gpOrdinaryComboTimes(rt);gp.cuts={Exact:0,Perfect:0,Great:0,Good:0,Bad:0,Miss:0};gp.allCombo=gp.comboTimes.length;
  gp.touchHoldEnd=0;gp.holdLasts=-1e9;gp.lastFixed=-GP_STEP;gp.indicatorBalls=[];gp.effectKeys=new Set();gp.noteByKey=new Map();gp.timeBuckets=new Map();
  gp.longNotes=[];
  const span=GP_WINDOWS.Bad*2,bs=.25;gp.bucketSec=bs;for(const n of rt?.notes||[]){if(!gpOrdinary(n))continue;gp.noteByKey.set(n.key,n);const a=Math.max(0,n.startSec-span),b=(n.isHold?n.endSec:n.startSec)+span,i0=Math.floor(a/bs),i1=Math.floor(Math.max(a,b)/bs);if(i1-i0>256){gp.longNotes.push(n);continue}for(let i=i0;i<=i1;i++){let q=gp.timeBuckets.get(i);if(!q)gp.timeBuckets.set(i,q=[]);q.push(n)}}
  for(const q of gp.timeBuckets.values())q.sort((a,b)=>a.startSec-b.startSec||a.globalIdx-b.globalIdx);
}
function gpAwardExactHead(n,e){
  e.judgeState='Exact';e.judgeTime=n.startSec;e.judgeHited=true;e.headJudged=true;e.hitParticleOffset=0;e.judgeIsGood=false;
  gpSubmitAcc(1);gpCut('Exact');gpAddCombo();
}
function gpRebuildExactBefore(target){
  const rt=state.runtime;gpFresh(rt);target=clamp(Number(target)||0,0,rt?.duration||0);
  if(!rt){gp.lastFixed=target-GP_STEP;return}
  while(gp.lightningCursor<gp.lightning.length&&gp.lightning[gp.lightningCursor].startSec<target){const n=gp.lightning[gp.lightningCursor++];gp.lightningResults.set(n.key,{result:'Pass',time:n.startSec});gp.lightningPass++}
  for(const n of rt.notes){
    if(!gpOrdinary(n)||!(n.startSec<target))continue;
    const e=gpEntry(n);gpAwardExactHead(n,e);
    if(n.isHold){
      if(n.endSec<target){gpSubmitAcc(1);gpCut('Exact');gpAddCombo();e.gaveEndCombo=true;e.judgeHoldLastCheck=n.endSec;e.seekHeld=false}
      else{e.judgeHoldLastCheck=target;e.seekHeld=true}
    }
  }
  gp.lastFixed=target-GP_STEP;
}
function gpEnsure(){if(gp.rt!==state.runtime)gpFresh(state.runtime)}
function gpSetAutoplay(on){
  gp.autoplay=!!on;state.autoplay=gp.autoplay;gpReleaseInput();
  if(gpIsPlay())gpRebuildExactBefore(state.currentTime||0);
  const box=document.getElementById('autoplayToggle');if(box&&box.checked!==gp.autoplay)box.checked=gp.autoplay;
  render();
}

/* WebCanvas2DTransform operations copied algebraically from Utils.cs. */
function gpMat(){return[1,0,0,1,0,0]}
function gpTransform(m,a,b,c,d,e,f){return[
  m[0]*a+m[2]*b,m[1]*a+m[3]*b,m[0]*c+m[2]*d,m[1]*c+m[3]*d,
  m[0]*e+m[2]*f+m[4],m[1]*e+m[3]*f+m[5]
]}
function gpTranslate(m,x,y){return gpTransform(m,1,0,0,1,x,y)}
function gpScale(m,x,y){return gpTransform(m,x,0,0,y,0,0)}
function gpRotate(m,deg){const a=Math.PI*deg/180,c=Math.cos(a),s=Math.sin(a);return gpTransform(m,c,s,-s,c,0,0)}
function gpInverse(m){const det=m[0]*m[3]-m[1]*m[2],q=det===0?1e9:1/det;return[m[3]*q,-m[1]*q,-m[2]*q,m[0]*q,(m[2]*m[5]-m[3]*m[4])*q,(m[1]*m[4]-m[0]*m[5])*q]}
function gpPoint(m,x,y){return{x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}}
let gpStageRect=null,gpStageRectStamp=-1;
function gpRefreshStageRect(){gpStageRect=els.stage.getBoundingClientRect();gpStageRectStamp=performance.now();return gpStageRect}
function gpCanvasPoint(ev,refresh=false){const r=(refresh||!gpStageRect||performance.now()-gpStageRectStamp>1000)?gpRefreshStageRect():gpStageRect,rotated=els.stageWrap?.classList?.contains('nativeLandscapeFallback')&&matchMedia?.('(orientation:portrait)')?.matches,sx=clamp((ev.clientX-r.left)/Math.max(1,r.width),0,1),sy=clamp((ev.clientY-r.top)/Math.max(1,r.height),0,1);if(rotated)return{x:Math.trunc(sy*els.stage.width),y:Math.trunc((1-sx)*els.stage.height)};return{x:Math.trunc(sx*els.stage.width),y:Math.trunc(sy*els.stage.height)}}
function gpEventTime(ev){const base=gpInputTime(),stamp=Number(ev?.timeStamp),now=performance.now(),age=Number.isFinite(stamp)&&Math.abs(now-stamp)<10000?clamp(now-stamp,0,120):0;return clamp(base-age/1000*(Number(state.rate)||1),0,state.duration||0)}
function gpInputTime(){
  if(!gpIsPlay())return Number(state.currentTime)||0;
  if(state.playing&&state.mediaUrl&&state.mediaReady&&els.audioPlayer&&!els.audioPlayer.paused)return mediaToChartTime(els.audioPlayer.currentTime);
  if(state.playing){const elapsed=Math.max(0,(performance.now()-(Number(state.lastTick)||performance.now()))/1000)*(Number(state.rate)||1);return clamp((Number(state.currentTime)||0)+elapsed,0,state.duration||0)}
  return Number(state.currentTime)||0;
}
function gpRelTouchPoint(t,n,touch){
  if(touch.isKey)return{x:0,y:0,__screenXScale:1};
  const rt=state.runtime,w=els.stage.width,h=els.stage.height;
  const posX=rt.lineValue(n.lineIdx,POS_X,t),posY=rt.lineValue(n.lineIdx,POS_Y,t),relX=rt.lineValue(n.lineIdx,REL_X,t),relY=rt.lineValue(n.lineIdx,REL_Y,t);
  const lineCenterX=(posX+relX)/1920*w,lineCenterY=(posY+relY)/1080*h;
  const lineSize=rt.lineValue(n.lineIdx,SIZE,t),lineRot=rt.lineValue(n.lineIdx,ROTATION,t);
  const noteScale=rt.noteValue(n,SIZE,t),noteRot=rt.noteValue(n,ROTATION,t);
  let m=gpMat();m=gpTranslate(m,lineCenterX,lineCenterY);m=gpScale(m,lineSize,lineSize);m=gpRotate(m,90-lineRot);m=gpScale(m,noteScale,noteScale);m=gpRotate(m,noteRot);
  const centeredX=touch.x-w/2,centeredY=h/2-touch.y;
  const p=gpPoint(gpInverse(m),centeredX,centeredY);p.__screenXScale=Math.max(1e-6,Math.hypot(m[0],m[1]));return p;
}
function gpIsHit(t,n,touch){
  const w=els.stage.width,h=els.stage.height,p=gpRelTouchPoint(t,n,touch),jw=485.99991/1920*w,jh=2202.27645/1080*h,jdy=772.32375/1080*h;
  /* RainPlayer's desktop/source box remains 486/1920 wide. On coarse/mobile input,
     enforce the requested lane width in SCREEN space: one judgement lane = 1/6
     of the visible gameplay width, independent of line/note scale or rotation. */
  const coarse=(navigator.maxTouchPoints||0)>0||matchMedia?.('(pointer:coarse)')?.matches,xOk=coarse?(Math.abs(p.x)*(p.__screenXScale||1)<=w/12):(-jw/2<=p.x&&p.x<=jw/2);
  return xOk&&-jh/2<=p.y-jdy&&p.y-jdy<=jh/2;
}
function gpGetNotes(t,touch=null){
  const src=gp.timeBuckets?.get(Math.floor(Math.max(0,t)/(gp.bucketSec||.25)))||[],out=[];
  for(const n of src){if((!n.isHold&&n.startSec-GP_WINDOWS.Bad*2<=t&&t<=n.startSec+GP_WINDOWS.Bad*2)||(n.isHold&&n.startSec-GP_WINDOWS.Bad*2<=t&&t<=n.endSec+GP_WINDOWS.Bad*2))out.push(n)}
  for(const n of gp.longNotes||[])if(n.startSec-GP_WINDOWS.Bad*2<=t&&t<=n.endSec+GP_WINDOWS.Bad*2)out.push(n);
  if(gp.longNotes?.length)out.sort((a,b)=>a.startSec-b.startSec||a.globalIdx-b.globalIdx);
  /* Buckets are pre-sorted. Fixed updates do not need to allocate/sort at 120 Hz;
     only a real touch needs RainPlayer's <=20 ms distance tie-break. */
  if(touch!=null)out.sort((a,b)=>{if(Math.abs(a.startSec-b.startSec)>.020)return a.startSec-b.startSec;const pa=gpRelTouchPoint(t,a,touch),pb=gpRelTouchPoint(t,b,touch);return Math.hypot(pa.x,pa.y)-Math.hypot(pb.x,pb.y)});
  return out;
}
function gpTouchStart(sig,p,isKey=false,eventTime=null){
  if(!gpIsPlay()||!state.playing||gp.autoplay)return;gpEnsure();const t=eventTime==null?gpInputTime():Number(eventTime);
  let touch=gp.touches.get(sig);if(!touch){touch={sig,x:p.x,y:p.y,startTime:t,isKey:!!isKey,holdTouchEnd:gp.touchHoldEnd};gp.touches.set(sig,touch)}
  else{touch.isKey=!!isKey;touch.x=p.x;touch.y=p.y;touch.startTime=t}
  for(const n of gpGetNotes(t,touch)){
    const e=gpEntry(n);
    if(gpIsHit(t,n,touch)&&!e.headJudged&&n.startSec-GP_WINDOWS.Bad<t&&n.type===NOTE_HIT){
      const offset=t-n.startSec,name=gpJudgeState(n,offset);e.judgeState=name;
      if(GP_HIT_STATES.has(name)){
        e.judgeTime=t;e.judgeHited=true;e.headJudged=true;e.hitParticleOffset=offset;e.judgeIsGood=name==='Great'||name==='Good';gp.effectKeys.add(n.key);gpCallback(name,offset,t);
        if(n.isHold){e.judgeHoldLastCheck=t;gp.touchHoldEnd=Math.max(n.endSec,gp.touchHoldEnd)}
        touch.holdTouchEnd=gp.touchHoldEnd;
        for(const tc of gp.touches.values())if(Math.abs(tc.startTime-gp.holdLasts)<.3)tc.holdTouchEnd=gp.touchHoldEnd;
        gpAddCombo();gpSubmitAcc(GP_ACC[name]);gpCut(name);if(n.isHold)gp.holdLasts=n.startSec;break;
      }
      if(name==='Bad'&&!n.isHold){
        /* A Bad is a terminal judgement: consume the note exactly once so the
           late-miss sweep cannot record a follow-up Miss and a second press
           cannot re-judge it. Bad still resets combo and awards Bad accuracy. */
        gpCallback('Bad',offset,t);e.judgeTime=t;e.judgeHited=true;e.headJudged=true;e.judgeIsMiss=false;gpSubmitAcc(GP_ACC.Bad);gpCut('Bad');gpRemoveCombo();break
      }
      e.judgeState='Miss';
    }
  }
  gpUpdateAt(t);
}
function gpTouchMove(sig,p,eventTime=null){if(!gpIsPlay()||gp.autoplay)return;const touch=gp.touches.get(sig);if(!touch)return;touch.x=p.x;touch.y=p.y;gpUpdateAt(eventTime==null?gpInputTime():Number(eventTime))}
function gpTouchEnd(sig,p,eventTime=null){if(!gpIsPlay()||gp.autoplay)return;const touch=gp.touches.get(sig);if(touch&&p){touch.x=p.x;touch.y=p.y}const t=eventTime==null?gpInputTime():Number(eventTime);gpLightningUpdate(t);gp.touches.delete(sig);gpUpdateAt(t)}
function gpLightningHit(n,t,touch){
  if(touch.isKey)return true;
  const w=els.stage.width,h=els.stage.height,st=transformLine(gp.rt,n.lineIdx,t,w,h),f=__pluNoteFrame(gp.rt,n,t,st,w,h);
  if(!f)return false;
  // Fracture.prefab: BoxCollider offset (30,0), size (67.9715,6).
  // fracture.asset: sprite width 236.84775 pixels, 59.122402 pixels/world unit.
  const unit=f.visualW/(236.84775/59.122402),a=f.rotation*Math.PI/180;
  const dx=touch.x-f.center.x,dy=touch.y-f.center.y;
  const x=(dx*Math.cos(a)+dy*Math.sin(a))/unit,y=(-dx*Math.sin(a)+dy*Math.cos(a))/unit;
  return Math.abs(x-30)<=67.9715/2&&Math.abs(y)<=3;
}
function gpLightningUpdate(t){
  const notes=gp.lightning||[];
  for(let i=gp.lightningCursor;i<notes.length&&notes[i].startSec-GP_LIGHTNING_WINDOW<=t;i++){
    const n=notes[i];if(gp.lightningResults.has(n.key))continue;
    let hit=false;
    if(t<=n.startSec+GP_LIGHTNING_WINDOW)for(const touch of gp.touches.values())if(gpLightningHit(n,t,touch)){hit=true;break}
    if(hit||t>n.startSec+GP_LIGHTNING_WINDOW){
      gp.lightningResults.set(n.key,{result:hit?'Miss':'Pass',time:t});
      if(hit){gp.lightningMiss++;gpCallback('Miss',0,t)}else gp.lightningPass++;
    }
  }
  while(gp.lightningCursor<notes.length&&gp.lightningResults.has(notes[gp.lightningCursor].key))gp.lightningCursor++;
}
window.__gpLightningStats=function(sec=state.currentTime){
  gpEnsure();const total=gp.lightning.length;
  const passed=gp.autoplay?__pluLowerByStart(gp.lightning,sec+1e-9):gp.lightningPass;
  return {total,passed,missed:gp.autoplay?0:gp.lightningMiss,pending:total-passed-(gp.autoplay?0:gp.lightningMiss)};
};
window.__gpRebindRuntime=function(rt){
  const old=gp.rt,same=old&&old.notes.length===rt.notes.length&&old.notes.every((n,i)=>{const m=rt.notes[i];return n.key===m.key&&n.startSec===m.startSec&&n.endSec===m.endSec&&n.type===m.type&&n.isFake===m.isFake&&n.isAlwaysPerfect===m.isAlwaysPerfect});
  if(!same){gpRebuildExactBefore(state.currentTime);return}
  // Resize recompiles geometry, not the player's already recorded judgments.
  const saved={touches:new Map(gp.touches)},keys=[...gpKeys];for(const key of ['entries','combo','maxCombo','accSum','fullAcc','judgeSequence','cuts','lastFixed','indicatorBalls','effectKeys','lightningResults','lightningCursor','lightningPass','lightningMiss','touchHoldEnd','holdLasts'])saved[key]=gp[key];
  gpFresh(rt);Object.assign(gp,saved);for(const key of keys)gpKeys.add(key);
};
function gpHoldSustained(n){for(const tc of gp.touches.values())if(tc.holdTouchEnd>=n.endSec)return true;return false}
/* Hold/Drag pre-end activation.  The reference lets a hold/drag that was never
 * head-judged still be caught while the playhead is within 300 ms of its end
 * (`note.endTime - 0.3 <= t`); the AP variant instead uses the head window
 * (`t - note.startTime <= 0.05`).  Activation is Exact, matching the reference's
 * forced activation grade and the existing drag-prejudge path. */
function gpTryPreEndActivate(n,t,e){
  if(!(n.isHold||n.type===NOTE_DRAG)||e.headJudged||e.judgeIsMiss||e.judgeHited)return false;
  /* Only long notes need this: for a note whose head window has already closed
     (end - 0.3 > start) a touch in the final 300 ms still activates it.  AP uses
     the head window (t - start <= 0.05).  Short notes stay on the normal path. */
  const allow=n.isAlwaysPerfect?((t-n.startSec)<=.05):(n.endSec-.3>n.startSec&&(n.endSec-.3)<=t);
  if(!allow)return false;
  for(const touch of gp.touches.values()){
    if(!gpIsHit(t,n,touch))continue;
    e.judgeHited=true;e.headJudged=true;e.judgeTime=t;e.judgeState='Exact';e.hitParticleOffset=Math.max(0,t-n.startSec);e.judgeIsGood=false;
    gp.effectKeys.add(n.key);gpCallback('Exact',e.hitParticleOffset,t);
    if(n.isHold){e.judgeHoldLastCheck=t;gp.touchHoldEnd=Math.max(n.endSec,gp.touchHoldEnd);touch.holdTouchEnd=gp.touchHoldEnd}
    gpSubmitAcc(1);gpCut('Exact');gpAddCombo();return true;
  }
  return false;
}
function gpProcessNote(n,t,catchup=false){
  const e=gpEntry(n);
  for(const touch of gp.touches.values()){
    if(n.type===NOTE_DRAG&&!e.headJudged&&gpIsHit(t,n,touch)){
      const offset=t-n.startSec,stateName=gpJudgeState(n,offset);if(GP_HIT_STATES.has(stateName)){e.prejudgeTouches.add(touch.sig);if(!e.dragPrejudge){e.dragPrejudge=true;e.prejudgeTime=t}}
    }
    if(n.isHold&&touch.holdTouchEnd>=t&&e.headJudged)e.judgeHoldLastCheck=t;
  }
  if(e.seekHeld&&n.isHold&&e.headJudged&&!e.judgeIsMiss&&t<n.endSec)e.judgeHoldLastCheck=t;
  if(n.type===NOTE_DRAG&&!e.headJudged&&e.dragPrejudge&&n.startSec<=t){
    e.judgeHited=true;e.headJudged=true;e.judgeTime=Math.max(n.startSec,t);e.judgeState='Exact';e.hitParticleOffset=e.judgeTime-n.startSec;gp.effectKeys.add(n.key);gpCallback('Exact',0,t);
    for(const sig of e.prejudgeTouches){const tc=gp.touches.get(sig);if(tc)tc.holdTouchEnd=gp.touchHoldEnd}e.prejudgeTouches.clear();gpSubmitAcc(1);gpCut('Exact');gpAddCombo();
  }
  /* A touched hold/drag inside its end-activation window is caught here before
     any late-Miss sweep, so a long note whose head window closed can still be
     activated.  With no touch the ordinary late-Miss below still applies. */
  gpTryPreEndActivate(n,t,e);
  if(n.isHold&&(((e.headJudged&&!e.judgeIsMiss&&t-e.judgeHoldLastCheck>=.05&&n.endSec-.3>=t)||(!e.headJudged&&t-n.startSec>=GP_WINDOWS.Bad)))&&!e.judgeIsMiss){
    e.judgeIsMiss=true;e.judgeMissTime=t;gpRemoveCombo();gpSubmitAcc(0);gpCut('Miss');if(!e.headJudged)gpCallback(e.judgeState,t-n.startSec,t);
  }
  if(catchup&&n.isHold&&e.headJudged&&!e.judgeIsMiss&&!e.gaveEndCombo&&n.endSec<t&&!gpHoldSustained(n)){
    /* Skipped straight past the hold's end: if no touch sustained it, match the
       normal-release path and record Miss instead of granting the end combo. */
    e.judgeIsMiss=true;e.judgeMissTime=Math.min(t,n.endSec);gpRemoveCombo();gpSubmitAcc(0);gpCut('Miss');
  }
  if(n.isHold&&e.headJudged&&!e.judgeIsMiss&&n.endSec<t&&!e.gaveEndCombo){
    gpSubmitAcc(1);gpAddCombo();e.gaveEndCombo=true;e.seekHeld=false;if(e.judgeState==='Exact')gpCut('Exact');else if(e.judgeState==='Perfect')gpCut('Perfect');else if(e.judgeState==='Great')gpCut('Great');else if(e.judgeState==='Good')gpCut('Good');
  }
  if(!n.isHold&&!e.headJudged&&!e.judgeIsMiss&&t-n.startSec>=GP_WINDOWS.Bad){
    if(!e.dragPrejudge){e.judgeIsMiss=true;gpCallback(e.judgeState,t-n.startSec,t);e.judgeMissTime=t;gpSubmitAcc(0);gpCut('Miss');gpRemoveCombo()}
  }
}
function gpUpdateAt(t){
  if(!gpIsPlay()||gp.autoplay)return;const notes=gpGetNotes(t,null);
  gpLightningUpdate(t);
  for(const n of notes)gpProcessNote(n,t,false);
}
/* Forward stalls (rAF pause, GC, media glitch) can jump past a note's whole
 * judgement window. Sweep the skipped interval through the existing time buckets so
 * those notes still resolve, bounding work to the buckets that actually exist there;
 * extremely long jumps fall back to the chart's note list. No allocation/sort at 120 Hz. */
const GP_SWEEP_MAX_BUCKETS=4096;
function gpSweepSkipped(fromT,toT){
  gpLightningUpdate(toT);
  const bs=gp.bucketSec||.25,span=GP_WINDOWS.Bad*2;
  const i0=Math.floor(Math.max(0,fromT-span)/bs),i1=Math.floor(Math.max(0,toT+span)/bs);
  if(i1-i0>GP_SWEEP_MAX_BUCKETS){for(const n of gp.noteByKey.values())gpProcessNote(n,toT,true);return}
  const seen=gp.sweepSeen||(gp.sweepSeen=new Set());seen.clear();
  for(const n of gp.longNotes||[])gpProcessNote(n,toT,true);
  for(let i=i0;i<=i1;i++){
    const q=gp.timeBuckets.get(i);if(!q)continue;
    for(const n of q){if(seen.has(n.key))continue;seen.add(n.key);gpProcessNote(n,toT,true)}
  }
}
function gpAdvance(t){
  if(!gpIsPlay()||gp.autoplay)return;gpEnsure();
  if(t<gp.lastFixed-.03){gpRebuildExactBefore(t);return}
  /* Unity normally advances only ~1-2 fixed steps per rendered frame. A stalled browser
     must not execute hundreds of catch-up sorts/transforms on the input thread, which
     causes a feedback loop of more jank. Process at most 12 fixed steps, then sweep the
     skipped interval once so passed notes still register their Miss. */
  let guard=0;while(gp.lastFixed+GP_STEP<t&&guard++<12){gpUpdateAt(gp.lastFixed);gp.lastFixed+=GP_STEP}
  if(gp.lastFixed+GP_STEP<t){gpSweepSkipped(gp.lastFixed,t);gp.lastFixed=t-GP_STEP;gpUpdateAt(t)}
}
/* The pure score module owns both formulae and the incremental cursor. */
const score=window.MilScore,scoreCursor=score.cursor();
window.calculateScore=score.calculate;
function gpScoreState(sec=state.currentTime||0){
  gpEnsure();
  return scoreCursor(gp.judgeSequence,gp.allCombo,
    gp.autoplay?gpOrdinaryComboAt(sec):gp.judgeSequence.length,gp.autoplay);
}
function gpScoreBreakdown(forceComplete=false){
  const st=gpScoreState();
  const done=forceComplete||st.len===st.noteAmount||(state.duration>0&&state.currentTime>=state.duration-.001);
  if(!done||st.len===st.noteAmount)return score.snapshot(st,done);
  // Pad only a copy for settlement; opening results cannot contaminate the HUD.
  const settled={...st,counts:{...st.counts}};
  while(settled.len<settled.noteAmount)score.extend(settled,'m');
  return score.snapshot(settled,true);
}
window.__gpScoreBreakdown=gpScoreBreakdown;
function gpProcessScore(){return score.process(gpScoreState())}
window.__gpProcessScore=gpProcessScore;
function gpHudComboLabel(){return score.label(gpScoreState(),gp.autoplay)}
window.__gpHudComboLabel=gpHudComboLabel;
function gpHudMetrics(sec){
  const st=gpScoreState(sec);
  return {score:score.process(st),acc:st.len?st.acc/(st.len*1000000):0,
    combo:st.combo,label:score.label(st,gp.autoplay)};
}
window.__gpHudMetrics=gpHudMetrics;

/* Judgement-dependent particle colors from the supplied Unity prefabs:
 * HitParticle: blue->violet; GoodHitParticle: #85ffbd. */
let gpEffectKind='normal',gpDrawingRing=false;
const gpParticleColorBase=typeof __pluParticleColor==='function'?__pluParticleColor:null;
if(gpParticleColorBase){
  __pluParticleColor=function(p){if(gpEffectKind==='good')return[133,255,189];if(gpDrawingRing)return[150,144,253];const q=clamp(p/.75,0,1);return[142+(162-142)*q,197+(66-197)*q,252+(255-252)*q]};
}
function gpEffectEntry(n,sec){
  if(!gpIsPlay()||n.isFake)return null;if(n.type===NOTE_FRACTURE)return gp.autoplay&&sec>=n.startSec?{allow:true,good:false}:null;
  if(gp.autoplay)return sec>=n.startSec?{allow:true,good:false}:null;
  const e=gpEntry(n);if(!e.headJudged||!e.judgeHited)return null;if(n.isHold&&e.judgeIsMiss&&sec>=e.judgeMissTime)return null;return{allow:true,good:e.judgeIsGood};
}
const gpHitRingRaw=typeof __pluDrawHitRing==='function'?__pluDrawHitRing:null;
const gpParticlesRaw=typeof __pluDrawParticles==='function'?__pluDrawParticles:null;
if(gpHitRingRaw){
  __pluDrawHitRing=function(rt,n,sec,st,w,h){const q=gpEffectEntry(n,sec);if(gpIsPlay()&&!gp.autoplay)return;if(gpIsPlay()&&!q)return;const old=gpEffectKind,oldRing=gpDrawingRing;gpEffectKind=q?.good?'good':'normal';gpDrawingRing=true;try{return gpHitRingRaw(rt,n,sec,st,w,h)}finally{gpEffectKind=old;gpDrawingRing=oldRing}};
}
if(gpParticlesRaw){
  __pluDrawParticles=function(rt,n,sec,st,w,h){const q=gpEffectEntry(n,sec);if(gpIsPlay()&&!gp.autoplay)return;if(gpIsPlay()&&!q)return;const old=gpEffectKind;gpEffectKind=q?.good?'good':'normal';try{return gpParticlesRaw(rt,n,sec,st,w,h)}finally{gpEffectKind=old}};
}
function gpDrawManualEffects(rt,sec,w,h,lineStates=null){
  if(!gpIsPlay()||gp.autoplay||!state.hitEffects)return;
  for(const key of gp.effectKeys){const n=gp.noteByKey.get(key);if(!n){gp.effectKeys.delete(key);continue}const e=gpEntry(n);if(!e.headJudged||!e.judgeHited||sec<e.judgeTime)continue;const age=sec-e.judgeTime,endFx=n.isHold?Math.min(n.endSec,e.judgeIsMiss?e.judgeMissTime:n.endSec)+.5:e.judgeTime+.5;if(sec>endFx){gp.effectKeys.delete(key);continue}
    const st=lineStates?.[n.lineIdx]||transformLine(rt,n.lineIdx,sec,w,h),proxy={...n,startSec:e.judgeTime,endSec:n.isHold?Math.min(n.endSec,e.judgeIsMiss?e.judgeMissTime:n.endSec):e.judgeTime};const old=gpEffectKind,oldRing=gpDrawingRing;gpEffectKind=e.judgeIsGood?'good':'normal';
    /* 特效固定在判定瞬间的实际落点：记录当帧落点，之后不随 note 逐帧移动。 */
    if(typeof __pluAnchorEffectNote==='function')__pluAnchorEffectNote(proxy,e.judgeTime);
    try{if(gpHitRingRaw&&age<=.5){gpDrawingRing=true;gpHitRingRaw(rt,proxy,sec,st,w,h);gpDrawingRing=false}if(gpParticlesRaw&&(!n.isHold?age<=.5:sec<=proxy.endSec+.5))gpParticlesRaw(rt,proxy,sec,st,w,h)}finally{gpEffectKind=old;gpDrawingRing=oldRing}
  }
}
window.__gpDrawManualEffects=gpDrawManualEffects;

/* Gameplay HUD: source-style Combo / Score / Acc plus the Early/Late balls. */
if(typeof drawCombo==='function'){
  drawCombo=function(rt,sec,w,h){
    if(!gpIsPlay())return;const metrics=gpHudMetrics(sec),combo=metrics.combo,score=metrics.score,acc=(metrics.acc*100).toFixed(2)+'%';
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=Math.max(2,w*.002);ctx.fillStyle='rgba(255,255,255,.98)';ctx.textBaseline='middle';ctx.textAlign='center';
    ctx.font=`700 ${Math.max(16,w*.0201)}px ui-sans-serif,system-ui`;ctx.fillText(metrics.label,w*.5,w*.03594);ctx.font=`800 ${Math.max(20,w*.02634)}px ui-sans-serif,system-ui`;ctx.fillText(String(combo),w*.5,w*.06771);
    ctx.textAlign='right';ctx.font=`800 ${Math.max(20,w*.02684)}px ui-monospace,SFMono-Regular,Consolas,monospace`;ctx.fillText(String(score).padStart(7,'0'),w*.915,w*.03958);ctx.fillStyle='rgba(255,255,255,.75)';ctx.font=`600 ${Math.max(14,w*.02014)}px ui-sans-serif,system-ui`;ctx.fillText(acc,w*.915,w*.06684);
    const now=sec;gp.indicatorBalls=gp.indicatorBalls.filter(b=>now-b.at<=.52&&now-b.at>=-.05);const by=41.95082/1080*h,br=Math.max(4,25/1920*w);
    for(const b of gp.indicatorBalls){const age=Math.max(0,now-b.at);let fade=age<.1?age/.1:(age<.3?1:(age<.5?1-(age-.3)/.2:0));if(fade<=0)continue;const c=GP_EL_COLORS[b.kind]||GP_EL_COLORS.bad,x=w*.5+w*.2*b.offset*6;ctx.globalAlpha=.5019608*fade;ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;ctx.beginPath();ctx.arc(x,by,br,0,Math.PI*2);ctx.fill()}
    ctx.globalAlpha=1;ctx.shadowBlur=0;const progress=rt.duration>0?clamp(sec/rt.duration,0,1):0;ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillRect(0,0,w*progress,Math.max(2,w*.0046875));ctx.restore();
  };
}

/* Drive MilPlayment at the source's fixed 120 Hz. */
let gpSeeking=false;
const gpRenderBase=render;
render=function(){if(gpIsPlay()&&!gpSeeking)gpAdvance(state.currentTime||0);return gpRenderBase()};
const gpSeekBase=seek;
seek=function(t){let r;gpSeeking=true;gpReleaseInput();try{r=gpSeekBase(t)}finally{gpSeeking=false}if(gpIsPlay()){gpRebuildExactBefore(state.currentTime||0);render()}return r};
const gpModeBase=typeof setAppMode==='function'?setAppMode:null;
if(gpModeBase)setAppMode=function(mode){const r=gpModeBase(mode);gpReleaseInput();if(mode==='play'){gpRebuildExactBefore(state.currentTime||0);render()}return r};
const gpPlayBase=typeof setPlaying==='function'?setPlaying:null;
if(gpPlayBase)setPlaying=function(v){const r=gpPlayBase(v);if(!state.playing)gpReleaseInput();return r};

/* Pointer Events map one-for-one to touchstart/move/end. */
const stage=els.stage;
function gpLatestPointer(ev){const q=ev.getCoalescedEvents?.();return q&&q.length?q[q.length-1]:ev}
function gpCaptureDown(ev){if(!gpIsPlay()||gp.autoplay||!state.playing)return;if(ev.pointerType==='mouse'&&ev.button!==0)return;ev.preventDefault();ev.stopImmediatePropagation();try{stage.setPointerCapture(ev.pointerId)}catch{}const q=gpLatestPointer(ev);gpTouchStart(ev.pointerId,gpCanvasPoint(q,true),false,gpEventTime(q))}
function gpCaptureMove(ev){if(!gpIsPlay()||gp.autoplay||!gp.touches.has(ev.pointerId))return;ev.preventDefault();ev.stopImmediatePropagation();const q=gpLatestPointer(ev);gpTouchMove(ev.pointerId,gpCanvasPoint(q),gpEventTime(q))}
function gpCaptureUp(ev){if(!gpIsPlay()||gp.autoplay||!gp.touches.has(ev.pointerId))return;ev.preventDefault();ev.stopImmediatePropagation();const q=gpLatestPointer(ev);gpTouchEnd(ev.pointerId,gpCanvasPoint(q),gpEventTime(q));try{stage.releasePointerCapture(ev.pointerId)}catch{}}
stage.addEventListener('pointerdown',gpCaptureDown,{capture:true,passive:false});
/* pointerrawupdate is delivered before render-aligned pointermove on supporting mobile browsers. */
if('onpointerrawupdate' in window)stage.addEventListener('pointerrawupdate',gpCaptureMove,{capture:true,passive:false});else stage.addEventListener('pointermove',gpCaptureMove,{capture:true,passive:false});
stage.addEventListener('pointerup',gpCaptureUp,{capture:true,passive:false});stage.addEventListener('pointercancel',gpCaptureUp,{capture:true,passive:false});
window.addEventListener('resize',()=>{gpStageRect=null},{passive:true});window.addEventListener('orientationchange',()=>{gpStageRect=null},{passive:true});document.addEventListener('fullscreenchange',()=>{gpStageRect=null},{passive:true});

/* A-Z and Space are positionless gameplay touches. */
window.addEventListener('keydown',ev=>{if(!gpIsPlay()||gp.autoplay||!state.playing||ev.repeat||!(/^(?:Key[A-Z]|Space)$/.test(ev.code)))return;const tag=document.activeElement?.tagName||'';if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;const id='key:'+ev.code;if(gpKeys.has(id))return;ev.preventDefault();gpKeys.add(id);gpTouchStart(id,{x:els.stage.width/2,y:els.stage.height/2},true)},true);
window.addEventListener('keyup',ev=>{const id='key:'+ev.code;if(!gpKeys.has(id))return;gpTouchEnd(id,{x:els.stage.width/2,y:els.stage.height/2});gpKeys.delete(id)},true);
/* Focus loss / tab backgrounding must not leave a lane logically held. */
window.addEventListener('blur',gpReleaseInput,{passive:true});
window.addEventListener('pagehide',gpReleaseInput,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)gpReleaseInput()},{passive:true});

const autoBox=document.getElementById('autoplayToggle');if(autoBox){autoBox.checked=false;autoBox.addEventListener('change',()=>gpSetAutoplay(autoBox.checked))}
/* Read-only-ish debug/test surface (mirrors window.__gpScoreBreakdown) used by the
 * headless gameplay verification to drive fixed updates and synthetic input. */
window.__gpTest={get gp(){return gp},get keys(){return [...gpKeys]},fresh:gpFresh,advance:gpAdvance,updateAt:gpUpdateAt,touchStart:gpTouchStart,touchEnd:gpTouchEnd,sweep:gpSweepSkipped,release:gpReleaseInput,rebuild:gpRebuildExactBefore,holdSustained:gpHoldSustained,isHit:gpIsHit,relPoint:gpRelTouchPoint};
gpFresh(state.runtime);
})();
