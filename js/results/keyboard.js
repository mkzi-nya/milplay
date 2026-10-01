(()=>{
'use strict';
window.__gpEscPauseGuardUntil=0;
const isTextInput=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName||'');
window.addEventListener('keydown',e=>{
  if(state.appMode!=='play'||!state.runtime||isTextInput())return;
  const result=document.getElementById('gameResultOverlay'),resultShown=!!result?.classList.contains('show');
  if(e.key==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();
    if(resultShown){
      window.__gpEscPauseGuardUntil=0;
      try{window.__gpHideResult?.(true)}catch{}
      Promise.resolve(window.__gpLeaveGameplayFullscreen?.()).catch(()=>{});
      return;
    }
    if(state.playing){
      /* First Escape pauses. If a browser forcibly drops native fullscreen despite
         preventDefault, fullscreenchange uses this short guard to retain fixed-fullscreen. */
      window.__gpEscPauseGuardUntil=performance.now()+850;
      setPlaying(false);
      return;
    }
    /* Second Escape while paused exits both native and fixed fullscreen. */
    window.__gpEscPauseGuardUntil=0;
    Promise.resolve(window.__gpLeaveGameplayFullscreen?.()).catch(()=>{});
    return;
  }
  if(e.key==='Enter'&&!resultShown&&!state.playing){
    e.preventDefault();e.stopImmediatePropagation();
    window.__gpEscPauseGuardUntil=0;
    setPlaying(true);
  }
},true);
})();
