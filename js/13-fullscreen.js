(()=>{
'use strict';
const wrap=els.stageWrap;
if(!wrap)return;
const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
const isNative=()=>nativeElement()===wrap;
const isFallback=()=>wrap.classList.contains('nativePlayFullscreen');
// Safari 12 cannot evaluate the viewport min()/dvh sizing in the fullscreen CSS.
const legacySizing=!window.CSS||!CSS.supports('width','min(100vw, 100dvh)');
function syncLegacySize(){
  if(!legacySizing||!els.stageInner)return;
  if(isNative()||isFallback()){
    const ratio=state.stageRatio||16/9,w=state.stageRatioCustom?Math.min(innerWidth,innerHeight*ratio):innerWidth;
    els.stageInner.style.setProperty('width',w+'px','important');
    els.stageInner.style.setProperty('height',(state.stageRatioCustom?w/ratio:innerHeight)+'px','important');
  }else{
    els.stageInner.style.removeProperty('width');els.stageInner.style.removeProperty('height');
  }
}
window.__milSyncLegacyFullscreenSize=syncLegacySize;
function clearOldExpanded(){wrap.classList.remove('playExpanded');document.documentElement.classList.remove('playExpandedRoot');document.body.classList.remove('playExpandedRoot')}
async function unlockOrientation(){try{screen.orientation?.unlock?.()}catch{}}
async function unlockKeyboard(){try{await navigator.keyboard?.unlock?.()}catch{}}
async function leave(){
  window.__gpEscPauseGuardUntil=0;
  try{window.__gpHideResult?.(true)}catch{}
  await unlockKeyboard();
  if(isNative()){try{await (document.exitFullscreen?.()||document.webkitExitFullscreen?.())}catch{}}
  wrap.classList.remove('nativePlayFullscreen','nativeLandscapeFallback');clearOldExpanded();await unlockOrientation();
  syncLegacySize();
  if(typeof markStageResize==='function')markStageResize();resizeCanvas();render();
}
async function enter(){
  window.__gpEscPauseGuardUntil=0;clearOldExpanded();wrap.classList.remove('nativePlayFullscreen','nativeLandscapeFallback');
  let nativeOk=false;
  try{if(wrap.requestFullscreen){await wrap.requestFullscreen({navigationUI:'hide'});nativeOk=true}else if(wrap.webkitRequestFullscreen){await wrap.webkitRequestFullscreen();nativeOk=true}}catch{}
  if(!nativeOk&&!isNative())wrap.classList.add('nativePlayFullscreen');
  if(isNative())try{await navigator.keyboard?.lock?.(['Escape'])}catch{}
  await unlockOrientation();
  syncLegacySize();
  requestAnimationFrame(()=>{if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()});
}
window.__gpLeaveGameplayFullscreen=leave;window.__gpEnterGameplayFullscreen=enter;window.__gpGameplayFullscreenActive=()=>isNative()||isFallback();
requestLandscapeFullscreen=async function(){if(isNative()||isFallback())await leave();else await enter()};
function sync(){
  if(!isNative()&&!isFallback()){
    if((Number(window.__gpEscPauseGuardUntil)||0)>performance.now())wrap.classList.add('nativePlayFullscreen');
    else{wrap.classList.remove('nativeLandscapeFallback');unlockKeyboard();unlockOrientation();try{window.__gpHideResult?.(true)}catch{}}
  }
  if(isNative()||isFallback())wrap.classList.remove('nativeLandscapeFallback');
  syncLegacySize();
  requestAnimationFrame(()=>{if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()})
}
document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);window.addEventListener('orientationchange',sync,{passive:true});window.addEventListener('resize',()=>{if(isNative()||isFallback())sync()},{passive:true});
})();
