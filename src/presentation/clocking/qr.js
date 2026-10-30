"use strict";
/* A QR encoder for the clock poster (pure drawing: text in, module matrix out). */
function qrMatrix(text){   // a QR code, byte mode, error level M, mask 0, versions 1 to 6 (up to 106 characters): enough for the poster's link. Checked bit for bit against a reference encoder in the plan's dry run
  const bytes=[]; for(const ch of unescape(encodeURIComponent(String(text))))bytes.push(ch.charCodeAt(0));
  const EC=[10,16,26,18,24,16], BLOCKS=[1,1,1,2,2,4], TOTAL=[26,44,70,100,134,172];
  let ver=-1; for(let v=0;v<6;v++){ if(bytes.length<=TOTAL[v]-EC[v]*BLOCKS[v]-2){ ver=v; break; } } if(ver<0)throw new Error("too long for the poster code");
  const size=21+4*ver, dataCw=TOTAL[ver]-EC[ver]*BLOCKS[ver], bits=[], put=(val,n)=>{ for(let i=n-1;i>=0;i--)bits.push((val>>i)&1); };
  put(4,4); put(bytes.length,8); bytes.forEach(b=>put(b,8)); put(0,Math.min(4,dataCw*8-bits.length)); while(bits.length%8)bits.push(0);
  for(let pad=0xEC;bits.length<dataCw*8;pad^=(0xEC^0x11))put(pad,8);
  const data=[]; for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(""),2));
  const EXP=new Array(512), LOG=new Array(256); for(let i=0,x=1;i<255;i++){ EXP[i]=x; LOG[x]=i; x=(x<<1)^((x&0x80)?0x11D:0); } for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
  const mul=(a,b)=>(a&&b)?EXP[LOG[a]+LOG[b]]:0, ecLen=EC[ver]; let gen=[1]; for(let i=0;i<ecLen;i++){ const next=new Array(gen.length+1).fill(0); for(let j=0;j<gen.length;j++){ next[j]^=gen[j]; next[j+1]^=mul(gen[j],EXP[i]); } gen=next; }
  const rs=block=>{ const res=block.concat(new Array(ecLen).fill(0)); for(let i=0;i<block.length;i++){ const f=res[i]; if(!f)continue; for(let j=0;j<gen.length;j++)res[i+j]^=mul(gen[j],f); } return res.slice(block.length); };
  const nb=BLOCKS[ver], per=dataCw/nb, blocks=[], ecs=[]; for(let b=0;b<nb;b++){ const blk=data.slice(b*per,(b+1)*per); blocks.push(blk); ecs.push(rs(blk)); }
  const cw=[]; for(let i=0;i<per;i++)for(let b=0;b<nb;b++)cw.push(blocks[b][i]); for(let i=0;i<ecLen;i++)for(let b=0;b<nb;b++)cw.push(ecs[b][i]);
  const M=[], F=[]; for(let y=0;y<size;y++){ M.push(new Array(size).fill(0)); F.push(new Array(size).fill(false)); }
  const set=(x,y,v)=>{ M[y][x]=v?1:0; F[y][x]=true; };
  const finder=(cx,cy)=>{ for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){ const x=cx+dx, y=cy+dy; if(x<0||y<0||x>=size||y>=size)continue; const d=Math.max(Math.abs(dx),Math.abs(dy)); set(x,y,d!==2&&d!==4); } };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  for(let i=8;i<size-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
  if(ver>0){ const c=size-7; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(c+dx,c+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1); }
  const fb=0x5412, bit=i=>(fb>>i)&1;   // the format word for error level M with mask 0
  for(let i=0;i<=5;i++)set(8,i,bit(i)); set(8,7,bit(6)); set(8,8,bit(7)); set(7,8,bit(8)); for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(size-1-i,8,bit(i)); for(let i=8;i<15;i++)set(8,size-15+i,bit(i)); set(8,size-8,true);
  let k=0; for(let right=size-1;right>=1;right-=2){ if(right===6)right=5; for(let vert=0;vert<size;vert++){ for(let j=0;j<2;j++){ const x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert; if(F[y][x])continue; let v=0; if(k<cw.length*8)v=(cw[k>>3]>>(7-(k&7)))&1; k++; if(((x+y)&1)===0)v^=1; M[y][x]=v; } } }
  return {size:size,rows:M}; }
