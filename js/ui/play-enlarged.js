(()=>{
  const wrap=els.stageWrap;
  if(!wrap)return;
  const nativeFullscreenToggle=requestLandscapeFullscreen;
  const androidFullscreen=/Android/i.test(String(navigator.userAgent||''));

  // Keep the fullscreen controls inside stageInner so edit mode retains its normal layout.
  const inner=document.getElementById('stageInner');
  for(const node of [wrap.querySelector(':scope > .fsLeft'),wrap.querySelector(':scope > .corner')]){
    if(node&&inner&&node.parentElement===wrap)inner.appendChild(node);
  }

  const pause=createHudPause({state,inner,setPlaying:v=>setPlaying(v)});

  const syncExpandedControls=()=>{
    pause.sync();
  };
  const oldUC=updateControls;
  updateControls=function(){oldUC();syncExpandedControls()};
  const oldUI=updateUI;
  updateUI=function(){oldUI();syncExpandedControls()};
  // 使用已有逐帧渲染链，在画布 HUD 更新可见性之后同步图标。
  const oldRender=render;
  render=function(){const result=oldRender.apply(this,arguments);pause.sync();return result};

  let resizeRaf=0;
  const resync=()=>{
    cancelAnimationFrame(resizeRaf);
    resizeRaf=requestAnimationFrame(()=>{
      // Same resizeCanvas() and render() used by edit mode, with no transformed ancestor.
      try{window.__milSyncLegacyFullscreenSize?.()}catch{}
      resizeCanvas();render();syncExpandedControls();
    });
  };

  function setExpanded(on){
    on=!!on;
    wrap.classList.toggle('playExpanded',on);
    wrap.classList.remove('landscapeFallback');
    document.documentElement.classList.toggle('playExpandedRoot',on);
    document.body.classList.toggle('playExpandedRoot',on);
    document.documentElement.classList.toggle('playFullscreenLocked',on);
    document.body.classList.toggle('playFullscreenLocked',on);
    try{window.__milLockDocumentGestures?.(on)}catch{}
    if(on&&state.appMode!=='play')setAppMode('play');
    resync();
  }
  window.__milSetExpanded=setExpanded;

  // Android uses the browser's real element fullscreen (the same system UI used by
  // fullscreen video). Old iOS keeps the fixed overlay compatibility path.
  requestLandscapeFullscreen=async function(){
    if(androidFullscreen)return nativeFullscreenToggle();
    setExpanded(!wrap.classList.contains('playExpanded'));
  };

  // No double-tap pause on the playfield. Multi-touch releases must be reserved
  // exclusively for judgement input; pause remains an explicit UI action.

  window.addEventListener('resize',()=>{if(wrap.classList.contains('playExpanded'))resync()},{passive:true});
  window.addEventListener('orientationchange',()=>{if(wrap.classList.contains('playExpanded'))resync()},{passive:true});
  // Leave any stale native fullscreen state before enabling the enlarged stage.
  if(document.fullscreenElement||document.webkitFullscreenElement){
    try{(document.exitFullscreen?.()||document.webkitExitFullscreen?.())?.catch?.(()=>{})}catch{}
  }
  syncExpandedControls();
})();
