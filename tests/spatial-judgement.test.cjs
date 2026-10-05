'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {join}=require('node:path');
const {createHarness}=require('./harness.js');
const root=join(__dirname,'..');

function setup(opts={},geometry={},type=0,hold=false){
  const h=createHarness(root,opts),g={width:1200,height:675,lineScale:1,noteScale:1,lineRotation:90,noteRotation:0,...geometry};
  h.get('stage').width=g.width;h.get('stage').height=g.height;
  h.get('stage').getBoundingClientRect=()=>({left:0,top:0,width:g.width,height:g.height});
  h.context.innerWidth=g.width;h.context.innerHeight=g.height;
  h.context.__geometry=g;h.context.__noteType=type;h.context.__hold=hold;
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:__hold?2:1,type:__noteType}]}],animations:[]});
    state.duration=state.runtime.duration;state.appMode='play';state.playing=true;state.currentTime=1;
    const originalLineValue=state.runtime.lineValue.bind(state.runtime),originalNoteValue=state.runtime.noteValue.bind(state.runtime);
    state.runtime.lineValue=(li,k,t)=>k===SIZE?__geometry.lineScale:k===ROTATION?__geometry.lineRotation:[POS_X,POS_Y,REL_X,REL_Y].includes(k)?0:originalLineValue(li,k,t);
    state.runtime.noteValue=(n,k,t)=>k===SIZE?__geometry.noteScale:k===ROTATION?__geometry.noteRotation:originalNoteValue(n,k,t);
    window.note=state.runtime.notes[0];note.hasSize=true;note.hasRot=true;__gpTest.fresh();`);
  const point=distance=>{
    const angle=(90-g.lineRotation-g.noteRotation)*Math.PI/180;
    return{x:g.width/2+Math.cos(angle)*distance,y:g.height/2+Math.sin(angle)*distance};
  };
  const hit=(distance,lightning=false)=>{
    h.context.__point=point(distance);
    return h.run(lightning?'__gpTest.isLightningHit(note,1,__point)':'__gpTest.isHit(1,note,__point)');
  };
  return{h,g,point,hit};
}

test('Tap, Drag and Hold heads use a total width of 1/6 for mouse and touch',()=>{
  for(const maxTouchPoints of [0,5])for(const [type,hold] of [[0,false],[1,false],[0,true]]){
    const {hit}=setup({maxTouchPoints},{},type,hold);
    for(const sign of [-1,1]){
      assert.equal(hit(sign*100),true,'the +/- width/12 boundary is included');
      assert.equal(hit(sign*100.01),false,'contact beyond width/12 must not hit');
      assert.equal(hit(sign*145),false,'the old desktop box must no longer accept this contact');
    }
  }
});

test('horizontal width remains 1/6 along the note axis across rotation and scale',()=>{
  for(const geometry of [
    {width:768,height:432,lineScale:.5,noteScale:2,lineRotation:45,noteRotation:30},
    {width:1536,height:864,lineScale:2,noteScale:.25,lineRotation:0,noteRotation:0},
    {width:720,height:1280,lineScale:-.5,noteScale:3,lineRotation:120,noteRotation:-35},
  ]){
    const {h,g,hit}=setup({maxTouchPoints:0},geometry);
    h.run('state.noteScale=4');
    for(const sign of [-1,1]){
      assert.equal(hit(sign*(g.width/12-.01)),true);
      assert.equal(hit(sign*(g.width/12+.01)),false);
    }
    assert.equal(h.run('__gpTest.isHit(1,note,{isKey:true,x:0,y:0})'),true,'keyboard input remains positionless');
  }
});

test('real pointer input preserves the same visible width at different canvas resolutions',()=>{
  for(const maxTouchPoints of [0,5])for(const backingWidth of [600,1200,2400]){
    const {h}=setup({maxTouchPoints},{width:backingWidth,height:backingWidth*9/16});
    h.context.innerWidth=1200;h.context.innerHeight=675;
    h.get('stage').getBoundingClientRect=()=>({left:40,top:80,width:1200,height:675});
    const down=[...h.get('stage').listeners.get('pointerdown')].find(fn=>String(fn).includes('gpCanvasPoint'));
    for(const [distance,expected] of [[99,1],[110,0],[-99,1],[-110,0]]){
      h.run('__gpTest.fresh();state.lastTick=performance.now()');
      down({target:h.get('stage'),pointerId:1,pointerType:maxTouchPoints?'touch':'mouse',button:0,
        clientX:40+600+distance,clientY:80+675/2,preventDefault(){},stopImmediatePropagation(){}});
      assert.equal(h.run('__gpTest.gp.combo'),expected,`${backingWidth}px backing store, ${distance}px visible offset`);
    }
  }
});

test('screen width sets the range even when the gameplay canvas occupies half the viewport',()=>{
  const {h,hit}=setup({maxTouchPoints:5},{width:600,height:338});
  h.context.innerWidth=1200;
  assert.equal(hit(99),true,'100 CSS px half-width comes from the 1200px screen, not the 600px canvas');
  assert.equal(hit(101),false);
  h.context.visualViewport={width:960};
  assert.equal(hit(79),true);
  assert.equal(hit(81),false);
});

test('CSS-rotated fullscreen preserves screen-based width through pointer coordinate conversion',()=>{
  const {h}=setup({maxTouchPoints:5});
  h.context.innerWidth=675;h.context.innerHeight=1200;
  h.context.matchMedia=()=>({matches:true});
  h.get('stageWrap').classList.add('nativeLandscapeFallback');
  h.get('stage').getBoundingClientRect=()=>({left:0,top:0,width:675,height:1200});
  const down=[...h.get('stage').listeners.get('pointerdown')].find(fn=>String(fn).includes('gpCanvasPoint'));
  for(const [distance,expected] of [[55,1],[58,0],[-55,1],[-58,0]]){
    h.run('__gpTest.fresh();state.lastTick=performance.now()');
    down({target:h.get('stage'),pointerId:1,pointerType:'touch',button:0,
      clientX:675/2,clientY:600+distance,preventDefault(){},stopImmediatePropagation(){}});
    assert.equal(h.run('__gpTest.gp.combo'),expected,'the half-width is 675/12 CSS pixels along the rotated lane');
  }
});

test('judgement follows rendered note offsets and the rendered line rotation',()=>{
  const {h}=setup({maxTouchPoints:5});
  h.run(`state.runtime=makeRuntime({bpms:[{start:0,bpm:120}],lines:[{notes:[{startTime:1,endTime:1,type:0}]}],animations:[
    {data:0,i1:0,key:ROTATION,fromBeat:0,toBeat:10,fv:45,tv:45},
    {data:1,i1:0,key:POS_X,fromBeat:0,toBeat:10,fv:240,tv:240},
    {data:1,i1:0,key:REL_X,fromBeat:0,toBeat:10,fv:60,tv:60}
  ]});__gpTest.fresh();window.note=state.runtime.notes[0];window.st=transformLine(state.runtime,0,1,1200,675);
    window.frame=__pluNoteFrame(state.runtime,note,1,st,1200,675);
    window.onLane=applyLineWorld(st,1200,675,300,300);
    window.inside=applyLineWorld(st,1200,675,300+99*1920/1200,300);
    window.outside=applyLineWorld(st,1200,675,300+101*1920/1200,300);`);
  assert.equal(h.run('__gpTest.isHit(1,note,frame.center)'),true);
  assert.equal(h.run('__gpTest.isHit(1,note,onLane)'),true,'a point along the rendered lane must have zero lateral offset');
  assert.equal(h.run('__gpTest.isHit(1,note,inside)'),true);
  assert.equal(h.run('__gpTest.isHit(1,note,outside)'),false);
});

test('lightning retains half the ordinary width for both mouse and touch',()=>{
  for(const maxTouchPoints of [0,5]){
    const {hit}=setup({maxTouchPoints},{},2);
    for(const sign of [-1,1]){
      assert.equal(hit(sign*50,true),true);
      assert.equal(hit(sign*50.01,true),false);
    }
  }
});
