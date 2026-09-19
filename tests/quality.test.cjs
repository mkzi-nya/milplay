'use strict';
// node --test tests/quality.test.cjs；按 index.html 的真实覆盖顺序执行。
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./harness.js');
const root=path.resolve(__dirname,'..');
const budget=4147200;

function setup(){
  const h=createHarness(root),stage=h.get('stage');
  let layout={w:1280,h:720,rotated:false},reads=0;
  stage.getBoundingClientRect=()=>{reads++;return {left:0,top:0,width:layout.rotated?layout.h:layout.w,height:layout.rotated?layout.w:layout.h}};
  Object.defineProperties(stage,{clientWidth:{get:()=>layout.w},clientHeight:{get:()=>layout.h}});
  h.context.matchMedia=q=>({matches:q==='(orientation:portrait)'&&layout.rotated,addEventListener(){}});
  return Object.assign(h,{
    stage,reads:()=>reads,
    layout(w,height,rotated=false){layout={w,h:height,rotated};h.get('stageWrap').classList.toggle('nativeLandscapeFallback',rotated);h.run('markStageResize()')},
    size(){h.run('resizeCanvas()');return [stage.width,stage.height]}
  });
}

for(const [w,height,rotated] of [[960,540,false],[540,960,false],[960,540,true],[2560,1440,false],[1440,2560,false],[3000,1000,true]]){
  for(const dpr of [1,2,3])test(`stage ${w}x${height}, DPR ${dpr}, rotated ${rotated}`,()=>{
    const h=setup();h.context.devicePixelRatio=dpr;h.layout(w,height,rotated);
    const [bw,bh]=h.size(),scale=Math.min(dpr,2,Math.sqrt(budget/(w*height)));
    assert.deepEqual([bw,bh],[Math.floor(w*scale),Math.floor(height*scale)]);
    assert.ok(bw*bh<=budget);
    assert.ok(Math.abs(bw-w/height*bh)<=1+w/height,'aspect ratio differs by at most pixel rounding');
    h.context.document.fullscreenElement=h.get('stageWrap');
    h.run('markStageResize()');assert.deepEqual(h.size(),[bw,bh],'native fullscreen uses the same sizing policy');
    h.run('state.runtime={notes:{length:3000},storyboards:{length:101}}');
    assert.deepEqual(h.size(),[bw,bh],'heavy play keeps the same quality budget');
  });
}

test('low DPR and small views are not enlarged; area cap is not a per-axis cap',()=>{
  const h=setup();h.context.devicePixelRatio=.75;h.layout(200,100);
  assert.deepEqual(h.size(),[150,75]);
  h.context.devicePixelRatio=3;h.layout(2400,600);
  assert.deepEqual(h.size(),[4072,1018]);
  assert.ok(h.stage.width>3840);
});

test('dirty resize, DPR, mode, load and rotation update the cached dimensions',()=>{
  const h=setup();h.layout(960,540);h.context.devicePixelRatio=2;
  assert.deepEqual(h.size(),[1920,1080]);
  const reads=h.reads();h.size();assert.equal(h.reads(),reads,'no per-frame layout read');
  h.context.devicePixelRatio=1;assert.deepEqual(h.size(),[960,540]);
  h.context.devicePixelRatio=3;h.run("state.appMode='edit'");assert.deepEqual(h.size(),[1200,675]);
  h.run('state.runtime={notes:{length:3000},storyboards:[]}');assert.deepEqual(h.size(),[960,540]);
  h.run("state.appMode='play'");assert.deepEqual(h.size(),[1920,1080]);
  h.layout(1080,1920);assert.deepEqual(h.size(),[1527,2715]);
  h.layout(1920,1080,true);assert.deepEqual(h.size(),[2715,1527]);
});

function tintSetup(){
  const h=setup(),draws=[];
  h.context.__qualityRecord=(...args)=>draws.push(args);
  h.run('ctx.drawImage=window.__qualityRecord');
  return Object.assign(h,{draws,tint(dw,dh,sw=923,sh=923,color=[128,64,255,128]){
    h.context.__qualityTintArgs=[{naturalWidth:sw,naturalHeight:sh},0,0,sw,sh,-dw/2,-dh/2,dw,dh,color];
    h.run('__milTintSlice(...window.__qualityTintArgs)');
    return draws.at(-1);
  }});
}

test('tint uses backing pixels at DPR 1/2/3, including editor zoom and source limits',()=>{
  const h=tintSetup();
  for(const dpr of [1,2,3]){
    h.context.devicePixelRatio=dpr;
    assert.deepEqual(h.tint(20,30).slice(3,5),[20,30]);
  }
  h.run('state.viewScale=2');assert.deepEqual(h.tint(20,30).slice(3,5),[40,60]);
  assert.deepEqual(h.tint(2000,1000).slice(3,5),[923,923]);
  h.run('state.viewScale=1');assert.deepEqual(h.tint(-20.2,-30.2).slice(3,5),[21,31]);
  assert.deepEqual(h.tint(3000,2,512,1).slice(3,5),[512,1]);
});

test('tint budgets, buffer reuse, white bypass and original destination are preserved',()=>{
  const h=tintSetup(),first=h.tint(10,10)[0];
  for(const [dw,dh] of [[8000,8000],[8000,40],[40,8000]]){
    const draw=h.tint(dw,dh,10000,10000),[tw,th]=draw.slice(3,5);
    assert.equal(draw[0],first);assert.ok(tw*th<=1048576);assert.ok(Math.max(tw,th)<=4096);
    assert.deepEqual(draw.slice(5),[-dw/2,-dh/2,dw,dh]);
  }
  const white=h.tint(20,30,923,923,[255,255,255,128]);
  assert.equal(white[0].naturalWidth,923,'white bypass draws original image');
  const n=h.draws.length;h.tint(0,10);h.tint(NaN,10);assert.equal(h.draws.length,n);
});

test('tint is bounded by available drawable, not storyboard original geometry',()=>{
  const h=tintSetup(),canvas=h.context.document.createElement('canvas');canvas.width=1280;canvas.height=720;
  h.context.__qualityImage=canvas;
  h.run("storyCache.set('large.png',{drawable:window.__qualityImage,sourceWidth:4096,sourceHeight:2304});__milTintSlice(window.__qualityImage,0,0,1280,720,0,0,2560,1440,[128,128,128,255])");
  assert.deepEqual(h.draws.at(-1).slice(3,5),[1280,720]);
});

for(const viaFile of [false,true])test(`高画质故事板取样与缓存 (${viaFile?'包内文件':'URL 回退'})`,()=>{
  const h=setup();
  if(viaFile){h.context.__qualityFile=new File(['image'],'storyboard/large.png',{type:'image/png'});h.run('window.__milResolveStoryboardFile=()=>window.__qualityFile')}
  h.run("render=()=>{};state.runtime={notes:{length:3000},storyboards:[]};storyImage('large.png')");
  const image=h.images.at(-1);image.ready(4096,2304);
  assert.deepEqual(Array.from(h.run("[storyImage('large.png').width,storyImage('large.png').height]")),[2560,1440]);
  assert.deepEqual(Array.from(h.run("[storyCache.get('large.png').sourceWidth,storyCache.get('large.png').sourceHeight]")),[4096,2304]);
  const count=h.images.length;
  h.context.devicePixelRatio=3;h.layout(1920,1080);h.size();
  for(let i=0;i<10;i++)h.run("storyImage('large.png')");
  assert.equal(h.images.length,count,'resize does not trigger repeated decode');
  assert.equal(h.run("storyCache.get('large.png').img"),null,'source image has been discarded by the existing loader');
  h.run("storyCache.clear();storyImage('large.png')");
  assert.equal(h.images.length,count+1,'asset invalidation loads a new record');
  image.ready(8192,8192);
  assert.equal(h.run("storyCache.get('large.png').drawable"),null,'stale load cannot overwrite new record');
});

// 使用当前脚本链的语义自测；01 中旧版自测的事件、颜色取整规则已被后续覆盖。
for(const name of ['__milthmFullRenderSelfTest','__algebraStoryboardReviewSelfTest','__targetedReviewSelfTest']){
  test(`original semantics: ${name}`,async()=>{
    const h=setup(),result=await h.run(`window.${name}()`);
    assert.equal(result.ok,true,JSON.stringify(result));
  });
}
