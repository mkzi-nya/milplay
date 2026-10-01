'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const score=require('../js/scoring/score.js');

test('Perfect and Exact both contribute 100% accuracy while score keeps Perfect at 99%',()=>{
  assert.equal(score.calculate('e').accuracy,1);
  assert.equal(score.calculate('p').accuracy,1);
  assert.equal(score.calculate('p').totalAccScore,990000);
  assert.equal(score.calculate('pg').accuracy,.8);
});
