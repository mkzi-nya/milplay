// Run on the phone with: node --test hud-progress.test.cjs
// DOM stubs verify logic and wiring, not browser layout or native touch delivery.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const source=name=>readFileSync(join(__dirname,name),'utf8');
function setup(){
  class Element{
    listeners={};attrs={};capture=null;
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
    setAttribute(k,v){this.attrs[k]=v}
    appendChild(child){this.child=child}
    setPointerCapture(id){this.capture=id}
    releasePointerCapture(id){if(this.capture===id){this.capture=null;this.emit('lostpointercapture',{pointerId:id})}}
    focus(){document.activeElement=this}
    blur(){document.activeElement=null;this.emit('blur')}
    emit(type,props={}){
      const e={pointerId:1,isPrimary:true,button:0,clientX:200,clientY:55,prevented:false,stopped:false,
        preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...props};
      for(const fn of this.listeners[type]||[])fn(e);
      return e;
    }
  }
  const document=new Element();
  document.createElement=()=>new Element();
  document.getElementById=()=>null;
  const inner=new Element(),stage=new Element(),window=new Element();
  let rect={left:100,top:50,width:400,height:225},transform='none';
  stage.getBoundingClientRect=()=>rect;
  const state={appMode:'play',runtime:{},duration:100,currentTime:0,playing:false};
  const seeks=[];
  const context=vm.createContext({document,window,state,els:{stage,stageInner:inner},
    getComputedStyle:()=>({transform}),
    DOMMatrixReadOnly:class{constructor(value){const values=value.slice(7,-1).split(',').map(Number);this.a=values[0];this.b=values[1]}},
    clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),render(){},updateModeUI(){},updateControls(){},updateUI(){},
    seek(t){seeks.push(t);state.currentTime=t;context.updateControls()}});
  vm.runInContext(source('js/07-hud-progress.js'),context);
  vm.runInContext(source('js/07-play-controls.js'),context);
  return {state,seeks,slider:inner.child,window,document,context,
    geometry(r,t='none'){rect=r;transform=t}};
}
test('paused seek uses full canvas ratio, clamps outside, and captures until release',()=>{
  const {slider,state}=setup();
  assert.equal(slider.emit('pointerdown').prevented,true);
  assert.equal(state.currentTime,25);assert.equal(slider.capture,1);
  slider.emit('pointermove',{clientX:600});assert.equal(state.currentTime,100);
  slider.emit('pointermove',{clientX:-50});assert.equal(state.currentTime,0);
  slider.emit('pointerup',{clientX:400});assert.equal(state.currentTime,75);
  assert.equal(slider.capture,null);
  slider.emit('pointermove');assert.equal(state.currentTime,75);
});
test('native portrait rotation and CSS scale map the visual top line from top to bottom',()=>{
  const h=setup();
  h.geometry({left:20,top:80,width:225,height:400},'matrix(0, 0.5, -0.5, 0, 0, 0)');
  h.slider.emit('pointerdown',{clientX:244,clientY:180});assert.equal(h.state.currentTime,25);
  h.slider.emit('pointermove',{clientX:244,clientY:380});assert.equal(h.state.currentTime,75);
  h.slider.emit('pointerup',{clientY:900});assert.equal(h.state.currentTime,100);
});
test('expanded mode uses its unrotated letterboxed canvas and refreshed geometry',()=>{
  const h=setup();
  h.geometry({left:40,top:200,width:800,height:450});
  h.slider.emit('pointerdown',{clientX:440});assert.equal(h.state.currentTime,50);
  h.geometry({left:10,top:30,width:200,height:112.5},'matrix(0.5, 0, 0, 0.5, 0, 0)');
  h.slider.emit('pointermove',{clientX:60});assert.equal(h.state.currentTime,25);
});
test('playing forbids seek without preventing or stopping gameplay events',()=>{
  const h=setup();h.state.playing=true;h.context.updateControls();
  for(const type of ['pointerdown','pointermove','pointerup']){
    const e=h.slider.emit(type);assert.equal(e.prevented,false);assert.equal(e.stopped,false);
  }
  h.slider.emit('keydown',{key:'End'});
  assert.deepEqual(h.seeks,[]);assert.equal(h.slider.tabIndex,-1);
  assert.equal(h.slider.attrs['aria-disabled'],'true');
});
test('cancel, lost capture and focus loss do not seek at their coordinates',()=>{
  for(const type of ['pointercancel','lostpointercapture','blur']){
    const h=setup();h.slider.emit('pointerdown');
    h.slider.emit(type,{clientX:500});h.slider.emit('pointermove',{clientX:500});
    assert.deepEqual(h.seeks,[25]);assert.equal(h.slider.capture,null);
  }
});
test('secondary touches and mouse buttons cannot start or steal a drag',()=>{
  const h=setup();
  h.slider.emit('pointerdown',{isPrimary:false});h.slider.emit('pointerdown',{button:2});
  assert.deepEqual(h.seeks,[]);
  h.slider.emit('pointerdown');
  h.slider.emit('pointerdown',{pointerId:2,clientX:400});
  h.slider.emit('pointermove',{pointerId:2,clientX:400});h.slider.emit('pointercancel',{pointerId:2});
  assert.equal(h.slider.capture,1);assert.deepEqual(h.seeks,[25]);
});
test('playback, external seek, chart switch and mode change end the current drag',()=>{
  for(const change of [h=>{h.state.playing=true;h.context.updateControls()},
    h=>h.context.seek(60),h=>{h.state.runtime={};h.context.updateUI()},
    h=>{h.state.appMode='edit';h.context.updateControls()}]){
    const h=setup();h.slider.emit('pointerdown');change(h);
    const before=h.state.currentTime;
    assert.equal(h.slider.capture,null);
    h.slider.emit('pointermove',{clientX:450});h.slider.emit('pointerup',{clientX:450});
    assert.equal(h.state.currentTime,before);
  }
});
test('unsynchronized chart/time changes cannot continue an old drag',()=>{
  for(const change of [h=>h.state.runtime={},h=>h.state.currentTime=10,h=>h.state.duration=200,h=>h.state.playing=true]){
    const h=setup();h.slider.emit('pointerdown');change(h);
    h.slider.emit('pointermove',{clientX:450});assert.deepEqual(h.seeks,[25]);
    assert.equal(h.slider.capture,null);
  }
});
test('keyboard slider supports arrows, pages, endpoints and accessible values',()=>{
  const h=setup();
  assert.equal(h.slider.attrs.role,'slider');assert.equal(h.slider.tabIndex,0);
  for(const [key,value] of [['ArrowRight',1],['PageUp',11],['ArrowDown',10],['End',100],['PageDown',90],['Home',0],['ArrowLeft',0]]){
    assert.equal(h.slider.emit('keydown',{key}).prevented,true);
    assert.equal(h.state.currentTime,value);assert.equal(h.slider.attrs['aria-valuenow'],String(value));
  }
  h.state.duration=0;h.context.updateControls();h.slider.emit('pointerdown');
  assert.equal(h.slider.attrs['aria-disabled'],'true');assert.equal(h.slider.capture,null);
});
test('HTML wiring and CSS remove the extra bar and disable the historical enlarged slider',()=>{
  const html=source('index.html'),css=readdirSync(join(__dirname,'css')).map(f=>source('css/'+f)).join('\n');
  const removed='fs'+'Progress';
  for(const text of [html,css,...readdirSync(join(__dirname,'js')).filter(f=>f.endsWith('.js')).map(f=>source('js/'+f))])assert.equal(text.includes(removed),false);
  assert.ok(html.indexOf('js/07-hud-progress.js')<html.indexOf('js/07-play-controls.js'));
  assert.match(html,/id="timeSlider"/);
  assert.match(css,/\.playExpandedSeek\{display:none!important;pointer-events:none!important\}/);
  assert.match(css,/\.hudProgress\{[^}]*pointer-events:none/);
  assert.match(css,/\.hudProgress\[aria-disabled="false"\]\{pointer-events:auto/);
});
