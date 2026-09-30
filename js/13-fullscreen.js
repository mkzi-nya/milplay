(()=>{
'use strict';
const wrap=els.stageWrap;
if(!wrap)return;
const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
const isNative=()=>nativeElement()===wrap;
const isFallback=()=>wrap.classList.contains('nativePlayFullscreen');
// Safari 12 cannot evaluate the viewport min()/dvh sizing in the fullscreen CSS.
const legacySizing=!window.CSS||!CSS.supports('width','min(100vw, 100dvh)');
/* iOS 12 Safari reports 100vh larger than the visible area (toolbar) and cannot parse
 * dvh, so fullscreen sizing is driven from the live visual viewport instead. */
function viewportSize(){
  const vv=window.visualViewport;
  const w=Math.round((vv&&vv.width)||window.innerWidth||document.documentElement.clientWidth||1);
  const h=Math.round((vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||1);
  return {w,h};
}
function syncLegacySize(){
  if(!legacySizing)return;
  const inner=els.stageInner;if(!inner)return;
  const expanded=isNative()||isFallback()||wrap.classList.contains('playExpanded');
  if(expanded){
    const {w:vw,h:vh}=viewportSize();
    wrap.style.setProperty('width',vw+'px','important');
    wrap.style.setProperty('height',vh+'px','important');
    const ratio=state.stageRatio||16/9,w=state.stageRatioCustom?Math.min(vw,vh*ratio):vw;
    inner.style.setProperty('width',w+'px','important');
    inner.style.setProperty('height',(state.stageRatioCustom?w/ratio:vh)+'px','important');
  }else{
    wrap.style.removeProperty('width');wrap.style.removeProperty('height');
    inner.style.removeProperty('width');inner.style.removeProperty('height');
  }
}
window.__milSyncLegacyFullscreenSize=syncLegacySize;
function clearOldExpanded(){wrap.classList.remove('playExpanded');document.documentElement.classList.remove('playExpandedRoot');document.body.classList.remove('playExpandedRoot');lockDocumentGestures(false)}
/* iOS 12 ignores user-scalable=no for pinch gestures and does not reliably honour
 * touch-action, so a live playfield additionally neutralises pinch/zoom by (a) locking
 * overflow/touch-action inline on the root, and (b) snapping the visual viewport back to
 * scale 1 whenever the page manages to zoom. */
let __milViewportMeta=null,__milViewportOriginal=null;
function viewportMeta(){
  if(__milViewportMeta)return __milViewportMeta;
  __milViewportMeta=document.querySelector('meta[name="viewport"]');
  if(!__milViewportMeta){__milViewportMeta=document.createElement('meta');__milViewportMeta.name='viewport';document.head.appendChild(__milViewportMeta);__milViewportOriginal=''}
  else __milViewportOriginal=__milViewportMeta.getAttribute('content')||'';
  return __milViewportMeta;
}
function lockDocumentGestures(on){
  const html=document.documentElement,body=document.body;
  for(const el of [html,body]){
    if(!el||!el.style)continue;
    if(on){
      if(el.style.getPropertyValue?.('touch-action')!=='none')el.style.setProperty('touch-action','none','important');
      el.style.setProperty('overflow','hidden','important');
    }else{
      el.style.removeProperty('touch-action');el.style.removeProperty('overflow');
    }
  }
  const meta=viewportMeta();
  if(on){
    meta.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover');
  }else if(__milViewportOriginal!==null){
    meta.setAttribute('content',__milViewportOriginal);
  }
}
function resetVisualZoom(){
  /* Toggling maximum-scale is the only reliable way to drop an in-progress WebKit
   * pinch on iOS 12 (touch-action is unsupported and user-scalable is ignored).
   * This does not depend on visualViewport, which iOS 12 lacks. */
  const meta=viewportMeta();
  const base='width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
  meta.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover, minimum-scale=0.25, maximum-scale=5');
  requestAnimationFrame(()=>{meta.setAttribute('content',base)});
  if(window.visualViewport&&window.visualViewport.scale&&window.visualViewport.scale!==1){
    try{window.scrollTo(0,0)}catch{}
  }
}
window.__milLockDocumentGestures=lockDocumentGestures;
/* iOS 12 keeps rubber-banding the page behind a fixed playfield even with
   `touch-action:none`, so mark the document while a fullscreen play session is live. */
function syncDocumentLock(){const locked=isNative()||isFallback()||wrap.classList.contains('playExpanded');document.documentElement.classList.toggle('playFullscreenLocked',locked);document.body.classList.toggle('playFullscreenLocked',locked);lockDocumentGestures(locked)}
async function unlockOrientation(){try{screen.orientation?.unlock?.()}catch{}}
async function unlockKeyboard(){try{await navigator.keyboard?.unlock?.()}catch{}}
async function leave(){
  window.__gpEscPauseGuardUntil=0;
  try{window.__gpHideResult?.(true)}catch{}
  await unlockKeyboard();
  if(isNative()){try{await (document.exitFullscreen?.()||document.webkitExitFullscreen?.())}catch{}}
  wrap.classList.remove('nativePlayFullscreen','nativeLandscapeFallback');clearOldExpanded();await unlockOrientation();
  syncDocumentLock();
  syncLegacySize();
  if(typeof markStageResize==='function')markStageResize();resizeCanvas();render();
}
function enterExpandedClass(){
  wrap.classList.add('playExpanded');
  document.documentElement.classList.add('playExpandedRoot');
  document.body.classList.add('playExpandedRoot');
  window.__milSetExpanded?.(true);
  syncDocumentLock();syncLegacySize();
  requestAnimationFrame(()=>{syncLegacySize();if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()});
}
async function enter(){
  window.__gpEscPauseGuardUntil=0;clearOldExpanded();wrap.classList.remove('nativePlayFullscreen','nativeLandscapeFallback');
  /* Mobile (iOS 12 iPhone has no element fullscreen; iPad's is inconsistent) fills the
     viewport with the CSS overlay path instead of the Fullscreen API. Desktop still
     uses native fullscreen for a real monitor/OS fullscreen. */
  const coarse=(navigator.maxTouchPoints||0)>0||matchMedia?.('(pointer:coarse)')?.matches;
  if(coarse||(!wrap.requestFullscreen&&!wrap.webkitRequestFullscreen)){enterExpandedClass();return}
  let nativeOk=false;
  try{if(wrap.requestFullscreen){await wrap.requestFullscreen({navigationUI:'hide'});nativeOk=isNative()}else if(wrap.webkitRequestFullscreen){await wrap.webkitRequestFullscreen();nativeOk=isNative()}}catch{}
  if(!nativeOk&&!isNative())enterExpandedClass();
  if(isNative())try{await navigator.keyboard?.lock?.(['Escape'])}catch{}
  await unlockOrientation();
  syncDocumentLock();
  syncLegacySize();
  requestAnimationFrame(()=>{if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()});
}
window.__gpLeaveGameplayFullscreen=leave;window.__gpEnterGameplayFullscreen=enter;window.__gpGameplayFullscreenActive=()=>isNative()||isFallback();
requestLandscapeFullscreen=async function(){if(isNative()||isFallback()||wrap.classList.contains('playExpanded'))await leave();else await enter()};
function sync(){
  if(!isNative()&&!isFallback()){
    if((Number(window.__gpEscPauseGuardUntil)||0)>performance.now())wrap.classList.add('nativePlayFullscreen');
    else{wrap.classList.remove('nativeLandscapeFallback');unlockKeyboard();unlockOrientation();try{window.__gpHideResult?.(true)}catch{}}
  }
  if(isNative()||isFallback())wrap.classList.remove('nativeLandscapeFallback');
  syncDocumentLock();
  syncLegacySize();
  requestAnimationFrame(()=>{if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()})
}
document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);window.addEventListener('orientationchange',sync,{passive:true});
window.addEventListener('resize',()=>{if(isNative()||isFallback()||wrap.classList.contains('playExpanded')){syncLegacySize();sync()}},{passive:true});
if(window.visualViewport)try{window.visualViewport.addEventListener('resize',()=>{if(__milFullscreenLocked()){syncLegacySize();if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()}},{passive:true})}catch{}
/* Belt-and-braces pinch guard: even if preventDefault on the touch stream is not enough
 * on a given iOS build, snap the visual viewport back as soon as a pinch starts. */
function __milFullscreenLocked(){return isNative()||isFallback()||wrap.classList.contains('playExpanded')}
for(const type of ['gesturestart','gesturechange'])document.addEventListener(type,e=>{if(state.appMode!=='play'||!__milFullscreenLocked())return;if(typeof e.preventDefault==='function')e.preventDefault();resetVisualZoom()},{capture:true,passive:false});
/* Two-finger touch is judgement input, never a page gesture. Block it early and keep
 * re-asserting scale 1 while it is down, because some iOS 12 builds begin the pinch
 * before the first touchmove reaches a non-passive listener. */
function __milMultiTouchGuard(e){if(state.appMode!=='play'||!__milFullscreenLocked())return;if(!e.touches||e.touches.length<2)return;if(e.target?.closest?.('button, input, select, textarea, a, label'))return;if(typeof e.preventDefault==='function')e.preventDefault();resetVisualZoom()}
document.addEventListener('touchstart',__milMultiTouchGuard,{capture:true,passive:false});
document.addEventListener('touchmove',__milMultiTouchGuard,{capture:true,passive:false});
})();
