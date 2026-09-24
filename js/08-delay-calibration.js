(()=>{
  const bar=els.playModeBar;
  if(!bar)return;
  const openButton=document.createElement('button');openButton.type='button';openButton.className='delayCalibrationOpen';openButton.textContent='调整延迟';bar.appendChild(openButton);
  const panel=document.createElement('div');panel.className='delayCalibration';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','延迟校准');
  const head=document.createElement('div');head.className='delayCalibrationHead';panel.appendChild(head);
  const heading=document.createElement('strong');heading.textContent='延迟校准';head.appendChild(heading);
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='×';closeButton.setAttribute('aria-label','关闭延迟校准');head.appendChild(closeButton);
  const hint=document.createElement('p');hint.textContent='跟着鼓点点击下方区域，或按字母、数字、空格键打拍。第 4 拍为重拍。';panel.appendChild(hint);
  const tapArea=document.createElement('div');tapArea.className='delayCalibrationTap';tapArea.setAttribute('role','button');tapArea.setAttribute('tabindex','0');tapArea.setAttribute('aria-label','跟随鼓点点击以测量偏移');panel.appendChild(tapArea);
  const lines=[];
  for(let i=0;i<4;i++){
    const lane=document.createElement('div');lane.className='delayCalibrationLane'+(i===3?' strong':'');
    const line=document.createElement('span');line.className='delayCalibrationLine';lane.appendChild(line);
    const offset=document.createElement('span');offset.className='delayCalibrationOffset';offset.textContent='';lane.appendChild(offset);
    tapArea.appendChild(lane);lines.push({lane,offset});
  }
  const field=document.createElement('label');field.className='delayCalibrationField';field.textContent='延迟 (ms) ';panel.appendChild(field);
  const input=document.createElement('input');input.type='number';input.min='-5000';input.max='5000';input.step='1';field.appendChild(input);
  const status=document.createElement('p');status.className='delayCalibrationStatus';status.setAttribute('aria-live','polite');panel.appendChild(status);
  document.body.appendChild(panel);
  let audio=null,audioUrl='',animation=0;
  const feedbackTimers=[0,0,0,0];
  const beatPeriod=.5;
  function drumWav(){
    // A long, seamless four-beat stream avoids the audible pause some mobile
    // media players insert when looping a two-second WAV.
    const rate=22050,duration=120,count=rate*duration,bytes=new ArrayBuffer(44+count*2),view=new DataView(bytes);
    const word=(at,value)=>view.setUint16(at,value,true),dword=(at,value)=>view.setUint32(at,value,true);
    for(const [at,label] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<4;i++)view.setUint8(at+i,label.charCodeAt(i));
    dword(4,bytes.byteLength-8);dword(16,16);word(20,1);word(22,1);dword(24,rate);dword(28,rate*2);word(32,2);word(34,16);dword(40,count*2);
    const pulseSamples=Math.floor(rate*.08);
    for(let beat=0;beat<duration/beatPeriod;beat++){
      const strong=beat%4===3,gain=strong ? .86 : .62,start=Math.round(beat*beatPeriod*rate);
      for(let j=0;j<pulseSamples;j++){
        const t=j/rate,attack=Math.min(1,t/.0015),noise=(((j*1103515245+beat*12345)>>>16)&255)/127.5-1;
        const click=.62*Math.sin(2*Math.PI*1600*t)+.27*Math.sin(2*Math.PI*2900*t)+.18*noise;
        const body=strong ? .23*Math.sin(2*Math.PI*440*t) : 0;
        const sample=gain*attack*(click*Math.exp(-52*t)+body*Math.exp(-33*t));
        view.setInt16(44+(start+j)*2,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);
      }
    }
    return new Blob([bytes],{type:'audio/wav'});
  }
  const chartTime=()=>audio.currentTime-state.audioDelay;
  const beatIndexAt=time=>Math.round(time/beatPeriod);
  const measuredOffset=()=>{
    const time=chartTime(),index=beatIndexAt(time);
    return {index,offset:Math.round((time-index*beatPeriod)*1000)};
  };
  function draw(){
    if(!audio)return;
    const time=chartTime(),index=beatIndexAt(time),distance=Math.abs(time-index*beatPeriod);
    lines.forEach((line,i)=>line.lane.classList.toggle('active',distance<.11&&((index%4+4)%4)===i));
    animation=requestAnimationFrame(draw);
  }
  function stop(){
    cancelAnimationFrame(animation);animation=0;
    feedbackTimers.forEach((timer,i)=>{clearTimeout(timer);feedbackTimers[i]=0;lines[i].offset.textContent=''});
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio.remove();audio=null}
    if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=''}
    lines.forEach(line=>line.lane.classList.remove('active'));
  }
  async function open(){
    panel.hidden=false;input.value=String(Math.round(state.audioDelay*1000));status.textContent='';
    if(typeof tapArea.focus==='function')tapArea.focus({preventScroll:true});
    try{
      const media=document.createElement('audio');audio=media;media.loop=true;media.preload='auto';media.playsInline=true;
      media.volume=state.audioVolume;media.playbackRate=state.rate;
      audioUrl=URL.createObjectURL(drumWav());media.src=audioUrl;panel.appendChild(media);
      await media.play();if(audio===media&&!panel.hidden)draw();
    }catch{stop();status.textContent='无法启动鼓点音频，请检查浏览器的音频权限。'}
  }
  const close=()=>{panel.hidden=true;stop()};
  openButton.addEventListener('click',()=>{if(panel.hidden)open();else close()});
  closeButton.addEventListener('click',close);
  function tap(){
    if(!audio)return;
    const {index,offset}=measuredOffset(),lane=((index%4)+4)%4;
    lines[lane].offset.textContent=(offset>=0?'+':'')+offset+'ms';
    clearTimeout(feedbackTimers[lane]);
    feedbackTimers[lane]=setTimeout(()=>{lines[lane].offset.textContent='';feedbackTimers[lane]=0},1000);
    lines[lane].lane.classList.add('tapped');setTimeout(()=>lines[lane].lane.classList.remove('tapped'),180);
  }
  tapArea.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false)return;e.preventDefault();tap();
  });
  const isTapKey=e=>/^(Key[A-Z]|Digit[0-9]|Space|Enter)$/.test(e.code||'')||/^[a-zA-Z0-9 ]$/.test(e.key||'');
  const editing=e=>{
    const target=e.target&&e.target.tagName?e.target:document.activeElement;
    return ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target&&target.tagName)||!!(target&&target.isContentEditable);
  };
  window.addEventListener('keydown',e=>{
    if(panel.hidden||editing(e)||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return}
    if(!isTapKey(e))return;
    e.preventDefault();e.stopImmediatePropagation();tap();
  },true);
  window.addEventListener('keyup',e=>{
    if(panel.hidden||editing(e)||!isTapKey(e))return;
    e.preventDefault();e.stopImmediatePropagation();
  },true);
  input.addEventListener('change',()=>{
    const value=Number(input.value);
    if(!Number.isFinite(value)){input.value=String(Math.round(state.audioDelay*1000));return}
    setAudioDelay(value/1000);input.value=String(Math.round(state.audioDelay*1000));
  });
  window.addEventListener('pagehide',stop);
})();
