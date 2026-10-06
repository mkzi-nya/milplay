'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const score=require('../js/scoring/score.js');

test('score basics and published perfect totals',()=>{
  assert.equal(score.calculate('e'.repeat(377)).finalScore,1010000);
  assert.equal(score.calculate('p'.repeat(377)).finalScore,1000000);
  assert.equal(score.calculate('bnbnpgbmgg').processScore,293340);
  assert.equal(score.calculate('bnbnpgbmgg').finalScore,284700);
  assert.equal(score.calculate([],10).accuracy,0);
});

test('cursor only consumes new judgements and resets on seek',()=>{
  const read=score.cursor(),seq='epgnbm'.repeat(20),expected=score.calculate(seq).processScore;
  assert.equal(score.process(read('',seq.length)),0);
  const first=read(seq.slice(0,10),seq.length);
  assert.equal(first.len,10);
  const second=read(seq.slice(0,20),seq.length);
  assert.equal(second.len,20);
  assert.equal(read(seq.slice(0,5),seq.length).len,5);
  assert.equal(read([],seq.length).len,0);
  assert.equal(read(seq,seq.length).len,seq.length);
  assert.equal(score.process(read(seq,seq.length)),expected);
});

test('lightning events affect heat without adding a judgement',()=>{
  const state=score.create(2);
  score.extend(state,'e');
  assert.equal(state.len,1);
  score.lightningHit(state);
  assert.equal(state.len,1);
  assert.equal(state.lightningHealth,192);
  score.extend(state,'p');
  assert.equal(state.len,2);
  assert.equal(score.snapshot(state).counts.p,1);
});

test('labels and invalid input are explicit',()=>{
  const stateFor=(sequence)=>{
    const state=score.create(sequence.length);
    for(const judgement of sequence)score.extend(state,judgement);
    return state;
  };
  assert.equal(score.label(stateFor('eee')),'ALL PERFECT');
  assert.equal(score.label(stateFor('eeg')),'FULL COMBO');
  assert.equal(score.label(stateFor('eeb')),'COMBO');
  assert.equal(score.label(stateFor('eee'),true),'AUTOPLAY');
  assert.throws(()=>score.create(-1),RangeError);
  assert.throws(()=>score.extend(score.create(1),'x'),RangeError);
});
