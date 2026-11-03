// QR Model 2, version 5-L, byte encoding. One RS block, 108 data + 26 parity bytes.
export function qrSvg(text){
 const bytes=new TextEncoder().encode(text);if(bytes.length>106)return '';
 const bits=[];const push=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1)};push(4,4);push(bytes.length,8);bytes.forEach(b=>push(b,8));push(0,Math.min(4,864-bits.length));while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>a*2+b,0));let pad=0;while(data.length<108)data.push(pad++%2?0x11:0xec);
 const mul=(a,b)=>{let r=0;for(let i=7;i>=0;i--){r=(r<<1)^((r>>>7)*0x11d);r^=((b>>>i)&1)*a}return r};
 let gen=[1],root=1;for(let i=0;i<26;i++){const next=Array(gen.length+1).fill(0);gen.forEach((v,j)=>{next[j]^=v;next[j+1]^=mul(v,root)});gen=next;root=mul(root,2)}
 const ecc=Array(26).fill(0);for(const b of data){const f=b^ecc.shift();ecc.push(0);for(let i=0;i<26;i++)ecc[i]^=mul(gen[i+1],f)}
 const stream=[];[...data,...ecc].forEach(b=>{for(let i=7;i>=0;i--)stream.push((b>>>i)&1)});
 const n=37,m=Array.from({length:n},()=>Array(n).fill(false)),fixed=Array.from({length:n},()=>Array(n).fill(false));
 const set=(x,y,b)=>{if(x>=0&&y>=0&&x<n&&y<n){m[y][x]=!!b;fixed[y][x]=true}};
 function finder(cx,cy){for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4)}}finder(3,3);finder(n-4,3);finder(3,n-4);
 for(let i=8;i<n-8;i++){set(i,6,i%2===0);set(6,i,i%2===0)}
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 // L correction level (01), mask 0, BCH format code and mandatory dark module.
 let format=8<<10;for(let i=14;i>=10;i--)if(format>>>i&1)format^=0x537<<(i-10);format=((8<<10)|format)^0x5412;const fb=i=>(format>>>i)&1;
 for(let i=0;i<=5;i++)set(8,i,fb(i));set(8,7,fb(6));set(8,8,fb(7));set(7,8,fb(8));for(let i=9;i<15;i++)set(14-i,8,fb(i));for(let i=0;i<8;i++)set(n-1-i,8,fb(i));for(let i=8;i<15;i++)set(8,n-15+i,fb(i));set(8,n-8,true);
 let k=0;for(let right=n-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<n;v++){const up=((right+1)&2)===0,y=up?n-1-v:v;for(let j=0;j<2;j++){const x=right-j;if(!fixed[y][x])m[y][x]=!!((stream[k++]||0)^((x+y)%2===0?1:0))}}}
 const path=[];m.forEach((row,y)=>row.forEach((v,x)=>{if(v)path.push(`M${x+4},${y+4}h1v1h-1z`)}));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="210" height="210" role="img" aria-label="학생 참여 QR 코드" shape-rendering="crispEdges"><rect width="45" height="45" fill="white"/><path d="${path.join('')}" fill="black"/></svg>`;
}
