(()=>{
  const noteScale=document.getElementById('playNoteScaleInput');
  const flowSpeed=document.getElementById('playFlowSpeedInput');
  const hudProgress=createHudProgress({state,stage:els.stage,inner:els.stageInner,seek:t=>seek(t)});
  // The autosave information card was removed from the UI, but older callbacks still
  // refer to its object. A harmless sink keeps those callbacks from throwing.
  if(!els.infoAutosave) els.infoAutosave={textContent:''};

  const syncTuneControls=()=>{
    if(noteScale) noteScale.value=String(Number.isFinite(state.noteScale)?state.noteScale:1);
    if(flowSpeed) flowSpeed.value=String(Number.isFinite(state.flowSpeed)?state.flowSpeed:1.66);
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
    state.flowSpeed=clamp(Number(flowSpeed.value)||1.66,.1,8);
    flowSpeed.value=String(state.flowSpeed);
    render();
  });
  noteScale?.addEventListener('input',()=>{state.noteScale=clamp(Number(noteScale.value)||1,.25,4);render()});
  flowSpeed?.addEventListener('input',()=>{state.flowSpeed=clamp(Number(flowSpeed.value)||1.66,.1,8);render()});

  // In play mode the fullscreen control remains available; editor inspection controls stay hidden.
  syncTuneControls();
  updateModeUI();
})();
