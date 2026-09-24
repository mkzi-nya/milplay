const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createHarness}=require('./harness.js');
const root=join(__dirname,'..');
const child=(node,className)=>node.children.find(item=>item.className===className);
const click=node=>{for(const fn of node.listeners.get('click')||[])fn({stopPropagation(){}})};

test('pause menu offers a chart-visible countdown',()=>{
  const h=createHarness(root),inner=h.get('stageInner');
  const menu=child(inner,'pauseMenu'),countdown=child(inner,'pauseCountdown');
  h.run('state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0}]}],animations:[]});state.duration=state.runtime.duration;setPlaying(true);state.currentTime=1;setPlaying(false)');
  assert.equal(menu.hidden,false);
  click(child(child(child(menu,'pauseMenuContent'),'pauseMenuActions'),'pauseMenuContinue'));
  assert.equal(menu.hidden,true);
  assert.equal(countdown.hidden,false);
  assert.equal(countdown.textContent,'3');
  h.run('setPlaying(true)');
  assert.equal(countdown.hidden,true);
  h.run('setPlaying(false)');
  click(child(child(child(menu,'pauseMenuContent'),'pauseMenuActions'),'pauseMenuRestart'));
  assert.equal(h.run('state.currentTime'),0);
  assert.equal(h.run('state.playing'),true);
});

test('pause exit only leaves fullscreen; progress drag reveals the chart',()=>{
  const h=createHarness(root),inner=h.get('stageInner'),wrap=h.get('stageWrap');
  const menu=child(inner,'pauseMenu'),actions=child(child(menu,'pauseMenuContent'),'pauseMenuActions');
  h.run('state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0}]}],animations:[]});state.duration=state.runtime.duration;setPlaying(true);setPlaying(false)');
  let exits=0;h.context.__gpLeaveGameplayFullscreen=()=>{exits++;return Promise.resolve()};
  click(child(actions,'pauseMenuExit'));assert.equal(exits,0);
  wrap.classList.add('nativePlayFullscreen');click(child(actions,'pauseMenuExit'));assert.equal(exits,1);
  const slider=child(inner,'hudProgress');
  [...slider.listeners.get('pointerdown')].at(-1)({pointerId:7,isPrimary:true,button:0});
  assert.equal(menu.classes.has('seeking'),true);
  [...slider.listeners.get('pointerup')].at(-1)({pointerId:7});
  assert.equal(menu.classes.has('seeking'),false);
  const css=readFileSync(join(root,'css/pause-menu.css'),'utf8');
  assert.match(css,/\.stageInner\.isPaused \.hudProgress\{z-index:12\}/);
  assert.match(css,/\.pauseMenu\.seeking \.pauseMenuShade,\.pauseMenu\.seeking \.pauseMenuContent\{display:none\}/);
});

test('displayed flow speed 7.0 retains the existing render multiplier',()=>{
  const h=createHarness(root),input=h.get('playFlowSpeedInput');
  assert.equal(input.value,'7.0');
  assert.equal(h.run('state.flowSpeed'),1.66);
  input.value='8.0';input.emit('input');
  assert.ok(Math.abs(h.run('state.flowSpeed')-1.66*8/7)<1e-9);
  input.value='0';input.emit('change');
  assert.equal(input.value,'0.1');
  assert.ok(Math.abs(h.run('state.flowSpeed')-1.66*.1/7)<1e-9);
  input.value='35';input.emit('change');
  assert.equal(input.value,'35.0');
  assert.ok(Math.abs(h.run('state.flowSpeed')-1.66*35/7)<1e-9);
  assert.match(h.html,/id="playFlowSpeedInput"[^>]*min="0\.1"/);
  assert.doesNotMatch(h.html,/id="playFlowSpeedInput"[^>]*max=/);
});

test('Escape pauses enlarged gameplay before leaving fullscreen',()=>{
  const h=createHarness(root),wrap=h.get('stageWrap');
  h.run('state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0}]}],animations:[]});state.duration=state.runtime.duration;setPlaying(true)');
  wrap.classList.add('nativePlayFullscreen');
  const first=h.emitWindowEvent('keydown',{key:'Escape',code:'Escape'});
  assert.equal(first.prevented,true);
  assert.equal(h.run('state.playing'),false);
  assert.equal(wrap.classList.contains('nativePlayFullscreen'),true);
});

test('player settings survive a page reload without a loaded chart',()=>{
  const storage=new Map(),a=createHarness(root,{storage});
  a.run('setRate(1.25);setAudioDelay(.2);setAudioVolume(.35);setBgBrightness(.4)');
  a.get('playNoteScaleInput').value='1.5';a.get('playNoteScaleInput').emit('input');
  a.get('playFlowSpeedInput').value='8.0';a.get('playFlowSpeedInput').emit('input');
  a.get('autoplayToggle').checked=true;a.get('autoplayToggle').emit('change');
  a.get('ratioLengthInput').value='4';a.get('ratioLengthInput').emit('input');
  a.get('ratioWidthInput').value='3';a.get('ratioWidthInput').emit('input');
  assert.ok(storage.has('milplay-player-settings-v1'));
  const b=createHarness(root,{storage});
  assert.equal(b.run('state.rate'),1.25);
  assert.equal(b.run('state.audioDelay'),.2);
  assert.equal(b.run('state.audioVolume'),.35);
  assert.equal(b.run('state.bgBrightness'),.4);
  assert.equal(b.run('state.noteScale'),1.5);
  assert.ok(Math.abs(b.run('state.flowSpeed')-1.66*8/7)<1e-9);
  assert.equal(b.get('playFlowSpeedInput').value,'8.0');
  assert.equal(b.run('state.autoplay'),true);
  assert.equal(b.run('state.stageRatio'),4/3);
  assert.equal(b.get('audioDelayInput'),null);
  assert.ok(b.html.indexOf('id="playModeBar"')>b.html.indexOf('class="controls"'));
});

test('flow speed above the former limit persists after refresh',()=>{
  const storage=new Map(),a=createHarness(root,{storage});
  const input=a.get('playFlowSpeedInput');input.value='35';input.emit('change');
  const b=createHarness(root,{storage});
  assert.equal(b.get('playFlowSpeedInput').value,'35.0');
  assert.ok(Math.abs(b.run('state.flowSpeed')-1.66*35/7)<1e-9);
});

test('calibration reads the same audioDelay used by gameplay',async()=>{
  const h=createHarness(root),button=child(h.get('playModeBar'),'delayCalibrationOpen');
  click(button);await Promise.resolve();
  const panel=child(h.context.document.body,'delayCalibration');
  assert.equal(panel.hidden,false);
  const tapArea=child(panel,'delayCalibrationTap');
  const media=panel.children.find(node=>node.tagName==='AUDIO');
  assert.ok(media);assert.equal(media.loop,true);
  const wav=h.blobs.find(blob=>blob&&blob.type==='audio/wav');
  assert.ok(wav);assert.equal(wav.size,44+120*22050*2);
  const wave=new DataView(await wav.arrayBuffer());
  const peak=at=>{let value=0;for(let i=0;i<500;i++)value=Math.max(value,Math.abs(wave.getInt16(44+(Math.round(at*22050)+i)*2,true)));return value};
  for(const at of [0,.5,1,1.5,2,119.5])assert.ok(peak(at)>1000,`audible beat at ${at}s`);
  assert.ok(peak(1.5)>peak(1),'fourth beat remains accented');
  h.run('setAudioDelay(.11)');
  media.currentTime=.6;
  for(const fn of tapArea.listeners.get('pointerdown')||[])fn({isPrimary:true,preventDefault(){}});
  assert.equal(child(tapArea.children[1],'delayCalibrationOffset').textContent,'-10ms');
  media.currentTime=.64;
  const key=h.emitWindowEvent('keydown',{code:'KeyA',key:'a',target:tapArea});
  assert.equal(key.prevented,true);
  assert.equal(child(tapArea.children[1],'delayCalibrationOffset').textContent,'+30ms');
  const field=child(panel,'delayCalibrationField'),input=field.children[0];
  media.currentTime=.7;
  h.emitWindowEvent('keydown',{code:'Digit2',key:'2',target:input});
  assert.equal(child(tapArea.children[1],'delayCalibrationOffset').textContent,'+30ms');
  await new Promise(resolve=>setTimeout(resolve,1050));
  assert.equal(child(tapArea.children[1],'delayCalibrationOffset').textContent,'');
  input.value='200';input.emit('change');
  assert.equal(h.run('state.audioDelay'),.2);
  assert.equal(h.get('audioDelayInput'),null);
  click(child(panel,'delayCalibrationHead').children[1]);
});
