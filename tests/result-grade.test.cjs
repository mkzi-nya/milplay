const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const grade=require('../js/result-grade.js');
test('calculator grade boundaries and AP/FC assets',()=>{
  for(const [score,name] of [[1010000,'R'],[1009999,'M'],[1000000,'M'],[999999,'SS'],[950000,'SS'],[949999,'S'],[850000,'S'],[849999,'A'],[750000,'A'],[749999,'B'],[650000,'B'],[649999,'C'],[600000,'C'],[599999,'F']]){
    assert.equal(grade(score,{m:1},100).name,name);
    for(const counts of [{e:100},{e:99,g:1},{e:99,m:1}])assert.ok(fs.existsSync(path.resolve(__dirname,`../assets/grades/${grade(score,counts,100).icon}.png`)));
  }
  assert.equal(grade(1006850,{e:888,p:33},921).icon,'10');
  assert.equal(grade(970000,{g:1},100).icon,'21');
  assert.equal(grade(970000,{m:1},100).icon,'2');
  assert.equal(grade(0,{},0).ap,false);
});
