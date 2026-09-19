'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./harness.js');
const {entry,png}=require('./storyboard-assets.cjs');
const root=path.resolve(__dirname,'..');

test('real package storyboard values and decoded pixel coverage',async()=>{
  const h=createHarness(root);
  h.context.source=entry('Special_Algebra.js').toString('utf8');
  const {chart}=await h.run('parseText(source,"Special_Algebra.js")');
  h.context.chart=chart;
  h.run('window.rt=makeRuntime(chart)');
  for(const name of ['black.png','beats1.png']){
    const image=png(entry('storyboard/'+name));
    if(name==='black.png'){
      assert.deepEqual([image.width,image.height,image.minAlpha,image.maxAlpha,image.maxRGB,image.opaque],[1920,1080,255,255,0,2073600]);
      assert.deepEqual(image.bounds,[0,0,1920,1080]);
    }else{
      assert.deepEqual([image.width,image.height,image.minAlpha,image.maxAlpha,image.nonzero,image.opaque],[1280,720,0,255,34506,17446]);
      assert.deepEqual(image.bounds,[75,72,1205,552]);
    }
    h.context.name=name;
    h.context.imageSize=[image.width,image.height];
    h.run('{const canvas=document.createElement("canvas");canvas.width=imageSize[0];canvas.height=imageSize[1];storyCache.set(name,{drawable:canvas,sourceWidth:imageSize[0],sourceHeight:imageSize[1]})}window.draws=[];__milDrawRotTinted=(img,x,y,w,h,rotation,alpha,color)=>draws.push({x,y,w,h,rotation,alpha,color});');
    for(const sec of [40,45,49,51]){
      h.context.sec=sec;
      const actual=JSON.parse(JSON.stringify(h.run('rt.storyboards.filter(s=>s.data===name).map(s=>[s.index,s.layer,...[POS_X,POS_Y,REL_X,REL_Y,SIZE,SB_WIDTH,SB_HEIGHT,ROTATION,TRANSPARENCY,COLOR].map(k=>rt.sbValue(s,k,sec))])')));
      assert.deepEqual(actual,name==='black.png'?[
        [69,0,0,0,0,0,3,1,1,0,sec===40?0:.5,0xffffffff],
        [72,1,0,0,0,0,3,1,1,0,0,0xffffffff]
      ]:[[74,2,0,80,0,0,1,1,1,0,sec===45||sec===49?1:0,0xffffffff]]);
      // Only these objects, but the production evaluator, cache and final renderer.
      const draws=JSON.parse(JSON.stringify(h.run('draws.length=0;{const subset={storyboards:rt.storyboards.filter(s=>s.data===name),sbValue:rt.sbValue};for(let layer=0;layer<3;layer++)drawStoryboardLayer(subset,layer,sec,1920,1080)}draws')));
      const visible=name==='black.png'?sec!==40:sec===45||sec===49;
      assert.equal(draws.length,visible?1:0);
      if(visible){
        const d=draws[0];assert.deepEqual([d.x,d.y,d.w,d.h,d.alpha,d.color],name==='black.png'?[960,540,5760,3240,1,[255,255,255,127.5]]:[960,460,1280,720,1,[255,255,255,255]]);
        if(name==='black.png'){
          const coverage=Math.max(0,Math.min(1920,d.x+d.w/2)-Math.max(0,d.x-d.w/2))*Math.max(0,Math.min(1080,d.y+d.h/2)-Math.max(0,d.y-d.h/2));
          assert.equal(coverage,2073600,'full viewport is covered, but at authored alpha .5');
          assert.equal(255*(1-d.color[3]/255),127.5,'white background cannot become pure black');
        }
      }
    }
  }
});

function geometryHarness(){
  const h=createHarness(root);
  h.run('window.draws=[];__milDrawRotTinted=(img,x,y,w,h,rotation,alpha,color)=>draws.push({x,y,w,h,rotation,alpha,color});window.sb={index:0,type:0,layer:1,data:"arbitrary.png"};window.values={0:96,1:54,6:96,7:54,2:.5,3:3,4:30,10:-2,11:.25,22:0x80402080};window.rt={storyboards:[sb],sbValue:(s,k)=>values[k]??0};');
  return h;
}

test('natural dimensions survive sampling; SIZE/WIDTH/HEIGHT, signs and offsets are independent',()=>{
  const h=geometryHarness();
  h.run('const image=document.createElement("canvas");image.width=2560;image.height=1440;storyCache.set(sb.data,{drawable:image,sourceWidth:4096,sourceHeight:2304})');
  for(const [w,height]of [[1920,1080],[1280,720],[1080,1920]]){
    h.context.viewport=[w,height];
    const d=h.run('draws.length=0;drawStoryboardLayer(rt,1,0,...viewport);draws[0]');
    assert.equal(d.w,4096*w/1920*3*-2);assert.equal(d.h,2304*w/1920*3*.25);
    assert.equal(d.x,w*.6);assert.equal(d.y,height*.4);assert.equal(d.rotation,-30);
    assert.deepEqual(Array.from(d.color),[128,64,32,64]);
  }
  h.run('values[10]=0;draws.length=0;drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.equal(h.run('draws.length'),0);
});

test('unresampled image uses natural dimensions, not DOM display dimensions',()=>{
  const h=geometryHarness();
  h.run('const image=new Image();image.ready(1920,1080);image.width=100;image.height=100;storyCache.set(sb.data,{img:image});drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.deepEqual(Array.from(h.run('[draws[0].w,draws[0].h]')),[-11520,810]);
});

test('COLOR interpolates channels and multiplies authored transparency without an alpha cutoff',()=>{
  const h=geometryHarness();
  assert.deepEqual(Array.from(h.run('rgbaFromUint(eventValue({key:COLOR,fv:0xff0000ff,tv:0x00ff0080,startSec:0,endSec:1,ease:0,press:0,custom:""},0,.5))')),[127,127,0,191]);
  h.run('const image=document.createElement("canvas");image.width=100;image.height=100;storyCache.set(sb.data,{drawable:image});values[2]=.0005;drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.equal(h.run('draws[0].color[3]'),128*.0005);
  h.run('window.fills=[];ctx.fillRect=()=>fills.push(ctx.globalAlpha);sb.data="builtin.rect";drawStoryboardLayer(rt,1,0,1920,1080)');
  assert.equal(h.run('fills.length'),1);assert.equal(h.run('fills[0]'),128*.0005/255);
});

test('foreground follows all gameplay layers and precedes HUD; layer and authored ordering are stable',()=>{
  const h=createHarness(root);
  h.run(`
    state.appMode='edit';state.currentTime=1;
    const n={lineIdx:0,startSec:1,activeFrom:0,activeTo:2};
    state.runtime={duration:100,lineCount:1,notes:[n],storyboards:[],__pluNonHoldStarts:[n],__pluHolds:[],__pluLayerNotes:[[n],[n],[n]]};
    window.order=[];drawBg=()=>order.push('background');drawBackgroundDim=()=>order.push('dim');
    drawStoryboardLayer=(rt,layer)=>order.push('story'+layer);transformLine=()=>({});drawLineState=()=>order.push('line');
    __pluDrawHitRing=()=>order.push('ring');__pluDrawParticles=()=>order.push('particle');
    window.__gpDrawManualEffects=()=>{};drawNote=()=>order.push('note');drawCombo=()=>order.push('HUD');drawOverlay=()=>{};render();
  `);
  assert.deepEqual(Array.from(h.run('order')),['background','story0','dim','story1','line','ring','particle','note','note','note','story2','HUD']);
  const g=geometryHarness();
  g.run('const image=document.createElement("canvas");image.width=100;image.height=100;storyCache.set(sb.data,{drawable:image});rt.storyboards=[{...sb,index:8,layer:2},{...sb,index:3,layer:1},{...sb,index:1,layer:2}];rt.sbValue=(s,k)=>k===POS_X?s.index:values[k]??0;drawStoryboardLayer(rt,2,0,1920,1080)');
  assert.deepEqual(Array.from(g.run('draws.map(d=>d.x)')),[1064,1057]);
});
