(()=>{
  const inner=els.stageInner;
  if(!inner)return;
  const menu=document.createElement('div');
  menu.className='pauseMenu';
  menu.hidden=true;
  const shade=document.createElement('div');shade.className='pauseMenuShade';menu.appendChild(shade);
  const content=document.createElement('div');content.className='pauseMenuContent';menu.appendChild(content);
  const actions=document.createElement('div');actions.className='pauseMenuActions';content.appendChild(actions);
  const icons={
    exit:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 7h12v18H13M17 16H5m0 0 5-5m-5 5 5 5"/></svg>',
    restart:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 12a10 10 0 1 0 1 8M25 5v8h-8"/></svg>',
    continue:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5v22l17-11z"/></svg>'
  };
  const makeButton=(label,className,icon)=>{const button=document.createElement('button');button.type='button';button.className=className;button.setAttribute('aria-label',label);button.innerHTML=icons[icon];actions.appendChild(button);return button};
  const exitButton=makeButton('退出（暂不可用）','pauseMenuExit','exit');
  const restartButton=makeButton('重开','pauseMenuRestart','restart');
  const continueButton=makeButton('继续','pauseMenuContinue','continue');
  inner.appendChild(menu);
  const countdown=document.createElement('div');
  countdown.className='pauseCountdown';countdown.hidden=true;
  countdown.setAttribute('aria-live','polite');
  inner.appendChild(countdown);
  let wasStarted=false,countdownTimer=0,countdownEnd=0,primedMedia=null,previousMute=false;
  const originalSetPlaying=setPlaying;
  function stopCountdown(keepPrimed=false){
    clearTimeout(countdownTimer);countdownTimer=0;countdownEnd=0;
    countdown.hidden=true;countdown.textContent='';
    if(primedMedia&&!keepPrimed){primedMedia.pause();primedMedia.muted=previousMute;primedMedia=null}
  }
  function showMenu(){menu.hidden=false;inner.classList.add('isPaused');els.stageWrap.classList.add('isPaused')}
  function hideMenu(){menu.hidden=true;inner.classList.remove('isPaused');els.stageWrap.classList.remove('isPaused')}
  setPlaying=function(value){
    if(value){stopCountdown(true);wasStarted=true;hideMenu()}
    const wasPlaying=state.playing;
    originalSetPlaying(value);
    if(value&&primedMedia){primedMedia.muted=previousMute;primedMedia=null}
    if(!value&&wasPlaying&&state.appMode==='play'&&state.runtime)showMenu();
    if(!state.runtime||state.appMode!=='play'){stopCountdown();hideMenu();wasStarted=false}
  };
  const originalSeek=seek;
  seek=function(time){
    if(countdownEnd){stopCountdown();showMenu()}
    originalSeek(time);
  };
  restartButton.addEventListener('click',e=>{
    e.stopPropagation();stopCountdown();hideMenu();seek(0);setPlaying(true);
  });
  continueButton.addEventListener('click',e=>{
    e.stopPropagation();hideMenu();
    const media=els.audioPlayer;
    if(state.mediaUrl&&state.mediaReady&&media){
      primedMedia=media;previousMute=media.muted;media.muted=true;
      media.play().catch(()=>{if(primedMedia===media){media.muted=previousMute;primedMedia=null}});
    }
    countdownEnd=performance.now()+3000;
    countdown.hidden=false;
    function tick(){
      if(!countdownEnd||state.appMode!=='play'||!state.runtime){stopCountdown();return}
      const remain=countdownEnd-performance.now();
      if(remain<=0){stopCountdown();setPlaying(true);return}
      countdown.textContent=String(Math.ceil(remain/1000));
      countdownTimer=setTimeout(tick,Math.min(100,remain));
    }
    tick();
  });
  // The exit key is a visual placeholder until exit behavior is specified.
  exitButton.addEventListener('click',e=>e.stopPropagation());
  const previousUpdateControls=updateControls;
  updateControls=function(){
    previousUpdateControls();
    if(!state.runtime||state.appMode!=='play'){stopCountdown();hideMenu();wasStarted=false}
    else if(state.playing){wasStarted=true;hideMenu()}
    else if(!wasStarted)hideMenu();
  };
})();
