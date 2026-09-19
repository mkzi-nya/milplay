'use strict';
/* 共享的 Node vm 测试骨架：伪造最小 DOM/Canvas，把 index.html 的 <script src> 链
 * 按真实顺序载入，从而在手机端不依赖浏览器执行 01-base.js 的解析逻辑。
 * 仅用于测试，不参与页面运行。 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function createHarness(root,opts={}){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])),nodes=new Map(),messages=new Set(),images=[],revoked=[];
  const noop=()=>{},raf=[];
  const canvasContext=()=>new Proxy({measureText:s=>({width:String(s).length*20}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),globalAlpha:1},{get:(o,k)=>k in o?o[k]:noop});
  let serial=0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.children=[];this.listeners=new Map();this.width=1280;this.height=720;this.value='';this.options=[];this.paused=true;this.currentTime=0;this.duration=300;this.classes=new Set();this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,on)=>{on=on??!this.classes.has(x);on?this.classes.add(x):this.classes.delete(x);return on}}}
    getContext(){return this.ctx||(this.ctx=canvasContext())}
    getBoundingClientRect(){return {left:0,top:0,right:1280,bottom:720,width:1280,height:720}}
    get clientWidth(){return this.width} get clientHeight(){return this.height}
    addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f)}
    removeEventListener(t,f){this.listeners.get(t)?.delete(f)}
    emit(t){for(const f of [...this.listeners.get(t)||[]])f({target:this,preventDefault:noop})}
    setAttribute(k,v){this[k]=v} removeAttribute(k){this[k]=''}
    appendChild(e){this.children.push(e);e.parentElement=this;if(e.id)nodes.set(e.id,e);if(e.tagName==='IFRAME'){
      const sandbox={parent:{postMessage:data=>{for(const f of [...messages])f({data,source:e.contentWindow})}},console};
      if(opts.globals)Object.assign(sandbox,opts.globals);
      vm.runInNewContext(e.srcdoc.match(/<script>([\s\S]*)<\/script>/)[1],sandbox,{timeout:opts.childTimeout||60000});
    }return e}
    append(...a){a.forEach(e=>this.appendChild(e))} remove(){} matches(){return false}
    querySelector(sel){if(sel.startsWith('#'))return get(sel.slice(1));return null} querySelectorAll(){return []}
    set innerHTML(s){for(const m of s.matchAll(/\bid="([^"]+)"/g)){ids.add(m[1]);this.appendChild(get(m[1]))}}
    pause(){this.paused=true} play(){this.paused=false;return Promise.resolve()}
    load(){if(this.src)queueMicrotask(()=>this.emit('loadedmetadata'))}
    setPointerCapture(){} releasePointerCapture(){} click(){} close(){} showModal(){this.querySelector('button')?.click()}
  }
  function get(id){if(!ids.has(id))return null;if(!nodes.has(id)){const e=new Element(id==='stage'?'canvas':'div');e.id=id;nodes.set(id,e)}return nodes.get(id)}
  class ImageFake{constructor(){images.push(this);this.complete=false;this.naturalWidth=0;this.naturalHeight=0}set src(s){this._src=s}get src(){return this._src}ready(w=64,h=64){this.complete=true;this.naturalWidth=w;this.naturalHeight=h;this.onload?.()}}
  const document={body:new Element(),head:new Element(),documentElement:new Element(),getElementById:get,createElement:t=>new Element(t),addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],activeElement:{tagName:'BODY'},scripts:[]};
  const context=vm.createContext({console,document,Image:ImageFake,HTMLCanvasElement:Element,Blob,File,TextDecoder,TextEncoder,Response,DecompressionStream,performance,URL:{createObjectURL:()=>`blob:test-${++serial}`,revokeObjectURL:u=>revoked.push(u)},navigator:{language:'en-US',maxTouchPoints:1},matchMedia:()=>({matches:false,addEventListener:noop}),screen:{orientation:{}},devicePixelRatio:1,innerWidth:1280,innerHeight:720,requestAnimationFrame:f=>(raf.push(f),raf.length),cancelAnimationFrame:noop,setTimeout,clearTimeout,queueMicrotask,ResizeObserver:class{observe(){}},localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},addEventListener:(t,f)=>{if(t==='message')messages.add(f)},removeEventListener:(t,f)=>{if(t==='message')messages.delete(f)}});
  context.window=context;context.globalThis=context;
  const run=s=>vm.runInContext(s,context,{timeout:opts.timeout||60000});
  for(const m of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(root,m[1]),'utf8'),context,{filename:m[1],timeout:opts.timeout||60000});
  return {html,context,run,images,revoked,messages,get};
}

module.exports={createHarness};
