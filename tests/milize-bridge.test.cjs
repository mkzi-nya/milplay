'use strict';
// Milize JS bridge contract tests using small charts defined in this file.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./harness.js');

const root=path.resolve(__dirname,'..');
const h=createHarness(root,{childTimeout:60000});

function parseSource(source){
  h.context.__src=source;
  return h.run('parseText(__src,"sample.js")');
}
function countNotes(chart){let n=0;for(const l of chart.lines||[])n+=(l.notes||[]).length;return n}

test('桥接：短别名 / 全名 / 解绑调用均能写入同一实例',async()=>{
  // 短别名
  const short=await parseSource('const b=t(10,60,4);const l=m.line();const q=n(l,b,[2,0,1],[2,0,1],0,false,false);a(b,[0,0,1],[1,0,1],0,1,2,1,q,0,0,false,"");');
  assert.equal(short.chart.bpms.length,1);
  assert.equal(short.chart.lines[0].notes.length,1);
  assert.equal(short.chart.lines[0].notes[0].bpm,0,'timing 必须返回 BPM id');
  assert.equal(short.chart.animations[0].i1,0,'note 必须返回 Note id');
  // 全名
  const full=await parseSource('const b=m.timing(0,120,4);const l=m.line();const q=m.note(l,b,[0,0,1],[0,0,1],0,false,false);m.animation(b,[0,0,1],[1,0,1],0,0,1,1,q,13,2,true,"x");');
  assert.equal(full.chart.animations[0].press,13);
  assert.equal(full.chart.animations[0].ease,2);
  assert.equal(full.chart.animations[0].valueExpression,true);
  // 解绑保存后调用（Cloudburst_Threat - Metropolis 的核心形态）
  const unbound=await parseSource('var n0=MilizeBeatmap,u0=n0.timing,w=n0.line,s=n0.note,e=n0.animation,Y=n0.withProperty;Y("a","b");var b=u0(0,120,4),l=w();var q=s(l,b,[0,0,1],[0,0,1],0,false,false);e(b,[0,0,1],[1,0,1],0,0,1,1,q,0,0,false,"");');
  assert.equal(countNotes(unbound.chart),1);
  assert.equal(unbound.chart.animations.length,1);
  assert.equal(unbound.chart.meta.a,'b');
});

test('桥接：直接引用全局 MilizeBeatmap 与链式调用',async()=>{
  const r=await parseSource('MilizeBeatmap.withProperty("k","v").note(MilizeBeatmap.line(),MilizeBeatmap.timing(0,120,4),[0,0,1],[0,0,1],0,false,false);MilizeBeatmap.animation(0,[0,0,1],[1,0,1],0,0,1,0,0,0,0,false,"");');
  assert.equal(countNotes(r.chart),1);
  assert.equal(r.chart.meta.k,'v');
  assert.equal(r.chart.animations.length,1);
  // 先解构方法，再通过 MilizeBeatmap 链式继续
  const chain=await parseSource('var p=MilizeBeatmap.withProperty;p("x",1).p&&0;MilizeBeatmap.withProperty("y",2).withProperty("z",3);MilizeBeatmap.line();');
  assert.equal(chain.chart.meta.y,2);
  assert.equal(chain.chart.meta.z,3);
});

test('桥接：打包后方法别名任意命名也能识别（Sky Islands 形态）',async()=>{
  const r=await parseSource('var L=MilizeBeatmap,ul=L.env,nl=L.timing,k=L.line,Nl=L.storyboardObject,f=L.note,l=L.animation,D=L.withProperty;D("Title","x");nl(0,120,4);var ln=k();f(ln,0,[0,0,1],[0,0,1],0,false,false);Nl(1,"t",2);l(0,[0,0,1],[1,0,1],0,0,1,0,0,0,0,false,"");');
  assert.equal(countNotes(r.chart),1);
  assert.equal(r.chart.storyboardObjects.length,1);
  assert.equal(r.chart.meta.Title,'x');
});

test('桥接：env 返回实际舞台尺寸字符串，不随 DPR 改变',async()=>{
  const r=await parseSource('m.withProperty("w",m.env("stage.width"));m.withProperty("h",m.env("stage.height"));m.withProperty("nope",m.env("missing.key"));m.timing(0,120,4);m.line();');
  assert.equal(r.chart.meta.w,'1280');
  assert.equal(r.chart.meta.h,'720');
  assert.equal(r.chart.meta.nope,'');
});

test('桥接：保留 _note_create_order / __noteGlobal 等标识信息',async()=>{
  const r=await parseSource('const b=m.timing(0,120,4);const l0=m.line(),l1=m.line();m.note(l1,b,[0,0,1],[0,0,1],0,false,false);m.note(l0,b,[1,0,1],[1,0,1],0,false,false);');
  assert.equal(countNotes(r.chart),2);
  assert.equal(JSON.stringify(r.chart._note_create_order),JSON.stringify([[1,0],[0,0]]),'note 创建顺序必须是全局顺序');
  const note0=r.chart.lines[1].notes[0];
  assert.equal(note0.__line_local_idx,0);
});

test('检测：__milLooksLikeBeatmapJs 识别打包与经典形态且不误判普通 JSON',()=>{
  const looks=h.run('__milLooksLikeBeatmapJs');
  assert.equal(looks('(()=>{var n0=MilizeBeatmap,u0=n0.timing;u0(0,120);})();'),true,'解绑别名形态');
  assert.equal(looks('var L=MilizeBeatmap,ul=L.env;ul("time");'),true,'逗号别名形态');
  assert.equal(looks('!function(){"use strict";MilizeBeatmap.withProperty("a",1)}();'),true,'全局直调形态');
  assert.equal(looks('import m from "beatmap-js";m.timing(0,120);'),true,'经典未打包形态');
  assert.equal(looks('{"FormatVersionCode":9,"BPMList":[]}'),false,'普通 JSON 不应被当作 JS 谱面');
  assert.equal(looks('function add(a,b){return a+b}'),false,'普通 JS 不应被当作谱面');
});

test('检测：仅 timing/line 的最小谱面仍被接受',async()=>{
  const r=await parseSource('m.timing(0,120,4);m.line();');
  assert.equal(r.chart.bpms.length,1);
  assert.equal(r.chart.lines.length,1);
});

test('超时与隔离：语法错误谱面不会污染主上下文',async()=>{
  await assert.rejects(()=>parseSource('m.timing(0,120,4);m.line();throw new Error("boom");'),/boom/);
  // 主上下文仍可继续解析
  const r=await parseSource('m.timing(0,120,4);m.line();');
  assert.equal(r.chart.bpms.length,1);
});
