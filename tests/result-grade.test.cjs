const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const grade=require('../js/result-grade.js');
test('calculator grade boundaries and AP/FC assets',()=>{
  for(const [score,name] of [[1010000,'R'],[1009999,'M'],[1000000,'M'],[999999,'SS'],[950000,'SS'],[949999,'S'],[850000,'S'],[849999,'A'],[750000,'A'],[749999,'B'],[650000,'B'],[649999,'C'],[600000,'C'],[599999,'F']]){
    assert.equal(grade(score,{m:1},100).name,name);
    for(const counts of [{e:100},{e:99,g:1},{e:99,m:1}])assert.ok(fs.existsSync(path.resolve(__dirname,`../assets/grades/${grade(score,counts,100).icon}.webp`)));
  }
  assert.equal(grade(1006850,{e:888,p:33},921).icon,'10');
  assert.equal(grade(970000,{g:1},100).icon,'21');
  assert.equal(grade(970000,{m:1},100).icon,'2');
  assert.equal(grade(0,{},0).ap,false);
});
test('shipped artwork uses WebP in both builds',()=>{
  const root=path.resolve(__dirname,'..');
  for(const base of ['assets','compat/assets']){
    const visit=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,entry.name);
      if(entry.isDirectory())visit(file);
      else if(!entry.name.startsWith('.'))assert.equal(path.extname(file).toLowerCase(),'.webp',file);
    }};
    visit(path.join(root,base));
  }
  assert.ok(fs.existsSync(path.join(root,'assets/lightning2.webp')));
  assert.match(fs.readFileSync(path.join(root,'compat/js/builtin-sources.js'),'utf8'),/lightning2\.webp/);
});
