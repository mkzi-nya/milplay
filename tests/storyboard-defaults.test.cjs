'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./harness.js');
const root=path.resolve(__dirname,'..');

test('unanimated storyboards are transparent; authored opacity and line defaults survive',async()=>{
  const h=createHarness(root);
  const source='m.line();s(0,"builtin.line",1);s(0,"builtin.line",1);a(0,0,0,2,"0.25","0.25",2,0,0,0,false,"");';
  h.context.source=source;
  const charts=[await h.run('milizeJsToJson(source)'),h.run('staticTjson(source)')];
  charts.push(JSON.parse(JSON.stringify(charts[0])));
  for(const chart of charts){
    h.context.chart=chart;
    h.run('window.rt=makeRuntime(chart)');
    for(const time of [0,100,180,0]){
      h.context.time=time;
      assert.equal(h.run('rt.sbValue(rt.storyboards[1],TRANSPARENCY,time)'),0);
      assert.equal(h.run('rt.sbValue(rt.storyboards[0],TRANSPARENCY,time)'),.25);
      assert.equal(h.run('rt.lineValue(0,TRANSPARENCY,time)'),1);
    }
    h.run('window.draws=[];storyImage=()=>({naturalWidth:100,naturalHeight:4});__milDrawRotTinted=(...args)=>draws.push(args);drawStoryboardLayer(rt,1,0,1920,1080)');
    assert.equal(h.run('draws.length'),1);
  }
});

test('ZIP deflate fallback works without browser compression streams',async()=>{
  const h=createHarness(root),{deflateRawSync}=require('node:zlib');
  h.context.DecompressionStream=undefined;
  h.run('delete window.DecompressionStream');
  h.context.compressed=deflateRawSync(Buffer.from('Safari 12 ZIP input'));
  assert.equal(Buffer.from(await h.run('inflateRaw(compressed)')).toString(),'Safari 12 ZIP input');
});

test('static parsing retains identifiers and call order without regex lookbehind',()=>{
  const h=createHarness(root);
  assert.equal(h.run('parseJsVal("\\\"text\\\"")'),'text');
  assert.equal(h.run('scanCalls("notn(9); obj.n(8); n(1);n(2)","n").map(a=>a[0]).join()'),'1,2');
  assert.equal(h.run('__milScanNamedCalls("X(1);n(2); obj.n(3); nameX(4)",["n","X"]).map(c=>c.name).join()'),'X,n');
});
