const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const source=file=>readFileSync(join(__dirname,'..',file),'utf8');

/* iOS 12 has Touch Events but no Pointer Events, so js/runtime/ios12.js relays
 * touchstart/move/end into synthetic pointer events. The pause button and the gameplay
 * capture handler both reject `isPrimary===false`; iOS recycles touch identifiers, so a
 * lone finger is frequently NOT identifier 0. This reproduces that relay and asserts the
 * lead finger is always generated as primary regardless of its identifier. */
function relay(){
  const listeners={};
  const dispatched=[];
  const touchTarget={dispatchEvent(e){dispatched.push(e);return true}};
  const document={
    addEventListener(t,f){(listeners[t]??=[]).push(f)},
    createEvent(){return{initEvent(type){this.type=type}}},
    documentElement:{classList:{add(){},remove(){},toggle(){},contains(){return false}}},
    body:{getAttribute(){return 'play'}},
    getElementById(){return null},
  };
  const win={
    navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_7 like Mac OS X)',maxTouchPoints:5},
    document,matchMedia:()=>null,
    addEventListener(){},setTimeout,clearTimeout,
    Event:class{constructor(type,opts){this.type=type;if(opts)Object.assign(this,opts)}},
    Element:undefined,
  };
  win.globalThis=win;
  win.window=win;
  const ctx=vm.createContext(win);
  vm.runInContext(source('js/runtime/ios12.js'),ctx);
  const fire=(type,id,x=10,y=10)=>listeners[type].forEach(fn=>fn({touches:{length:1},changedTouches:[{identifier:id,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y,target:touchTarget,radiusX:1,radiusY:1}],preventDefault(){},target:touchTarget}));
  return {fire,dispatched};
}
const primaryOf=events=>events.filter(e=>e.type==='pointerdown').map(e=>e.isPrimary);

test('a lone touch with a recycled identifier still relays as the primary pointer',()=>{
  const {fire,dispatched}=relay();
  fire('touchstart',3);          // iOS often hands out identifier !== 0
  assert.deepEqual(primaryOf(dispatched),[true]);
  fire('touchend',3);
});

test('the second simultaneous finger is not primary',()=>{
  const {fire,dispatched}=relay();
  fire('touchstart',7);
  fire('touchstart',8);
  assert.deepEqual(primaryOf(dispatched),[true,false]);
  fire('touchend',7);fire('touchend',8);
});

test('while another finger is down a new touch is not primary, and a fresh lone touch is',()=>{
  const {fire,dispatched}=relay();
  fire('touchstart',7);fire('touchstart',8);
  fire('touchend',7);
  fire('touchstart',9);                 // finger 8 still down: not the lead pointer
  assert.deepEqual(primaryOf(dispatched),[true,false,false]);
  fire('touchend',8);fire('touchend',9);
  dispatched.length=0;
  fire('touchstart',42);                // all fingers lifted: lead pointer again
  assert.deepEqual(primaryOf(dispatched),[true]);
  fire('touchend',42);
});
