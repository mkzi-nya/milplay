(()=>{
  'use strict';
  const key='milplay-player-settings-v1';
  const byId=id=>document.getElementById(id);
  const length=byId('ratioLengthInput'),width=byId('ratioWidthInput');
  function validNumber(value,min,max){
    return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  }
  function snapshot(){
    return {
      rate:state.rate,editRate:state.editRate,audioDelay:state.audioDelay,
      editAudioDelay:state.editAudioDelay,audioVolume:state.audioVolume,
      bgBrightness:state.bgBrightness,noteScale:state.noteScale,
      flowSpeed:state.flowSpeed,autoplay:!!state.autoplay,
      showHands:!!state.__playShowHands,
      ratioLength:length?length.value:'',ratioWidth:width?width.value:''
    };
  }
  function save(){try{localStorage.setItem(key,JSON.stringify(snapshot()))}catch{}}
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch{}
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
    window.__milHasSavedPlayerSettings=true;
    if(validNumber(saved.rate,.05,8))state.rate=saved.rate;
    if(validNumber(saved.editRate,.05,8))state.editRate=saved.editRate;
    if(validNumber(saved.audioDelay,-5,5))state.audioDelay=saved.audioDelay;
    if(validNumber(saved.editAudioDelay,-5,5))state.editAudioDelay=saved.editAudioDelay;
    if(validNumber(saved.audioVolume,0,1))state.audioVolume=saved.audioVolume;
    if(validNumber(saved.bgBrightness,.05,1))state.bgBrightness=saved.bgBrightness;
    if(validNumber(saved.noteScale,.25,4))state.noteScale=saved.noteScale;
    if(validNumber(saved.flowSpeed,1.66*.1/7,Infinity))state.flowSpeed=saved.flowSpeed;
    if(typeof saved.showHands==='boolean'){
      state.__playShowHands=saved.showHands;
      if(state.appMode==='play')state.showHandTextures=saved.showHands;
      if(els.showHandsToggle)els.showHandsToggle.checked=saved.showHands;
    }
    if(typeof saved.ratioLength==='string'&&typeof saved.ratioWidth==='string'&&
       (!saved.ratioLength&&!saved.ratioWidth||window.__milParseStageRatio(saved.ratioLength,saved.ratioWidth))){
      if(length)length.value=saved.ratioLength;
      if(width)width.value=saved.ratioWidth;
      window.__milApplyStageRatio();
    }
    if(typeof saved.autoplay==='boolean')window.__gpSetAutoplay(saved.autoplay);
    if(els.audioPlayer){els.audioPlayer.playbackRate=state.rate;els.audioPlayer.volume=state.audioVolume}
    updateControls();updateModeUI();render();
  }
  for(const name of ['setRate','setAudioDelay','setAudioVolume','setBgBrightness']){
    const original=({setRate,setAudioDelay,setAudioVolume,setBgBrightness})[name];
    const wrapped=function(){const result=original.apply(this,arguments);save();return result};
    if(name==='setRate')setRate=wrapped;
    else if(name==='setAudioDelay')setAudioDelay=wrapped;
    else if(name==='setAudioVolume')setAudioVolume=wrapped;
    else setBgBrightness=wrapped;
  }
  for(const id of ['playNoteScaleInput','playFlowSpeedInput','autoplayToggle','showHandsToggle',
                   'ratioLengthInput','ratioWidthInput']){
    const node=byId(id);
    if(node){node.addEventListener('input',save);node.addEventListener('change',save)}
  }
  window.addEventListener('pagehide',save);
})();
