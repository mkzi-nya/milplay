(()=>{
'use strict';
const wrap=els.stageWrap;
if(!wrap)return;
let exitBtn=document.getElementById('nativeFsExit');
if(!exitBtn){exitBtn=document.createElement('button');exitBtn.id='nativeFsExit';exitBtn.className='nativeFsExit';exitBtn.type='button';exitBtn.textContent='⛶';exitBtn.title='退出全屏';exitBtn.setAttribute('aria-label','退出全屏');wrap.appendChild(exitBtn)}
const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
const isNative=()=>nativeElement()===wrap;
const isFallback=()=>wrap.classList.contains('nativePlayFullscreen');
function clearOldExpanded(){wrap.classList.remove('playExpanded');document.documentElement.classList.remove('playExpandedRoot');document.body.classList.remove('playExpandedRoot')}
async function unlockOrientation(){try{screen.orientation?.unlock?.()}catch{}}
async function unlockKeyboard(){try{await navigator.keyboard?.unlock?.()}catch{}}
async function leave(){
  window.__gpEscPauseGuardUntil=0;
  /* If the result page is visible, shrinking is also an explicit result dismissal.
     Suppression prevents the resize-triggered render at song end from reopening it. */
  try{window.__gpHideResult?.(true)}catch{}
  await unlockKeyboard();
  if(isNative()){try{await (document.exitFullscreen?.()||document.webkitExitFullscreen?.())}catch{}}
  wrap.classList.remove('nativePlayFullscreen','nativeLandscapeFallback');clearOldExpanded();await unlockOrientation();
  if(typeof markStageResize==='function')markStageResize();resizeCanvas();render();
}
async function enter(){
  window.__gpEscPauseGuardUntil=0;clearOldExpanded();wrap.classList.remove('nativePlayFullscreen','nativeLandscapeFallback');
  let nativeOk=false;
  try{if(wrap.requestFullscreen){await wrap.requestFullscreen({navigationUI:'hide'});nativeOk=true}else if(wrap.webkitRequestFullscreen){await wrap.webkitRequestFullscreen();nativeOk=true}}catch{}
  if(!nativeOk&&!isNative())wrap.classList.add('nativePlayFullscreen');
  /* Chromium can lock Escape while fullscreen. This makes first Escape a gameplay
     pause key; long/system Escape remains available to the browser. */
  if(isNative())try{await navigator.keyboard?.lock?.(['Escape'])}catch{}
  let locked=false;try{await screen.orientation?.lock?.('landscape');locked=true}catch{}
  if(!locked&&matchMedia('(orientation:portrait)').matches)wrap.classList.add('nativeLandscapeFallback');
  requestAnimationFrame(()=>{if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()});
}
window.__gpLeaveGameplayFullscreen=leave;window.__gpEnterGameplayFullscreen=enter;window.__gpGameplayFullscreenActive=()=>isNative()||isFallback();
requestLandscapeFullscreen=async function(){if(isNative()||isFallback())await leave();else await enter()};
exitBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();leave()},{capture:true});
function sync(){
  if(!isNative()&&!isFallback()){
    /* Some browsers reserve native Escape and exit fullscreen even after preventDefault.
       If this was the first Escape used to pause, immediately preserve the gameplay
       surface as the fixed fullscreen fallback. The next Escape removes it normally. */
    if((Number(window.__gpEscPauseGuardUntil)||0)>performance.now())wrap.classList.add('nativePlayFullscreen');
    else{wrap.classList.remove('nativeLandscapeFallback');unlockKeyboard();unlockOrientation();try{window.__gpHideResult?.(true)}catch{}}
  }
  if(isNative()||isFallback()){
    if(matchMedia('(orientation:portrait)').matches){if(screen.orientation?.type?.startsWith?.('portrait'))wrap.classList.add('nativeLandscapeFallback')}
    else wrap.classList.remove('nativeLandscapeFallback');
  }
  requestAnimationFrame(()=>{if(typeof markStageResize==='function')markStageResize();resizeCanvas();render()})
}
document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);window.addEventListener('orientationchange',sync,{passive:true});window.addEventListener('resize',()=>{if(isNative()||isFallback())sync()},{passive:true});
})();
