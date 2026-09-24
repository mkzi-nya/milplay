(()=>{
  const noteScale=document.getElementById('playNoteScaleInput');
  const flowSpeed=document.getElementById('playFlowSpeedInput');
  // Keep the existing render scale: its 1.66 default is shown as 7.0 in the UI.
  const displayToRenderSpeed=value=>value*1.66/7;
  const renderToDisplaySpeed=value=>value*7/1.66;
  const enteredSpeed=()=>{
    const raw=flowSpeed?.value?.trim();
    if(!raw)return null;
    const value=Number(raw);
    return Number.isFinite(value)?Math.max(.1,value):null;
  };
  const hudProgress=createHudProgress({state,stage:els.stage,inner:els.stageInner,seek:t=>seek(t)});
  // The autosave information card was removed from the UI, but older callbacks still
  // refer to its object. A harmless sink keeps those callbacks from throwing.
  if(!els.infoAutosave) els.infoAutosave={textContent:''};

  const syncTuneControls=()=>{
    if(noteScale) noteScale.value=String(Number.isFinite(state.noteScale)?state.noteScale:1);
    if(flowSpeed) flowSpeed.value=renderToDisplaySpeed(Number.isFinite(state.flowSpeed)?state.flowSpeed:1.66).toFixed(1);
    hudProgress.sync();
  };

  const oldUpdateControls=updateControls;
  updateControls=function(){oldUpdateControls();syncTuneControls()};
  const oldUpdateUI=updateUI;
  updateUI=function(){oldUpdateUI();syncTuneControls()};

  noteScale?.addEventListener('change',()=>{
    state.noteScale=clamp(Number(noteScale.value)||1,.25,4);
    noteScale.value=String(state.noteScale);
    render();
  });
  flowSpeed?.addEventListener('change',()=>{
    const value=enteredSpeed();
    if(value!==null)state.flowSpeed=displayToRenderSpeed(value);
    flowSpeed.value=renderToDisplaySpeed(state.flowSpeed).toFixed(1);
    render();
  });
  noteScale?.addEventListener('input',()=>{state.noteScale=clamp(Number(noteScale.value)||1,.25,4);render()});
  flowSpeed?.addEventListener('input',()=>{const value=enteredSpeed();if(value!==null){state.flowSpeed=displayToRenderSpeed(value);render()}});

  // In play mode the fullscreen control remains available; editor inspection controls stay hidden.
  syncTuneControls();
  updateModeUI();
})();
