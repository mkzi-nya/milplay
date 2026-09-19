'use strict';
const {execFileSync}=require('node:child_process');
const {inflateSync}=require('node:zlib');
const archive=process.env.MILPLAY_ALGEBRA_ZIP||'/storage/emulated/0/Download/algebra.zip';
function entry(name){return execFileSync('unzip',['-p',archive,name],{maxBuffer:32*1024*1024})}

// Decode the actual non-interlaced 8-bit RGB/RGBA PNGs, including all PNG row filters.
// No browser, placeholder dimensions, or third-party image package is needed.
function png(bytes){
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Not PNG');
  let width,height,channels;const chunks=[];
  for(let p=8;p<bytes.length;){
    const n=bytes.readUInt32BE(p),type=bytes.toString('ascii',p+4,p+8),data=bytes.subarray(p+8,p+8+n);p+=n+12;
    if(type==='IHDR'){
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);
      if(data[8]!==8||![2,6].includes(data[9])||data[12]!==0)throw Error('Unsupported PNG format');
      channels=data[9]===6?4:3;
    }else if(type==='IDAT')chunks.push(data);
  }
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height);
  if(raw.length!==(stride+1)*height)throw Error('Invalid PNG length');
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];
    if(filter>4)throw Error('Invalid PNG filter');
    for(let x=0;x<stride;x++){
      const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;
      const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
      const predictor=[0,a,b,Math.floor((a+b)/2),pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter];
      pixels[i]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  let minAlpha=255,maxAlpha=0,nonzero=0,opaque=0,maxRGB=0,x0=width,y0=height,x1=-1,y1=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*channels,a=channels===4?pixels[i+3]:255;
    minAlpha=Math.min(minAlpha,a);maxAlpha=Math.max(maxAlpha,a);
    if(a){nonzero++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);maxRGB=Math.max(maxRGB,pixels[i],pixels[i+1],pixels[i+2])}
    if(a===255)opaque++;
  }
  return {width,height,channels,pixels,minAlpha,maxAlpha,nonzero,opaque,maxRGB,bounds:[x0,y0,x1+1,y1+1]};
}
module.exports={entry,png,archive};
