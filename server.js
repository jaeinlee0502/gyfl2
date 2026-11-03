import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,randomInt} from 'node:crypto';
const dir=new URL('./.data/',import.meta.url); await mkdir(dir,{recursive:true});
let rooms={};try{rooms=JSON.parse(await readFile(new URL('rooms.json',dir),'utf8'))}catch{}
let saving=Promise.resolve();
const save=()=>saving=saving.then(()=>writeFile(new URL('rooms.json',dir),JSON.stringify(rooms)));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
const clean=(v,max=300)=>String(v??'').trim().slice(0,max);
const view=r=>({type:r.type,question:r.question,options:r.options,words:r.words,arguments:r.arguments,closed:r.closed,count:Object.keys(r.voters).length});
export const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/')){
 let b={};if(req.method==='POST'){let raw='';for await(const c of req){raw+=c;if(raw.length>20000)return send(res,413,{error:'입력 내용이 너무 깁니다.'})}try{b=JSON.parse(raw)}catch{return send(res,400,{error:'잘못된 요청입니다.'})}}
 if(u.pathname==='/api/rooms'&&req.method==='POST'){
 if(!['poll','cloud','debate'].includes(b.type)||!clean(b.question))return send(res,400,{error:'질문을 입력해 주세요.'});
 const options=(b.options||[]).map(x=>clean(x,100)).filter(Boolean).slice(0,10);
 if(b.type!=='cloud'&&options.length<2)return send(res,400,{error:'선택지를 두 개 이상 입력해 주세요.'});
 let code;do{code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('')}while(rooms[code]);
 const token=randomBytes(24).toString('hex');rooms[code]={type:b.type,question:clean(b.question),options:options.map(text=>({text,count:0})),words:[],arguments:[],voters:{},closed:false,token,limit:Math.max(0,Math.min(100,Number(b.limit)||0))};await save();return send(res,201,{code,token,...view(rooms[code])});}
 const match=u.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(respond|close))?$/);if(!match)return send(res,404,{error:'찾을 수 없는 요청입니다.'});
 const r=rooms[match[1]];if(!r)return send(res,404,{error:'참여 코드를 확인해 주세요.'});
 if(req.method==='GET')return send(res,200,view(r));
 if(match[2]==='close'){if(b.token!==r.token)return send(res,403,{error:'선생님만 종료할 수 있습니다.'});r.closed=true;await save();return send(res,200,view(r));}
 if(match[2]!=='respond')return send(res,405,{error:'지원하지 않는 요청입니다.'});
 if(r.closed)return send(res,409,{error:'종료된 활동입니다.'});const id=clean(b.id,80);if(!id)return send(res,400,{error:'참여자 정보가 없습니다.'});if(r.voters[id])return send(res,409,{error:'이미 참여했어요. 감사합니다!'});
 if(r.type==='cloud'){const word=clean(b.word,100);if(!word||r.limit&&Array.from(word).length>r.limit)return send(res,400,{error:'단어 길이를 확인해 주세요.'});r.words.push(word)}else{if(!Number.isInteger(b.choice)||!r.options[b.choice])return send(res,400,{error:'입장을 선택해 주세요.'});if(r.type==='debate'){const reason=clean(b.reason);if(!reason)return send(res,400,{error:'입장의 이유를 입력해 주세요.'});r.arguments.push({side:b.choice,text:reason})}r.options[b.choice].count++}
 r.voters[id]=true;await save();return send(res,200,view(r));
 }
 const path=u.pathname==='/style.css'?'style.css':u.pathname==='/app.js'?'app.js':u.pathname==='/qr.js'?'qr.js':'index.html';const data=await readFile(new URL('./public/'+path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch(e){console.error(e.message);send(res,500,{error:'처리 중 문제가 생겼습니다. 다시 시도해 주세요.'})}});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('GYFL classroom listening on port '+(process.env.PORT||3000)));
