const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const source=file=>readFileSync(join(__dirname,'..',file),'utf8');
function setup(){
  class Element{
    listeners={};attrs={};style={};clientWidth=360;
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
    appendChild(child){this.child=child}
    setAttribute(k,v){this.attrs[k]=v}
    setPointerCapture(id){this.capture=id}
    releasePointerCapture(){this.capture=null;this.emit('lostpointercapture')}
    focus(){document.activeElement=this}
    getBoundingClientRect(){const top=parseFloat(this.style.top);return {left:0,right:42,top,bottom:top+42}}
    emit(type,props={}){
      const e={target:this,pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:14,clientY:14,
        preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.stopped=true},...props};
      for(const fn of this.listeners[type]||[])fn(e);return e;
    }
  }
  const document=new Element(),window=new Element(),inner=new Element();
  document.createElement=()=>new Element();
  let now=0;const calls=[],state={appMode:'play',runtime:{},playing:true};
   let resize;
   const context=vm.createContext({document,window,performance:{now:()=>now},ResizeObserver:class{
     constructor(fn){resize=fn}
     observe(node){assert.equal(node,inner)}
   }});
  vm.runInContext(source('js/08-hud-pause.js'),context);
  const pause=context.createHudPause({state,inner,setPlaying:v=>{state.playing=v;calls.push(v)}}),button=inner.child;
  function event(type,props={}){window.emit(type,{target:button,...props});return button.emit(type,props)}
  function tap(props={}){event('pointerdown',props);now+=20;event('pointerup',props);button.emit('click',{detail:1});now+=60}
   return {state,window,document,button,pause,calls,event,tap,advance:n=>now+=n,resize:width=>{inner.clientWidth=width;resize()}};
}
test('touch needs two local taps within one second; paused touch resumes once',()=>{
  const h=setup();h.tap();assert.deepEqual(h.calls,[]);h.tap();assert.deepEqual(h.calls,[false]);
  h.tap();assert.deepEqual(h.calls,[false,true]);h.tap();assert.deepEqual(h.calls,[false,true]);
});
test('first touch shows a circle while awaiting the second tap',()=>{
  const h=setup();h.tap();assert.equal(h.button.attrs['data-awaiting-tap'],'true');
  h.advance(500);h.tap();assert.deepEqual(h.calls,[false]);assert.equal(h.button.attrs['data-awaiting-tap'],'false');
});
test('desktop pointer also needs two clicks; accessible click remains operable',()=>{
  const h=setup();h.tap({pointerType:'mouse'});assert.deepEqual(h.calls,[]);
  h.tap({pointerType:'mouse'});assert.deepEqual(h.calls,[false]);
  h.button.emit('click',{detail:0});assert.deepEqual(h.calls,[false,true]);
  h.tap({pointerType:'mouse',button:2});assert.deepEqual(h.calls,[false,true]);
});
test('hidden HUD retains focus and pointer hit target, undefined defaults visible',()=>{
  const h=setup();assert.equal(h.button.attrs['data-hud-visible'],'true');
  h.state.hudVisible=false;h.pause.sync();assert.equal(h.button.attrs['data-hud-visible'],'false');
  assert.equal(h.button.disabled,false);assert.equal(h.button.tabIndex,0);
  h.tap();h.tap();assert.deepEqual(h.calls,[false]);assert.equal(h.button.attrs['aria-label'],'继续播放');
});
test('focused Space/Enter consume gameplay keys, repeat and keyup do not toggle',()=>{
  for(const code of ['Space','Enter']){
    const h=setup();h.button.focus();
    assert.equal(h.window.emit('keydown',{code}).stopped,true);
    h.window.emit('keydown',{code,repeat:true});h.window.emit('keyup',{code});
    assert.deepEqual(h.calls,[false]);
  }
});
test('stale taps are cleared by outside hits, multitouch, cancel, focus, chart, playback and mode changes',()=>{
  for(const interrupt of [
    h=>h.window.emit('pointerdown',{pointerId:2}),
    h=>{h.event('pointerdown');h.event('pointerdown',{pointerId:2,isPrimary:false});h.event('pointerup',{pointerId:2});h.event('pointerup')},
    h=>h.event('pointercancel'),h=>h.button.emit('blur'),h=>h.window.emit('blur'),
    h=>h.window.emit('pagehide'),h=>h.document.emit('visibilitychange'),
    h=>{h.state.runtime={};h.pause.sync()},
    h=>{h.state.playing=false;h.pause.sync();h.state.playing=true;h.pause.sync()},
    h=>{h.state.appMode='edit';h.pause.sync();h.state.appMode='play';h.pause.sync()},
    h=>h.advance(1001),
  ]){const h=setup();h.tap();interrupt(h);h.tap();assert.deepEqual(h.calls,[])}
});
test('long press, movement, release outside and lost capture invalidate the tap pair',()=>{
  for(const interrupt of [h=>h.advance(301),h=>h.event('pointermove',{clientX:30}),
    h=>h.event('pointermove',{clientX:100}),h=>h.button.emit('lostpointercapture')]){
    const h=setup();h.tap();h.event('pointerdown');interrupt(h);h.event('pointerup');h.tap();assert.deepEqual(h.calls,[]);
  }
  const h=setup();h.tap();h.event('pointerdown');h.event('pointerup',{clientY:57});h.tap();assert.deepEqual(h.calls,[]);
});
test('unsynchronized chart or playback changes invalidate an active press',()=>{
  for(const change of [h=>h.state.runtime={},h=>h.state.playing=false]){
    const h=setup();h.tap();h.event('pointerdown');change(h);h.event('pointerup');assert.deepEqual(h.calls,[]);
  }
});
test('wiring preserves original range and synchronizes HUD after rendering',()=>{
  const html=source('index.html'),js=source('js/08-play-enlarged.js'),css=source('css/play-enlarged.css');
  assert.ok(html.indexOf('js/08-hud-pause.js')<html.indexOf('js/08-play-enlarged.js'));
  assert.match(js,/oldRender\.apply\(this,arguments\);pause\.sync\(\)/);
  assert.doesNotMatch(js,/createElement\('input'\)|playExpandedPause/);
  assert.match(html,/id="timeSlider"[^>]*type="range"/);
  assert.match(css,/\.hudPause\[data-hud-visible="false"\]::before\{opacity:0\}/);
   assert.match(css,/width:42px;min-width:42px;height:42px;min-height:42px/);
   assert.doesNotMatch(source('css/final-fullscreen.css'),/hudPause|playExpandedPause/);
});
test('pause follows score center on stage resize, including rotated portrait layout width',()=>{
  const h=setup();
  for(const width of [360,640,1280,1920,844,320]){
    h.resize(width);
    const rect=h.button.getBoundingClientRect();
    assert.ok(Math.abs((rect.top+rect.bottom)/2-width*.03958)<.001||rect.top===0);
    assert.ok(Math.abs(rect.bottom-rect.top-42)<.001);
    assert.ok(rect.top>=0);
  }
});
test('circular pause target sits above progress hit area',()=>{
  const css=source('css/play-enlarged.css'),progress=source('css/play-controls.css');
  const declarations=selector=>Object.fromEntries(css.split(`${selector}{`)[1].split('}')[0].split(';').filter(Boolean).map(s=>s.split(':')));
  const button=declarations('.hudPause'),icon=declarations('.hudPause::before');
  for(const [key,value]of Object.entries({padding:'0',margin:'0',border:'0','border-radius':'50%',background:'rgba(139,145,157,.68)','box-shadow':'none',appearance:'none','box-sizing':'border-box','min-height':'42px'}))assert.equal(button[key],value,key);
  const active=declarations('.hudPause:hover,.hudPause:active');
  assert.equal(active.background,'rgba(155,161,174,.76)');assert.equal(active.transform,'none');assert.equal(active['box-shadow'],'none');
  assert.equal(icon.width,'9px');assert.equal(icon.height,'12px');
  assert.equal(icon['border-left'],'2px solid #202632');assert.equal(icon['border-right'],'2px solid #202632');
  assert.equal(icon['pointer-events'],'none');
  assert.ok(Number(button['z-index'])>Number(progress.match(/\.hudProgress\{[^}]*z-index:(\d+)/)[1]));
  // 小舞台暂停命中区进入顶部 24px 时，仍必须能双击暂停、单击继续。
  const h=setup();assert.ok(h.button.getBoundingClientRect().top<24);
  h.tap();h.tap();h.tap();assert.deepEqual(h.calls,[false,true]);
});
test('legacy stage pause routes are absent and lower playback control remains',()=>{
  const html=source('index.html');
  assert.doesNotMatch(html,/id="(?:fsPlayBtn|playExpandedPause)"/);
  assert.doesNotMatch(source('css/play-controls.css'),/fsPlayBtn/);
  assert.match(html,/<div class="controls"><div class="row"><button id="playBtn"/);
});
test('complete script chain retains per-render HUD synchronization',()=>{
  const {createHarness}=require('./harness.js');
  const h=createHarness(join(__dirname,'..'));
   const button=h.get('stageInner').children.find(node=>node.className==='hudPause');
   assert.ok(button);
   assert.equal(h.get('stageInner').children.filter(node=>node.className==='hudPause').length,1);
   assert.equal(h.run('els.fsPlayBtn'),null);assert.ok(h.get('playBtn'));
   assert.equal(parseFloat(button.style.top),1280*.03958-21);
  h.run('state.hudVisible=false;render()');assert.equal(button['data-hud-visible'],'false');
  h.run('state.hudVisible=undefined;render()');assert.equal(button['data-hud-visible'],'true');
});
