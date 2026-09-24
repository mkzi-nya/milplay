const {test}=require('node:test');
const assert=require('node:assert/strict');
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

test('displayed flow speed 7.0 retains the existing render multiplier',()=>{
  const h=createHarness(root),input=h.get('playFlowSpeedInput');
  assert.equal(input.value,'7.0');
  assert.equal(h.run('state.flowSpeed'),1.66);
  input.value='8.0';input.emit('input');
  assert.ok(Math.abs(h.run('state.flowSpeed')-1.66*8/7)<1e-9);
});

test('calibration reads the same audioDelay used by gameplay',async()=>{
  const h=createHarness(root),button=child(h.get('playModeBar'),'delayCalibrationOpen');
  click(button);await Promise.resolve();
  const panel=child(h.context.document.body,'delayCalibration');
  assert.equal(panel.hidden,false);
  const tapArea=child(panel,'delayCalibrationTap');
  const media=panel.children.find(node=>node.tagName==='AUDIO');
  assert.ok(media);assert.equal(media.loop,true);
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
  assert.equal(h.get('audioDelayInput').value,'0.200');
  click(child(panel,'delayCalibrationHead').children[1]);
});
