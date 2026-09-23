'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const score=require('../js/09-score.js');

test('lightning reserve absorbs four hits and overflow drains heat to zero',()=>{
  const st=score.create(300),full=st.bMax;
  for(let i=0;i<4;i++)score.lightningHit(st);
  assert.equal(st.lightningHealth,0);assert.equal(st.cur,full);
  score.lightningHit(st);assert.equal(st.lightningHealth,0);assert.equal(st.cur,Math.max(0,full-64));
  score.lightningHit(st);assert.equal(st.cur,0);
  score.extend(st,'e');assert.equal(st.lightningHealth,2);assert.equal(st.cur,2);
  score.extend(st,'p');assert.equal(st.lightningHealth,3);assert.equal(st.cur,3);
  const clean=score.create(300);score.extend(clean,'e');score.extend(clean,'p');
  assert.ok(score.process(st)<score.process(clean));
});

test('score cursor applies lightning in judgement order and resets with timeline',()=>{
  const cursor=score.cursor(),judges=['e'],events=['e','l','l','l','l','l'];
  let st=cursor(judges,300,judges.length,false,events);
  assert.equal(st.lightningHealth,0);assert.equal(st.cur,Math.max(0,st.bMax-64));
  judges.push('p');events.push('p');st=cursor(judges,300,judges.length,false,events);
  assert.equal(st.lightningHealth,1);assert.equal(st.cur,Math.max(0,st.bMax-64)+1);
  st=cursor([],300,0,false,[]);assert.equal(st.lightningHealth,256);assert.equal(st.cur,st.bMax);
});
